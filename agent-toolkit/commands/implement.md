---
description: Implement a task using the project's full implementer workflow — TDD-first, all relevant skills loaded, simplify pass, verify gate, conventional commits. Self-contained — does not rely on you reading the canonical pipeline workflow.
argument-hint: <task description, e.g. "add swipe-to-dismiss to result screen">
---

You are taking on an ad-hoc implementation task using this repo's full implementer discipline — the **same** rules the headless `claude-implementer.yaml` pipeline applies, but in interactive mode on the user's current branch. This command body does not rely on you reading the canonical `.github/agent-prompts/implementer.md` — its workflow is fully inlined below. (Skill files under `.claude/skills/` are still external reads, invoked on demand per the routing rules in Phase 1.)

**Task:**

$ARGUMENTS

---

# Phase 0 — Mandatory reads (do not skip)

Before you write a single character of code:

1. **`CLAUDE.md`** at the repo root. Read all 6 sections. §2 (Simplicity First) and §3 (Surgical Changes) gate every line you write. §5 (Bug-Fix Discipline) applies if this task is a defect. §6 sets source precedence — repo-specific rules beat generic ones.
2. **`REVIEW.md`** at the repo root. Read it fully. The "What 🔴 Important means here" section + the "Always check" list define what counts as a real defect. If your change could violate any always-check bullet, address it before you stop.

These two reads are non-negotiable. If you've already read them in this session you can confirm and skip; otherwise read now.

---

# Phase 1 — Plan + skill routing

Decide which skills your task needs based on its shape. Read each matching skill **now, before writing code** — not "as needed" later.

## Always-applicable Addy Osmani skills (read at least one)

- **`.claude/skills/incremental-implementation.md`** — REQUIRED if task touches >1 file or you expect to write ~100+ lines before the first test runs. Forces thin vertical slices, one logical change per commit, build green between slices.
- **`.claude/skills/debugging-and-error-recovery.md`** — REQUIRED if this is a defect with a stack trace, repro, or unexpected behavior. Six-step triage: Reproduce → Localize → Reduce → Fix → Guard → Verify. CLAUDE.md §5 says don't ship symptom-patches; this skill is how you avoid that.
- **`.claude/skills/doubt-driven-development.md`** — REQUIRED before committing any non-trivial decision: new branching logic, cross-module change, irreversible side-effect, thread-safety claim, idempotence claim. Spawn a fresh-context adversarial subagent reviewer and reconcile findings BEFORE relying on the decision. Interactive mode has no pull-panda safety net — this skill is the substitute.
- **`.claude/skills/code-simplification.md`** — applied **before EVERY commit** in Phase 4 (the per-commit mini-pass). Read it now so you don't have to context-switch later.

## Compose skills — MANDATORY if task touches any `@Composable`

REVIEW.md grades 🔴 against deviations from these. If the diff touches even one `@Composable` and you skipped these, your work is finding-bait. Start with `compose-state-authoring`; it routes to the others.

- **`.claude/skills/compose-state-authoring.md`** — `remember`/`rememberSaveable`, `mutableStateOf` vs `mutableStateListOf`, why `var` in a `@Composable` is wrong, `@ReadOnlyComposable`. **Read this first; it's the entry-point.**
- **`.claude/skills/compose-state-hoisting.md`** — UI element state vs screen state vs business state. Stateful vs stateless overload decision.
- **`.claude/skills/compose-state-holder-ui-split.md`** — screen-level Composable doing both ViewModel orchestration AND layout. Forces clean split.
- **`.claude/skills/compose-side-effects.md`** — `LaunchedEffect`, `DisposableEffect`, `SideEffect`, `rememberCoroutineScope`, `snapshotFlow`, event-Flow collection. Most lifecycle bugs hide here.
- **`.claude/skills/compose-recomposition-performance.md`** — unwanted recomposition, `derivedStateOf`, `remember(keys)`, layout→composition back-writes.
- **`.claude/skills/compose-stability-diagnostics.md`** — parameter stability, list/map params without stable keys, Kotlin 2.0+ strong skipping. Common symptoms: LazyColumn flicker on draft swap, Konfetti parties list rebuilt every recomposition, EntryPointAccessors lookups inside `@Composable` bodies.
- **`.claude/skills/compose-modifier-and-layout-style.md`** — modifier parameter design, parent-decides-placement, modifier-chain ordering.
- **`.claude/skills/compose-state-deferred-reads.md`** — frame-rate State reads in composition, `onSizeChanged { stateWrite }` back-writing into composition.

## Repo-specific graph-aware skills (complementary, read if useful)

- **`.claude/skills/explore-codebase.md`** — when finding existing patterns to match
- **`.claude/skills/debug-issue.md`** — graph-powered debugging
- **`.claude/skills/refactor-safely.md`** — when scope creep is tempting
- **`.claude/skills/review-changes.md`** — self-review before stopping

After Phase 1, state to the user (briefly): which skills you loaded, and what your plan is. **Ask clarifying questions if the task is ambiguous.** The headless pipeline can't; you can.

---

# Phase 2 — TDD: write failing tests FIRST

This is non-negotiable. Don't write implementation before you have a failing test that captures the acceptance criteria.

- JVM unit tests → `app/src/test/.../*Test.kt`, run via `./gradlew testDebugUnitTest`
- Paparazzi snapshot tests for Compose UI rendering changes → one snapshot per distinct visible state
- Behavior needing the emulator → `app/src/androidTest/` (can't run locally without a device; flag if this is the only path)
- Races / timing → controlled `TestDispatcher`, fake clock — never `Thread.sleep`

If the task is a defect and you CAN'T write a failing test (production-only, requires emulator, etc.), per CLAUDE.md §5 step 1: **STOP. Do not ship a fix.** Tell the user what's blocking the repro.

---

# Phase 3 — Run the tests, confirm they fail for the right reason

Not just "fail" — fail for the reason your task implies. A test that fails because of a compile error doesn't count. A test that fails for a different reason than expected means the test is wrong, not the implementation.

---

# Phase 4 — Implement (per-commit loop: code → simplify → tests → commit)

For each logical change you're about to commit, run this loop. **Do NOT batch commits at the end of the task.** Every commit must ship simplified code; no "we'll clean up later" passes.

**Per-commit loop:**

1. **Code** — write the minimum code that makes the failing test (or this commit's scope) pass.
2. **Simplify mini-pass** — apply `.claude/skills/code-simplification.md` to *only the staged/unstaged diff for this commit*. Targets:
   - Dead branches / unreachable code introduced in this commit
   - Defensive null-checks the type system already guarantees
   - Single-use helpers that could be inlined
   - Comments restating what the code already says
   - Verbose error-handling wrapping framework guarantees (e.g. `try/catch` around a non-throwing call)
3. **Tests + detekt + lint for the touched files** — `./gradlew testDebugUnitTest` green, no NEW detekt findings on files in this commit's diff, no NEW Android Lint findings on files in this commit's diff (`./gradlew lintDebug`). Detekt and Android Lint catch different classes of problems (`SuspiciousIndentation`, deprecated APIs, resource/layout bugs are lint-only). If a simplification required a test change, you changed behavior — **revert the simplification, not the test.**
4. **Doubt-driven check (conditional)** — if this commit lands a non-trivial decision (new branching logic, cross-module change, thread-safety/idempotence claim, irreversible side-effect), invoke `.claude/skills/doubt-driven-development.md` and reconcile findings BEFORE the commit.
5. **Commit** — Conventional Commits format: `feat(quiz): ...`, `fix(ui): ...`, `test(streak): ...`, `refactor(data): ...`. Subject ≤ 60 chars; body explains the *why* if non-obvious.

**General discipline:**
- One logical change per commit.
- Match existing patterns. Don't invent abstractions — CLAUDE.md §2.
- Don't refactor adjacent code outside the diff — CLAUDE.md §3.

---

# Phase 5 — Full-suite verify (after the last commit)

After your final commit, run the **full** gate one more time as a sanity check:

- `./gradlew testDebugUnitTest` — all green
- `./gradlew detekt` — no NEW findings on files you touched
- `./gradlew lintDebug` — no NEW findings on files you touched

Per-commit simplify already cleaned each diff slice, but this catches anything cross-commit (e.g. an import added in commit 1 that became unused after commit 3). If anything is unclean, fix in a final `chore: cleanup post-implement` commit — itself subjected to the per-commit loop above.

---

# Phase 6 — Final pre-stop checklist (read out loud to yourself)

Before saying "done", confirm each of these:

- [ ] All acceptance criteria are met
- [ ] Tests for the change exist and are green
- [ ] `./gradlew testDebugUnitTest` passes
- [ ] `./gradlew detekt` shows no new findings on touched files
- [ ] `./gradlew lintDebug` shows no new findings on touched files
- [ ] **Simplify mini-pass ran before EVERY commit (Phase 4 loop) — tests stayed green each time**
- [ ] If any non-trivial decision was made, doubt-driven-development was invoked
- [ ] If any `@Composable` was touched, the relevant compose-* skill was read FIRST (not after)
- [ ] Every changed line traces directly to the task (no scope creep)
- [ ] Commits use Conventional Commits format, one logical change each
- [ ] No deleted or weakened tests; no `@Ignore`/`@Disabled`/`@Suppress` added without commit-body justification (CLAUDE.md §5)

If any box is unchecked, do not stop. Address it.

---

# Hard rules (adapted for interactive mode)

Note: Phase 5 (full-suite verify) is part of "done" but lives between Phase 4 (per-commit loop) and Phase 6 (this checklist). The checklist below assumes Phase 5 passed.

- **Don't switch branches automatically.** The user picked the current branch deliberately. If main is checked out and the task is non-trivial, ASK before creating a feature branch.
- **Don't push or open a PR.** Stop when Phase 7 is satisfied. Let the user push.
- **Never edit existing tests** under `**/test/`, `**/androidTest/`, `*Test.kt` unless the task explicitly asks. Adding new tests is encouraged.
- **Never edit files under `.github/`** — CODEOWNERS gates this anyway.
- **Never run destructive operations** — `rm -rf`, `git reset --hard`, `git push --force`, branch deletion of main. Don't propose them either.
- **If you genuinely cannot make progress**, surface the blocker explicitly to the user. Don't fake-finish.

---

# Stop condition

You're done when Phase 7's checklist is fully satisfied AND you've stated to the user what was done + what's left for them (typically: review diff, push, open PR).
