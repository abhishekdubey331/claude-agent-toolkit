---
name: comment-discipline
description: Rules for what comments to write, keep, trim, or delete. Fires per-commit during implementation and on every fix that adds or modifies comments. Catches KDoc/docstring bloat, redundant block comments, decision-log duplication, and lint-suppression annotations without justification.
---

# Comment discipline

The rules below decide whether a given comment should exist, be trimmed, or be deleted. They are the single source of truth — the `/implement` and `/fix` commands, and any other workflow that needs comment rules, should reference this skill rather than restating.

This skill was split out of the `code-simplification` skill because it runs at a different trigger: **per-commit during implementation**, not once at the end of a task. Comments evaluated at write-time get evaluated honestly; comments evaluated days later are protected by sunk-cost bias.

## When to apply

- **During implementation**, before each `git add`: scan the staged hunk and apply rules 1–7 below to every comment in it.
- **During fixes**, while writing the targeted change: apply rules 1–7 to comments you are about to add.
- **In the Phase-6 structural simplify pass**, run the validator (§"Validator pass") to catch anything that survived per-commit.

## The WHY-not-WHAT principle

A comment justifies its existence only when it carries intent the code itself cannot express. Concretely:

- **WHAT comments restate the code.** Delete.
- **WHY comments capture hidden constraint, subtle invariant, workaround for a specific bug, behaviour that would surprise a reader.** Keep.
- A short `// see docs/<file>.md §N` pointer is a WHY comment when the doc carries irreplaceable context.

Decision rule: **if removing the comment would not confuse a future reader who has the code + tests + commit message + linked docs, the comment is WHAT. Delete it.**

## The seven rules

| # | Rule | Example to delete | Example to keep |
|---|---|---|---|
| 1 | WHAT comment restating the code | `// increment counter` above `count++` | (none — there is no WHY for "increment") |
| 2 | Docstring/KDoc on any function or field whose name already carries the same information (private OR public-but-internal-to-module) | `/** Records that a 503 was seen this session. */` above `fun recordFeatureDisabledSeen()`; a 7-line KDoc on `private var pollJob: Job?` | A docstring on a public library API consumed cross-module that documents the contract for third-party callers |
| 3 | Block comment >3 lines | A 5–7 line paragraph explaining a single intent → trim. Can one tight sentence carry the *why*? If yes, replace. | A block comment that carries a real multi-step invariant (e.g. "this race window exists because A, B, C — see issue #N") |
| 4 | Repeated comments restating the same intent | A `// Note:` line above a comment block above a docstring, all saying the same thing → keep one, delete the others | (n/a) |
| 5 | Decision-log content inlined as code comment. "Decision log" = the PR body OR a `docs/<feature>-contract-<date>.md` OR a `docs/<feature>-plan-<date>.md` document already in the repo | (a) `// Don't inline — see PR #N` next to code whose rationale lives in the PR body. (b) An ASCII state-machine diagram in a sealed-class file when `docs/<feature>-contract-*.md` already owns it. (c) "Phase 1 building block / dead code by design" note that a later phase wired up | A one-line `// see docs/<file>.md §N` pointer when the doc carries irreplaceable context. |
| 6 | Inline comment narrating a multi-line block | A 3-line comment above a 10-line conditional | (extract a named helper; the name replaces the comment) |
| 7 | Lint-suppression annotation (`@Suppress`, `# noqa`, `// eslint-disable-next-line`, `# type: ignore`, etc.) without an adjacent `<lang-comment> suppress: <why>` OR a same-commit body justification | `@Suppress("ReturnCount")` on a private mapping function with no rationale in code or commit | `@Suppress("ReturnCount") // suppress: 4 return points keep the when-branches readable; alternative is nested lets` |

## Validator pass (run in Phase 6 of `/implement`, Phase 6 of `/fix`)

After the structural simplify pass, re-scan the diff for survivors. Treat each as a regression of the per-commit pass:

1. `git diff origin/main...HEAD -- '<source-glob>' | grep -E '^\+\s*\*' | wc -l` — count added docstring/KDoc lines. Spike vs. baseline (look at the prior 5 commits' add rate) → investigate which file inflated and re-apply rules 2 + 3.
2. `git diff origin/main...HEAD -- '<source-glob>' | grep -E '^\+\s*(@Suppress|# noqa|// eslint-disable|# type: ignore)' -A1` — every added suppression should be paired with a `suppress:`/`reason:` comment or a commit-body justification.
3. For any file in the diff with comment ratio >30% on a non-test file, audit by hand. (Heuristic only — pure sealed-class / data-class files legitimately run higher.)

## When NOT to apply

- **Generated code** (anything under `build/`, `dist/`, `generated/`, or other codegen outputs). These come from codegen, not you.
- **Test sources** under `**/test/`, `**/tests/`, `*Test.*`, `*_test.*`, `*.test.*`, `*.spec.*`. Test names and arrange/act/assert structure carry the intent; tests are allowed to be wordier.
- **License headers** at the top of source files.
- **CHANGELOG.md / README.md** prose — comment discipline is for code, not narrative docs.

## Routing

Pairs with:

- `code-simplification` — the structural simplify pass. This skill is its comment-rule sibling, split out so each fires on the correct trigger.
- `refactoring-strategy` — narrowing visibility to `internal`/`private` often makes a docstring redundant (the contract no longer crosses a module boundary).
- The `/implement` Phase-4 per-commit gate and `/fix` mini simplify gate both invoke this skill directly.
