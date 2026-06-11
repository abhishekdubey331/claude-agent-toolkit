#!/usr/bin/env node
// Re-print a saved eval scorecard (for CI logs / trend tracking) and, when
// given a baseline, fail on a pass-rate regression beyond the threshold.
//
// Usage:
//   node evals/report.mjs [resultsPath] [--baseline <path>] [--max-drop <0..1>]
//
// --max-drop defaults to 0.05. Per issue #20 §9, only pass-rate gates; the
// threshold should account for run-to-run variance, so run the baseline with
// --runs ≥3 before trusting a hard gate.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function parse(argv) {
  const a = { results: join(HERE, "results", "latest.json"), baseline: null, maxDrop: 0.05 };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--baseline") a.baseline = argv[++i];
    else if (argv[i] === "--max-drop") a.maxDrop = parseFloat(argv[++i]);
    else pos.push(argv[i]);
  }
  if (pos[0]) a.results = pos[0];
  return a;
}

const pct = (x) => `${Math.round(x * 100)}%`;
const load = (p) => JSON.parse(readFileSync(p, "utf8"));

function main() {
  const a = parse(process.argv.slice(2));
  const cur = load(a.results);

  console.log(`── eval scorecard (${cur.mode}) ─────────────────────────────`);
  console.log(`pass-rate: ${pct(cur.passRate)}  over ${cur.fixtures} fixture(s) × ${cur.runsPerFixture} run(s)`);
  console.log("type        pass-rate  fixture");
  for (const r of cur.results) {
    console.log(`${(r.type || "?").padEnd(12)}${pct(r.passRate).padStart(6)}     ${r.id}`);
  }

  if (a.baseline) {
    const base = load(a.baseline);
    const drop = base.passRate - cur.passRate;
    console.log(`\nbaseline pass-rate: ${pct(base.passRate)}  →  current: ${pct(cur.passRate)}  (Δ ${drop <= 0 ? "+" : "-"}${pct(Math.abs(drop))})`);
    if (drop > a.maxDrop) {
      console.error(`REGRESSION: pass-rate dropped ${pct(drop)} > allowed ${pct(a.maxDrop)}`);
      process.exit(1);
    }
  }
}

main();
