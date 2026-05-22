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
- **`.claude/skills/code-simplification.md`** — DEFERRED until Phase 6. Mentioned here so you don't forget it exists.

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

# Phase 4 — Implement

- One logical change per commit. Conventional Commits format: `feat(quiz): ...`, `fix(ui): ...`, `test(streak): ...`, `refactor(data): ...`, `docs(readme): ...`.
- Keep commit subjects under 60 chars; body explains the why if non-obvious.
- Match existing patterns in the codebase. Don't invent abstractions — CLAUDE.md §2.
- Don't refactor adjacent code — CLAUDE.md §3.
- If you made a non-trivial decision (per Phase 1's doubt-driven list), invoke `.claude/skills/doubt-driven-development.md` BEFORE you commit that decision. Reconcile the subagent's findings.

---

# Phase 5 — Run tests + detekt, confirm green

- `./gradlew testDebugUnitTest` — all green, INCLUDING new tests
- `./gradlew detekt` — no NEW findings on files you touched. Pre-existing findings on other files: leave them.

If either fails, do not proceed to Phase 6. Fix and re-run.

---

# Phase 6 — Simplify pass (MANDATORY — do not skip)

Read **`.claude/skills/code-simplification.md`** now if you haven't already.

Apply it **to your diff only** (commits between your branch's base and HEAD). Scope:

- Dead branches / unreachable code
- Defensive null-checks the type system already guarantees
- Single-use helpers that could be inlined
- Comments restating what the code already says
- Verbose error-handling wrapping framework guarantees (e.g. wrapping a non-throwing call in `try/catch`)

**Re-run the tests after simplifying.** They must pass without modification. If a simplification requires changing a test, you changed behavior, not just expression — **revert that simplification.**

This is the step interactive mode most often skips under user impatience. Do not skip.

---

# Phase 7 — Final pre-stop checklist (read out loud to yourself)

Before saying "done", confirm each of these:

- [ ] All acceptance criteria are met
- [ ] Tests for the change exist and are green
- [ ] `./gradlew testDebugUnitTest` passes
- [ ] `./gradlew detekt` shows no new findings on touched files
- [ ] Simplify pass was executed (Phase 6) and tests still green
- [ ] If any non-trivial decision was made, doubt-driven-development was invoked
- [ ] If any `@Composable` was touched, the relevant compose-* skill was read FIRST (not after)
- [ ] Every changed line traces directly to the task (no scope creep)
- [ ] Commits use Conventional Commits format, one logical change each
- [ ] No deleted or weakened tests; no `@Ignore`/`@Disabled`/`@Suppress` added without commit-body justification (CLAUDE.md §5)

If any box is unchecked, do not stop. Address it.

---

# Hard rules (adapted for interactive mode)

- **Don't switch branches automatically.** The user picked the current branch deliberately. If main is checked out and the task is non-trivial, ASK before creating a feature branch.
- **Don't push or open a PR.** Stop when Phase 7 is satisfied. Let the user push.
- **Never edit existing tests** under `**/test/`, `**/androidTest/`, `*Test.kt` unless the task explicitly asks. Adding new tests is encouraged.
- **Never edit files under `.github/`** — CODEOWNERS gates this anyway.
- **Never run destructive operations** — `rm -rf`, `git reset --hard`, `git push --force`, branch deletion of main. Don't propose them either.
- **If you genuinely cannot make progress**, surface the blocker explicitly to the user. Don't fake-finish.

---

# Stop condition

You're done when Phase 7's checklist is fully satisfied AND you've stated to the user what was done + what's left for them (typically: review diff, push, open PR).
