---
description: Run a tier-gated refactoring task using the refactoring-strategy playbook — classify scope, plan, characterize (if needed), execute commit-by-commit with simplify-before-each-commit, verify. Delegates the playbook content to refactoring-strategy.md; this command enforces the phase gates.
argument-hint: <one-line refactor task, e.g. "rename QuizRepository.fetch() across all callers">
---

You are running a refactoring task. **Behavior must not change** (per Fowler's Two Hats Rule). If you find a bug while refactoring, write it down — finish the refactor, then switch hats.

**Task:**

$ARGUMENTS

---

# Phase 0 — Mandatory reads

1. **`CLAUDE.md`** — sections 2 (Simplicity First), 3 (Surgical Changes), 5 (Bug-Fix Discipline). §3 is load-bearing — don't expand the diff beyond what the refactor requires.
2. **`.claude/skills/refactoring-strategy.md`** — the playbook for this entire command. Tier classification, patterns, anti-patterns, mini-playbooks. **Read it now; it governs every decision below.**
3. **`REVIEW.md`** — severity calibration.

Skip only if already read this session.

---

# Phase 1 — Tier-gate (MANDATORY — do not skip)

Per `refactoring-strategy.md`, classify the task:

- **T1 (Local)** — one function or file
- **T2 (Cross-module)** — multiple files; signature/field/class moves
- **T3 (Architectural)** — cross-package, abstraction replacement, dependency inversion

**State the classification to the user with reasoning.** Example: "I classified this as T2 — it touches QuizRepository and its 6 callers across the data and domain layers."

**Stop-and-ask triggers** (per `refactoring-strategy.md`) — if ANY apply, STOP and ask the user before proceeding:

1. Public API would change
2. Test coverage would drop
3. You hit a Chesterton's Fence (a guard/branch/abstraction you can't explain)
4. The refactor crosses team/package boundaries
5. You'd delete >50 lines you didn't author
6. The refactor requires a DB migration, schema change, or wire-format change

**For T3: ENTER PLAN MODE.** Do not write any code until the user approves the plan.

---

# Phase 2 — Test readiness check

Are tests covering the affected code?

- **Green** → proceed to Phase 3.
- **Red** → STOP. Fix the failing test first; you refactor on GREEN only.
- **None** → STOP. Write **characterization tests** first per `refactoring-strategy.md` (the legacy code is the oracle — pin every branch with concrete input/output pairs). Get user ack before refactor begins. If you can't write characterization tests for this code, commit `blocked: no test harness for <file>` and stop.

Use the graph for blast radius **before** Phase 3 for any T2/T3 change:
- `query_graph(pattern=callers_of, target=<symbol>)` — verify callers
- `get_impact_radius` — verify blast radius matches expectation
- `get_affected_flows` — confirm no critical flows are silently affected

---

# Phase 3 — Plan

Present the planned commit sequence to the user. For typical patterns:

- **Rename across ≥5 callers (T2)** → Parallel Change: Expand (commit 1) → Migrate (commit 2, maybe 3) → Contract (final commit). Each commit GREEN.
- **Move class across packages (T2)** → atomic commit with LSP-driven move (deterministic tooling > LLM text-rewrite).
- **Replace an abstraction (T3)** → Branch by Abstraction: introduce abstraction → migrate consumers → add new impl → switch via flag → remove old. Multiple commits, each GREEN.
- **Architectural untangle (T3)** → Mikado Method: try → revert → list prerequisite → repeat. Commit only leaves that compile/test green.

Show the user the planned commit subjects (Conventional Commits, `refactor:` prefix). Get explicit ack before Phase 4. For T3, this is a hard plan-mode gate.

---

# Phase 4 — Execute (per-commit loop: change → simplify → tests → commit)

For each commit in the plan, run this loop **in order**. Do not skip steps; do not batch.

1. **Make the change** for this commit only. One named refactoring; no scope creep.
2. **Simplify mini-pass** — apply `.claude/skills/code-simplification.md` to *only* the staged/unstaged diff for this commit. Targets:
   - Dead branches / unreachable code from the refactor
   - Defensive null-checks the type system already guarantees
   - Single-use helpers introduced as scaffolding that can now be inlined
   - Comments restating what the code says
3. **Doubt-driven check (conditional)** — for any commit that lands a non-trivial decision (new abstraction, dependency flip, irreversible mechanical change), invoke `.claude/skills/doubt-driven-development.md` and reconcile findings BEFORE the commit.
4. **Tests + lint** for the touched files. All GREEN. Coverage must be ≥ pre-refactor (refactoring-strategy.md guardrail). If a simplification required a test change, **revert the simplification, not the test** — you changed behavior.
5. **Commit** — Conventional Commits subject names the pattern: `refactor: extract method renderHeader`, `refactor: parallel-change step 2/3 (migrate callers)`, `refactor: introduce Repository abstraction`. Body explains the *why*. Subject ≤ 60 chars.

The simplify-before-commit order is non-negotiable. Refactor commits accumulate noise fast otherwise.

---

# Phase 5 — Full verify

After the final commit:

- Full test suite green
- Lint/detekt clean (no new findings on touched files)
- Coverage ≥ pre-refactor baseline (run a coverage tool if available; otherwise spot-check)
- Mutation testing on T2+ if a mutation framework is configured (proves tests constrain behavior, not just exercise lines)

If anything's unclean, fix in a final commit — itself subjected to the Phase 4 loop.

---

# Phase 6 — Final pre-stop checklist

- [ ] Tier was classified and stated to user (Phase 1)
- [ ] For T3: plan was approved by user before any code change
- [ ] Stop-and-ask triggers were checked; none ignored silently
- [ ] Tests were GREEN before refactor started (or characterization tests written first)
- [ ] Graph was queried for blast radius on any T2/T3 change
- [ ] Two Hats Rule held — no behavior changes hidden inside refactor commits
- [ ] Simplify mini-pass ran BEFORE every commit (Phase 4 step 2)
- [ ] Doubt-driven-development was invoked for any non-trivial decision
- [ ] Coverage ≥ pre-refactor; no test was deleted, weakened, or `@Ignore`d
- [ ] Every commit subject uses `refactor:` prefix and names the pattern; ≤ 60 chars
- [ ] No drive-by reformatting; no adjacent-code "improvements"
- [ ] Final test suite + lint are GREEN

If any box is unchecked, do not stop.

---

# Hard rules (refactor-specific)

- **Behavior must not change.** Anything that changes behavior belongs in a separate `feat:` or `fix:` commit. Two Hats.
- **Branch off `main` at task start.** If `main` is checked out, `git switch -c refactor/<slug>` before any commit. If on another non-default branch, ask before extending. Stay-on-main is the failure mode.
- **Push + open a PR at the end of Phase 6.** `git push -u origin <branch>` then `gh pr create --base main`. PR body includes the tier classification and refactor plan.
- **Never edit existing tests** unless characterization tests are explicitly part of Phase 2's prep. Adding new tests during the refactor is fine.
- **Never delete code older than the project's history can explain.** Chesterton's Fence — if you can't say why it was put there, leave it.
- **No Big Rewrite.** Strangler / Branch by Abstraction always wins. If the plan starts to look like "rewrite this module from scratch", STOP and reclassify as T3 with the user.

---

# Stop condition

You're done when Phase 6 checklist is satisfied, the PR is open against `main` (URL returned to the user), and you've summarised in one or two sentences: tier, commits made, current state.
