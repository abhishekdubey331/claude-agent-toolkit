---
description: Implement a task using the project's full implementer workflow — TDD-first, all relevant skills loaded, simplify pass, verify gate, conventional commits. Self-contained — does not rely on you reading the canonical pipeline workflow.
argument-hint: <task description, e.g. "add swipe-to-dismiss to result screen">
---

You are taking on an interactive implementation task using this repo's full implementer discipline, driven by the user in real time. Its full workflow is inlined below; you don't need any external pipeline files.

**Task:**

$ARGUMENTS

---

# Phase 0 — Mandatory reads (do not skip)

Before you write a single character of code:

1. **`CLAUDE.md`** at the repo root. If your repo's `CLAUDE.md` defines named sections (e.g. Simplicity First, Surgical Changes, Bug-Fix Discipline, source precedence), honor them — those sections gate every line you write. If no such sections exist, apply the principles by spirit: keep changes minimal, prefer existing patterns, and treat defect tasks with extra rigor.
2. **`REVIEW.md`** (or equivalent review-rubric file) at the repo root, if one exists. The sections defining what constitutes a real defect and the "always check" list define the bar your change must clear.

If you read these earlier this session and they haven't changed, say so and skip — **do not re-read**. Otherwise read them now; they're non-negotiable when the files exist.

---

# Phase 1 — Plan + skill routing

Decide which skills your task needs based on its shape. **Load a conditional skill the moment its trigger fires — not all up front.** The one exception: read `code-simplification` + `comment-discipline` up front, since Phase 4 applies them on every commit.

## Reuse scan — MANDATORY before introducing any new symbol

The principle is **scan first**, not "reuse everything". The correct action depends on the category — some want reuse, some want mirror, some want new-per-feature with mirrored structure. Full skill: the `reuse-before-you-build` skill (per-category table + four-step gate; its **flow-level escalation** section covers multi-step flows at 20+ lines).

Quick mental model — the four buckets and their defaults:

| Bucket | Examples | Default when a sibling exists |
|---|---|---|
| **Shared primitives** | utilities/helpers, value types & DTOs, shared UI primitives, constants/strings/tokens, error mappers, formatters, test fakes/builders | **REUSE / EXTEND** |
| **Pattern-instance components** | things built FROM the primitives following an existing template (dialogs, cards, forms, list rows, request handlers) | **MIRROR** an existing sibling |
| **Per-feature / per-route units** | a feature's entry point/screen, its controller/view-model/presenter, its local state type | **NEW per feature** + mirror structure only |
| **First-of-its-kind** | no precedent in the codebase | **NEW** (setting precedent) |

The two equally-bad failure modes: inventing where you should reuse (shared-primitive bucket); over-sharing where you should create new (per-feature bucket — one controller/view-model across unrelated features, a state type cloned across unrelated units).

Procedure:
1. **Search the codebase for the symbol and its callers** (grep / your editor's find-references / a code-search tool). Search for the domain noun plus likely suffixes. Walk canonical homes for your category (shared components, utilities, data-transfer types, domain models, shared constants/copy, test fakes, dependency-injection modules, navigation/routing definitions).
2. **Identify the bucket** (one of the four above). The bucket determines the default.
3. **Apply the default UNLESS you have a stated reason to deviate.** Deviations are legitimate — but they must be stated, not silent.
4. **Attest before Phase 2.** One line per new symbol: `reuse: …` / `extend: …` / `mirror: … (category default = mirror)` / `new (category default): …` / `new (deviation): … — justified because …` / `new: no sibling found — searched X, Y, Z`.

If you cannot find a sibling in the shared-primitive bucket, that's a signal to ASK the user (Phase 1 ends with a user check anyway), not to invent. If you're in the per-feature bucket and NEW is the default, no question needed — just attest the bucket and the mirroring decision.

## Process skills — load on trigger

- the **`incremental-implementation`** skill — REQUIRED if task touches >1 file or you expect to write ~100+ lines before the first test runs. Forces thin vertical slices, one logical change per commit, build green between slices.
- the **`debugging-and-error-recovery`** skill — REQUIRED if this is a defect with a stack trace, repro, or unexpected behavior. Six-step triage: Reproduce → Localize → Reduce → Fix → Guard → Verify. Don't ship symptom-patches; this skill is how you avoid that.
- the **`doubt-driven-development`** skill — OPTIONAL, reserved for genuinely high-stakes calls: an irreversible/destructive side-effect, a hard-to-reverse public-API or schema change, or a concurrency/idempotence guarantee a test can't cover. For those, spawn a fresh-context adversarial reviewer. **Do not** run it on routine commits — a passing test is the cheaper, stronger signal, and per-commit adversarial reviews are the biggest avoidable token cost in this workflow.
- the **`code-simplification`** skill AND the **`comment-discipline`** skill — load BOTH now, once. Phase 4 applies them as a checklist before every commit — **do not re-invoke these skills per commit** (re-loading them each commit is a top avoidable token cost).

## Framework-specific skills

If your project ships framework-specific skills (state management, rendering, concurrency, etc.), load the ones matching the code you're touching, before writing code.

## Repo-specific complementary skills

If your repo ships explore / debug / refactor / review skills, invoke the relevant one on demand — skip if absent.

After Phase 1, state to the user (briefly): which skills you loaded, and what your plan is. **Ask clarifying questions if the task is ambiguous.** The headless pipeline can't; you can.

**Attestation (keep it terse — a guardrail, not a deliverable).** Before Phase 2, jot **one short line per new symbol** naming its bucket and your choice (`reuse:` / `extend:` / `mirror:` / `new:` — e.g. `new: PdfDocumentValidator — no sibling found, searched *Validator + *Pdf*`), and **one short line for any skill you loaded**. If you skipped a relevant skill or weren't sure of a symbol's bucket, say so in a few words. Don't expand this into paragraphs — its only job is to make a silent skip or miscategorization visible.

**AC-vs-environment check.** If the task's acceptance criteria require verification the agent can't run (device/emulator instrumentation, real external service, paid API, multi-device, physical sensors), surface it explicitly here. Offer the user one of:
1. **Narrow scope** to what's testable locally; ship the gap as a follow-up.
2. **Stub harness** so the test compiles but flag the coverage gap in the PR body.
3. **Hand off** the verification to a human + flag in PR body.
Don't silently pick — the user can't see the trade-off otherwise.

---

# Phase 2 — TDD: write failing tests FIRST

This is non-negotiable. Don't write implementation before you have a failing test that captures the acceptance criteria.

- **Unit tests** → typically under `**/test/`, `*Test.*`, `*_test.*`, `*.test.*`, or `tests/` — run via the project's test command.
- **Snapshot / UI rendering tests** — one snapshot per distinct visible state (use whatever snapshot framework the project provides).
- **Integration / end-to-end tests needing a running service or device** → flag if this is the only verification path; cannot run purely locally.
- **Concurrency / timing tests** → use a controlled scheduler or fake clock — never real sleeps.

If the task is a defect and you CAN'T write a failing test (production-only, requires a live service, etc.): **STOP. Do not ship a fix.** Tell the user what's blocking the repro.

---

# Phase 3 — Run the tests, confirm they fail for the right reason

Not just "fail" — fail for the reason your task implies. A test that fails because of a compile error doesn't count. A test that fails for a different reason than expected means the test is wrong, not the implementation.

---

# Phase 4 — Implement (per-commit loop: code → simplify → tests → commit)

For each logical change you're about to commit, run this loop. **Do NOT batch commits at the end of the task.** Every commit must ship simplified code; no "we'll clean up later" passes.

**Per-commit loop:**

1. **Code** — write the minimum code that makes the failing test (or this commit's scope) pass.
2. **Simplify mini-pass** — apply the simplify + comment checklist you loaded in Phase 1, **from memory (do not re-invoke the skills)**, to *only the staged/unstaged diff for this commit* (branch-base `git merge-base origin/main HEAD`). Targets:
   - Dead branches / unreachable code introduced in this commit
   - Defensive null-checks the type system already guarantees
   - Single-use helpers that could be inlined
   - Comments restating what the code already says
   - **Comment audit** — apply the `comment-discipline` rules (loaded in Phase 1) to every comment in this commit's diff.
   - Verbose error-handling wrapping framework guarantees
   - **Before deleting state that crosses a system boundary** (server payload field, persisted database column, external-SDK callback id, analytics event property, idempotency key) — pause. Does anything outside this module observe the value? If yes, deletion changes behaviour the local test suite can't see. Keep it or search the boundary first.
3. **Run the focused test(s) for this commit's change** — the test(s) covering the code you just touched must be green. Don't re-run the whole suite or the linters on every commit; the full suite + static analysis run once in Phase 5. If a simplification required a test change, you changed behavior — **revert the simplification, not the test.**
4. **Commit** — Conventional Commits format: `feat(quiz): ...`, `fix(ui): ...`, `test(streak): ...`, `refactor(data): ...`. Subject ≤ 60 chars; body explains the *why* if non-obvious.

**General discipline:**
- One logical change per commit.
- Match existing patterns. Don't invent abstractions.
- Don't refactor adjacent code outside the diff.

---

# Phase 5 — Full-suite verify (after the last commit)

After your final commit, run the **full** gate one more time as a sanity check:

- Run the full test suite — all green.
- Run the linter / static-analysis check — no NEW findings on files you touched.
- Run the type checker (if the language has one) — no NEW findings on files you touched.

Per-commit simplify already cleaned each diff slice, but this catches anything cross-commit (e.g. an import added in commit 1 that became unused after commit 3). If anything is unclean, fix in a final `chore: cleanup post-implement` commit — itself subjected to the per-commit loop above.

---

# Phase 6 — Final pre-stop checklist

Confirm these silently (don't echo them back):

- [ ] All acceptance criteria are met
- [ ] Full test suite + linter green on touched files (Phase 5)
- [ ] Simplify mini-pass ran before every commit; tests stayed green
- [ ] No deleted or weakened tests; no skip/ignore/suppress added without a commit-body reason
- [ ] Reuse scan done — one attestation line per new symbol (Phase 1)
- [ ] Branched off `main`; PR opened against `main`

If any box is unchecked, do not stop. Address it.

---

# Hard rules (adapted for interactive mode)

Note: Phase 5 (full-suite verify) is part of "done" but lives between Phase 4 (per-commit loop) and Phase 6 (this checklist). The checklist below assumes Phase 5 passed.

- **Branch off `main` at task start.** If `main` is checked out, `git switch -c feat/issue-<N>-<slug>` (or `fix/<slug>` for a defect) before any commit. If on another non-default branch, ask before extending — it may belong to another task. Stay-on-main is the failure mode.
- **Push + open a PR after Phase 6.** `git push -u origin <branch>` then open a PR against `main` (e.g. `gh pr create --base main`). Return the PR URL to the user. Keep the PR body to four short sections so a reviewer can target their attention:
  - **Intent** — what this set out to do, plus any deliberate decision a diff-reader would otherwise misread as a mistake (a knowingly-removed guard, an intentional API change). Fold in the outcome of the optional high-stakes (doubt-driven) check here, if you ran one.
  - **What changed** — 1–3 bullets.
  - **Risk** — `low` / `medium` / `high`, one line why (blast radius, reversibility). Reviewers spend time proportional to this.
  - **Testing** — what you ran + any evidence; flag anything you couldn't verify.
- **Never edit existing tests** under `**/test/`, `*Test.*`, `*_test.*`, `*.test.*`, `tests/` unless the task explicitly asks. Adding new tests is encouraged.
- **Never edit files under `.github/`** — CODEOWNERS gates this anyway.
- **Never run destructive operations** — `rm -rf`, `git reset --hard`, `git push --force`, branch deletion of `main`. Don't propose them either.
- **If you genuinely cannot make progress**, surface the blocker explicitly to the user. Don't fake-finish.

---

# Stop condition

You're done when Phase 6's checklist is satisfied, the PR is open against `main` (URL returned to the user), and you've summarised in one or two sentences what changed and what's left.
