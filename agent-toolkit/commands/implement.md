---
description: Implement a task using the project's full implementer workflow — TDD-first, all relevant skills loaded, simplify pass, verify gate, conventional commits. Self-contained — does not rely on you reading the canonical pipeline workflow.
argument-hint: <task description, e.g. "add swipe-to-dismiss to result screen">
---

You are taking on an interactive implementation task using this repo's full implementer discipline — the **same** rules the headless `claude-implementer.yaml` pipeline applies, but driven by the user in real time. This command body does not rely on you reading the canonical `.github/agent-prompts/implementer.md` — its workflow is fully inlined below. (Skill files under `.claude/skills/` are still external reads, invoked on demand per the routing rules in Phase 1.)

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

## Reuse scan — MANDATORY before introducing any new symbol

CLAUDE.md §2 ("Reuse Before You Build", if your repo has it) is a hard gate. The principle is **scan first**, not "reuse everything". The CORRECT action depends on the category — some want reuse, some want mirror, some want new-per-route-with-mirrored-structure. Full skill: `.claude/skills/reuse-before-you-build.md` (per-category table + four-step gate). Pair with `.claude/skills/cross-module-flow-reuse.md` when the invention is a multi-step flow at 20+ lines.

Quick mental model — the four buckets and their defaults:

- **Shared primitives** (UI primitives, UseCases, DTOs, copy / tokens / test-tags, error mappers, test fakes) → **REUSE / EXTEND**. Re-implementing is the failure.
- **Pattern-instance composables** (sheets / dialogs / cards built FROM the primitives) → **MIRROR** for a sibling use case. New instance, same shell + primitives + header pattern.
- **Per-destination units** (`*Route`, `*Screen`, `*ViewModel`, per-VM sealed UI states) → **NEW per route/destination**, mirror only the structure (layering, conventions). Sharing one across unrelated destinations couples lifecycles — only with a stated Activity-scoped exception.
- **Genuinely first-of-its-kind** → NEW, but only after the search confirms it.

Procedure:
1. **Graph search.** `semantic_search_nodes` for the domain noun + likely suffix (`*Sheet`, `*ViewModel`, `*UseCase`, `*Repository`, `*Dto`, `*Mapper`). `query_graph` for `callers_of` / `imports_of` the closest neighbor. Walk canonical homes for your category (shared components / screens, `usecase/`, `data/remote/dto/`, `domain/model/`, shared copy object, test-tags object, Hilt `@Module` files, navigation-route enum).
2. **Identify the bucket** (one of the four above). The bucket determines the default.
3. **Apply the default UNLESS you have a stated reason to deviate.** Deviations are legitimate (Activity-scoped VM, cross-cutting sealed-state base) — but they must be stated, not silent.
4. **Attest before Phase 2.** One line per new symbol: `reuse: …` / `extend: …` / `mirror: … (category default = mirror)` / `new (category default): …` / `new (deviation): … — justified because …` / `new: no sibling found — searched X, Y, Z`.

If you cannot find a sibling in the shared-primitive bucket, that's a signal to ASK the user (Phase 1 ends with a user check anyway), not to invent. If you're in the per-destination bucket and NEW is the default, no question needed — just attest the bucket and the mirroring decision.

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

**Self-attestation gate (anti-skip):** "MANDATORY" and "REQUIRED" labels above carry no programmatic enforcement — they rely on you. Before Phase 2, write **one line per applicable skill you loaded** (e.g. `compose-state-authoring: loaded — confirms my plan keeps state out of @Composable bodies`) AND **one line per new symbol for the reuse scan** — each line states the bucket default and your choice. Examples spanning all four buckets:

- `reuse: SharedCopy.NOT_NOW` (shared primitive: default = reuse)
- `mirror: PdfRewardedUnlockSheet mirrors DailyLimitSheet — same shell + sheet-action primitives + icon-card header` (pattern-instance composable: default = mirror)
- `extend: existing PollingUseCase — new case slots in via PollingPolicy enum` (UseCase: default = reuse/extend)
- `new (category default): PdfGenerateScreen is a new screen per route; mirrors CreateRoute's VM injection + scaffold layering` (per-destination unit: default = new + mirror structure)
- `new (deviation): PdfGenerateViewModel hosted Activity-scoped inside CreateRoute to survive the conditional re-render and preserve in-flight state — stated exception to the per-destination default`
- `new: no sibling for PdfDocumentValidator — searched *Validator + *Pdf*` (first-of-its-kind)

If you skip a MANDATORY skill, miss a category, OR pick the wrong action for the category (e.g. reusing a VM across destinations), say so explicitly with a one-line reason. Silent skips AND silent miscategorization are the failure modes this gate exists to catch.

**AC-vs-environment check.** If the task's acceptance criteria require verification the agent can't run (emulator instrumentation, real ad SDK, paid API, multi-device, physical sensors), surface it explicitly here. Offer the user one of:
1. **Narrow scope** to what's testable locally; ship the gap as a follow-up.
2. **Stub harness** so the test compiles but flag the coverage gap in the PR body.
3. **Hand off** the verification to a human + flag in PR body.
Don't silently pick — the user can't see the trade-off otherwise.

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
2. **Simplify mini-pass** — apply `.claude/skills/code-simplification.md` to *only the staged/unstaged diff for this commit*. Branch-base for the diff is `git merge-base origin/main HEAD` (avoids confusion when a prior PR off the same branch was squash-merged). Targets:
   - Dead branches / unreachable code introduced in this commit
   - Defensive null-checks the type system already guarantees
   - Single-use helpers that could be inlined
   - Comments restating what the code already says
   - **Comment audit** — apply `.claude/skills/comment-discipline.md` to every comment in this commit's diff. The rules and examples live in that skill — this command does not restate them.
   - Verbose error-handling wrapping framework guarantees (e.g. `try/catch` around a non-throwing call)
   - **Before deleting state that crosses a system boundary** (server payload field, persisted DB column, ad-SDK callback id, analytics event property, idempotency key) — pause. Does anything outside this VM/class observe the value? If yes, deletion changes behaviour the local test suite can't see. Keep it or grep the boundary first.
3. **Tests + detekt + lint for the touched files** — `./gradlew testDebugUnitTest` green, no NEW detekt findings on files in this commit's diff, no NEW Android Lint findings on files in this commit's diff (`./gradlew lintDebug`). Detekt and Android Lint catch different classes of problems (`SuspiciousIndentation`, deprecated APIs, resource/layout bugs are lint-only). If a simplification required a test change, you changed behavior — **revert the simplification, not the test.**
4. **Doubt-driven check (conditional, anti-skip).** If this commit lands a non-trivial decision (new branching logic, cross-module change, thread-safety/idempotence claim, irreversible side-effect, public API signature change, deleting cross-boundary state), invoke `.claude/skills/doubt-driven-development.md` and reconcile findings BEFORE the commit. **Maintain a running decision log in the PR body** — for every decision in scope, paste either the subagent's reconciliation OR a one-line justification of why the decision didn't need adversarial review. If your decision log is empty at the end, it's wrong: you almost certainly made decisions and didn't surface them.
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
- [ ] **Decision log in PR body is non-empty if any non-trivial decision was made**, with subagent reconciliation OR one-line justification per entry. An empty log on a multi-decision PR is the failure mode (Phase 4 step 4)
- [ ] If any `@Composable` was touched, the relevant compose-* skill was read FIRST (not after), and the one-liner attesting to that read is in your Phase 1 self-attestation
- [ ] **Reuse scan (`reuse-before-you-build.md`) was completed for every new symbol** with the correct category default applied. A `reuse: …` / `extend: …` / `mirror: …` / `new (category default): …` / `new (deviation): … — justified` line per new symbol exists in the Phase 1 attestation. No category mistakes either way: no parallel re-implementation of a shared primitive (raw `ModalBottomSheet` vs the shared shell, ad-hoc polling vs an existing polling `UseCase`, redefined copy vs the shared copy object); AND no inappropriate cross-destination sharing (one `ViewModel` across unrelated routes, one VM's `sealed UiState` cloned into another VM, one screen composable hosting another's logic inline). Deviations from the bucket default are stated explicitly, not silent.
- [ ] Every changed line traces directly to the task (no scope creep)
- [ ] Commits use Conventional Commits format, one logical change each
- [ ] No deleted or weakened tests; no `@Ignore`/`@Disabled`/`@Suppress` added without commit-body justification (CLAUDE.md §5)

If any box is unchecked, do not stop. Address it.

---

# Hard rules (adapted for interactive mode)

Note: Phase 5 (full-suite verify) is part of "done" but lives between Phase 4 (per-commit loop) and Phase 6 (this checklist). The checklist below assumes Phase 5 passed.

- **Branch off `main` at task start.** If `main` is checked out, `git switch -c feat/issue-<N>-<slug>` (or `fix/<slug>` for a defect) before any commit. If on another non-default branch, ask before extending — it may belong to another task. Stay-on-main is the failure mode.
- **Push + open a PR at the end of Phase 7.** `git push -u origin <branch>` then `gh pr create --base main`. PR body includes the Phase 4 decision log. Return the PR URL to the user.
- **Never edit existing tests** under `**/test/`, `**/androidTest/`, `*Test.kt` unless the task explicitly asks. Adding new tests is encouraged.
- **Never edit files under `.github/`** — CODEOWNERS gates this anyway.
- **Never run destructive operations** — `rm -rf`, `git reset --hard`, `git push --force`, branch deletion of `main`. Don't propose them either.
- **If you genuinely cannot make progress**, surface the blocker explicitly to the user. Don't fake-finish.

---

# Stop condition

You're done when Phase 7's checklist is satisfied, the PR is open against `main` (URL returned to the user), and you've summarised in one or two sentences what changed and what's left.
