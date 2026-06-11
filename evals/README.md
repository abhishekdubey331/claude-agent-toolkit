# M0 — eval harness

The toolkit's whole pitch is quality. **This is the proof.** It measures the
toolkit on a set of bounded fixtures and reports a number, so every later change
(enforcement hooks, an adversarial critic, best-of-N) can be judged against a
baseline instead of "feels better." See [issue #20](https://github.com/abhishekdubey331/claude-agent-toolkit/issues/20).

## What it measures

**Pass-rate is the primary, trustworthy metric** (issue #20 §9): for each fixture
the agent gets a bounded task and a hidden acceptance test; the run passes iff the
test suite exits 0. Wall-clock and tokens are tracked alongside. Human-edit-distance
is deliberately **not** gated on — many correct diffs exist, so distance from one
reference penalizes valid alternatives.

## Run it

```bash
npm run eval:mock     # deterministic, free — proves the harness end-to-end
npm run eval          # the real baseline: runs the agent (spends tokens)
npm run eval -- --runs 3   # average over 3 runs (LLM output is nondeterministic)
npm run eval:report   # re-print the saved scorecard
```

`eval:mock` applies each fixture's known-good `solution/` instead of calling an
agent. It must score **100%** — a mock failure means a broken fixture, and the
harness exits non-zero. That's why CI runs the mock pass: it guards the fixtures
without needing API credentials.

The real baseline (`npm run eval`) shells out to the `claude` CLI by default;
override with `EVAL_AGENT_CMD` (template with `{{PROMPT}}` and `{{DIR}}`) to
benchmark a different agent, and `EVAL_PROMPT_PREFIX` (default `/implement `).

## Fixture layout

```
fixtures/<id>/
  meta.json     # {id, type: fix|small-feature|small-refactor, size, acceptance[], ...}
  task.md       # the bounded task prompt fed to the agent
  base/         # the sandbox repo state BEFORE the change (incl. CLAUDE.md, hidden tests, verify.sh)
  solution/     # known-good files overlaid in --mock mode (the oracle's reference)
```

Each run copies `base/` to a throwaway temp dir, runs the solver there, then runs
`base/verify.sh` (cwd = sandbox) as the oracle.

## Sourcing fixtures

Seed fixtures are synthetic. To grow toward the ≥15–30 the epic targets, draw from
**this repo's own closed PRs/issues** — we own them, which sidesteps the labeled-data
licensing question (issue #20 open question #4). Each new fixture needs a `base/`
state, a hidden acceptance test, and a known-good `solution/`.

## Status

Bootstrap: harness + 2 seed fixtures, mock pass verified. **Not yet a real baseline** —
that needs the real run on ≥15 fixtures with `--runs ≥3`.
