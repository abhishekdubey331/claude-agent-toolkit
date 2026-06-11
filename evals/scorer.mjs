#!/usr/bin/env node
// M0 eval harness — measure the toolkit on bounded fixtures.
//
// For each fixture it copies `base/` into a throwaway sandbox, runs a SOLVER
// against it, then runs the fixture's `verify.sh` oracle and records whether
// the acceptance tests pass (exit 0). Pass-rate is the PRIMARY, trustworthy
// metric (per issue #20 §9); wall-clock and tokens are tracked too.
//
// Two solver modes:
//   --mock        copy `solution/` over the sandbox (deterministic, free).
//                 Proves the harness plumbing end-to-end without spending tokens.
//   (default)     run the real agent on the sandbox via $EVAL_AGENT_CMD
//                 (default: the `claude` CLI). This is the actual baseline.
//
// Flags:
//   --mock              use the mock solver
//   --runs <n>          repeat each fixture n times (default 1; use ≥3 for a real
//                       baseline — LLM output is nondeterministic, report a mean)
//   --fixture <id>      run only one fixture
//   --json <path>       results artifact (default evals/results/latest.json)
//
// Env (real mode):
//   EVAL_AGENT_CMD      command template; {{PROMPT}} and {{DIR}} are substituted.
//                       Default: claude -p "{{PROMPT}}" --output-format json
//                                --dangerously-skip-permissions --add-dir {{DIR}}
//   EVAL_PROMPT_PREFIX  prepended to each task (default "/implement ")

import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, "fixtures");

function parseArgs(argv) {
  const a = { mock: false, runs: 1, fixture: null, json: join(HERE, "results", "latest.json") };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--mock") a.mock = true;
    else if (t === "--runs") a.runs = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (t === "--fixture") a.fixture = argv[++i];
    else if (t === "--json") a.json = argv[++i];
  }
  return a;
}

function discoverFixtures(only) {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => !only || id === only)
    .sort()
    .map((id) => {
      const dir = join(FIXTURES_DIR, id);
      const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
      const task = readFileSync(join(dir, "task.md"), "utf8").trim();
      return { id, dir, meta, task };
    });
}

function sandboxFrom(fixture) {
  const sb = mkdtempSync(join(tmpdir(), `eval-${fixture.id}-`));
  cpSync(join(fixture.dir, "base"), sb, { recursive: true });
  return sb;
}

// --- Solvers -------------------------------------------------------------
function solveMock(fixture, sandbox) {
  const sol = join(fixture.dir, fixture.meta.mockSolutionDir || "solution");
  cpSync(sol, sandbox, { recursive: true }); // overlay solution files onto base
  return { tokens: null, costUsd: null };
}

function solveReal(fixture, sandbox) {
  const prefix = process.env.EVAL_PROMPT_PREFIX ?? "/implement ";
  const prompt = prefix + fixture.task;
  const tmpl =
    process.env.EVAL_AGENT_CMD ||
    'claude -p "{{PROMPT}}" --output-format json --dangerously-skip-permissions --add-dir {{DIR}}';
  // Token-safe substitution: pass prompt via argv, not shell interpolation.
  const cmdline = tmpl.replace('"{{PROMPT}}"', "{{PROMPT}}");
  const parts = cmdline.split(/\s+/).map((p) => (p === "{{PROMPT}}" ? prompt : p.replace("{{DIR}}", sandbox)));
  const res = spawnSync(parts[0], parts.slice(1), { cwd: sandbox, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let tokens = null, costUsd = null;
  try {
    const out = JSON.parse(res.stdout);
    const u = out.usage || {};
    tokens = (u.input_tokens || 0) + (u.output_tokens || 0) || null;
    costUsd = typeof out.total_cost_usd === "number" ? out.total_cost_usd : null;
  } catch { /* best-effort: usage stays null */ }
  return { tokens, costUsd };
}

function verify(sandbox) {
  const start = process.hrtime.bigint();
  const res = spawnSync("sh", ["verify.sh"], { cwd: sandbox, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return { pass: res.status === 0, exitCode: res.status, ms };
}

// --- Run -----------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mock ? "mock" : "real";
  const fixtures = discoverFixtures(args.fixture);
  if (!fixtures.length) { console.error("no fixtures found"); process.exit(1); }

  console.log(`eval: mode=${mode} fixtures=${fixtures.length} runs=${args.runs}\n`);
  const results = [];
  for (const f of fixtures) {
    const runs = [];
    for (let r = 0; r < args.runs; r++) {
      const sandbox = sandboxFrom(f);
      try {
        const solve = mode === "mock" ? solveMock(f, sandbox) : solveReal(f, sandbox);
        const v = verify(sandbox);
        runs.push({ ...v, ...solve });
        console.log(`  ${v.pass ? "PASS" : "FAIL"}  ${f.id}  (run ${r + 1}/${args.runs}, ${v.ms.toFixed(0)}ms${solve.tokens ? `, ${solve.tokens} tok` : ""})`);
      } finally {
        rmSync(sandbox, { recursive: true, force: true });
      }
    }
    const passes = runs.filter((x) => x.pass).length;
    results.push({
      id: f.id, type: f.meta.type, size: f.meta.size,
      runs: runs.length, passes, passRate: passes / runs.length,
      medianMs: median(runs.map((x) => x.ms)),
      tokens: sum(runs.map((x) => x.tokens).filter((x) => x != null)) || null,
    });
  }

  const overall = {
    mode, generatedBy: "evals/scorer.mjs",
    fixtures: results.length,
    runsPerFixture: args.runs,
    passRate: avg(results.map((r) => r.passRate)),
    results,
  };
  mkdirSync(dirname(args.json), { recursive: true });
  writeFileSync(args.json, JSON.stringify(overall, null, 2) + "\n");
  printScorecard(overall);
  console.log(`\nresults → ${args.json}`);
  // Smoke-test contract: mock mode MUST be 100% (the known-good solution must
  // satisfy the oracle). A mock failure means a broken fixture, so fail loudly.
  if (mode === "mock" && overall.passRate < 1) process.exit(1);
}

function printScorecard(o) {
  console.log(`\n── M0 scorecard (${o.mode}) ─────────────────────────────`);
  console.log(`pass-rate: ${pct(o.passRate)}  over ${o.fixtures} fixture(s) × ${o.runsPerFixture} run(s)`);
  for (const r of o.results) {
    console.log(`  ${pct(r.passRate).padStart(4)}  ${r.id.padEnd(22)} [${r.type}]  ${r.medianMs.toFixed(0)}ms${r.tokens ? `  ${r.tokens}tok` : ""}`);
  }
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const avg = (xs) => (xs.length ? sum(xs) / xs.length : 0);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const pct = (x) => `${Math.round(x * 100)}%`;

main();
