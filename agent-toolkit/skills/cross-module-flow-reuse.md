---
name: cross-module-flow-reuse
description: Before reimplementing a multi-step flow (claim-then-retry, login-then-fetch, upload-then-poll, ad-show-then-callback) in a new module, locate the existing implementation and make a deliberate copy / extract / delegate decision. Use when adding a feature in module B that mirrors flow X already implemented in module A — claim flows, retry loops, recovery paths, state machines with the same shape across surfaces.
---

# Cross-module flow reuse

When a new feature in module B mirrors a multi-step flow already implemented in module A, the cheap default is "copy the relevant lines and tweak". That's also the default that creates drift: six months later, modules A and B diverge in subtle ways (different retry budgets, different correlation-ID semantics, one calls analytics and the other doesn't), and a single bug fix lands in only one of them.

This skill forces a deliberate decision **before** the duplication exists.

## When to use

Triggers — any of these:

- You're about to implement a flow whose name you've seen elsewhere in the codebase: `claimRewardedUnlock`, `retryWithBackoff`, `pollUntilReady`, `resumeFromCheckpoint`, `migrateFromV1`.
- Your task description mentions parity with another surface: "match the topic-quiz behaviour", "same recovery as document upload", "mirror the daily-quiz flow".
- You're about to copy 20+ lines from another file into the one you're editing.
- A reviewer's question on an earlier PR was "doesn't module X already do this?"

## When NOT to use

- The flow is trivially small (< 10 lines).
- You're confident there's no analogous flow elsewhere (and you've actually looked — see step 1).
- The flows superficially look alike but the underlying semantics are genuinely different (different invariants, different consumers).

## The four-step gate

### Step 1 — Locate (cheap)

Spend ≤ 5 minutes searching for the existing impl before writing anything.

Methods in order of preference:
1. Search the codebase for the flow name and the domain noun using grep, find-references, or any code-search tool available. Find callers or importers of any obvious central function.
2. **Grep for the canonical action verb:** `claim`, `retry`, `poll`, `resume`. Even noisy results are useful — you're scanning for files that *look* like they own this flow.
3. **Grep for the matching domain exception or state type:** anywhere else it's caught or handled is a candidate implementation.

Output: a list of 0..N existing implementations. If 0, skip to step 4 (copy doesn't apply — you're the first). If ≥ 1, continue.

### Step 2 — Diff (cheap)

For each existing impl, write down the **shape** of the flow in 5-10 bullets:

```
Topic-quiz claim flow (QuizController.claimRewardedGenerationUnlock):
- mints clientRequestId + rewardEventId per call
- preserves them in pendingRewardUnlockRequest across retries
- on success: copies token into request, re-fires generate
- emits analytics events: ClaimStarted, ClaimSucceeded, ClaimFailed
- mutates LimitReached.isUnlockingReward for in-flight feedback
- error states surface inline in LimitReached.message
```

Then write the shape of what you're about to build. Compare.

What's the same? What's different — and **why**? The differences are the load-bearing question.

### Step 3 — Decide: copy / extract / delegate

Three valid choices. Each has a real cost; pick deliberately.

| Choice | Pick when | Cost |
|---|---|---|
| **Copy with simplifications** | Differences are large (analytics requirements differ, state shapes differ, lifecycles differ) AND you'd be cargo-culting unused complexity by importing | Drift risk — record the divergence in the new code's commit body so future readers know they're separate-by-design |
| **Extract to shared use-case / helper** | Differences are small AND both surfaces will want bug fixes to propagate | Up-front refactoring cost on module A; need 2+ real consumers before pulling the trigger (Metz's rule of 3 — wait for the third) |
| **Delegate to the existing impl** | Module B can call into module A's public surface directly with minimal adaptation | Coupling module B → module A; only viable if A's impl is already public-facing |

**Record the choice in the PR body.** Example:

> *Decision: copy-with-simplifications.* `DocumentController.claimAndRetry` mirrors `QuizController.claimRewardedGenerationUnlock` but intentionally omits analytics (Phase 5) and pending-request preservation (loop-back-after-token-consumed semantics differ). Reviewers should treat the two as separate-by-design until a third caller appears.

This is the artefact that prevents the six-months-later "wait, why are these subtly different?" archaeology session.

### Step 4 — Implement + cross-link

Whichever path you took:

- **Copy:** add a one-line comment at the new impl pointing at the original. `// Mirrors QuizController.claimRewardedGenerationUnlock; see PR #N for divergence rationale.`
- **Extract:** the new shared helper gets a doc-comment listing both callers. Each caller's commit message points at the helper.
- **Delegate:** the new caller imports the existing impl. Add a comment explaining why this surface depends on the other (coupling is non-obvious from imports alone).

## Anti-patterns

| Anti-pattern | Why it's wrong |
|---|---|
| **Silent copy** (no comment, no PR-body note) | Future readers can't tell intentional copy from accidental drift |
| **Premature extract** | Extracting after the second caller often picks the wrong abstraction. Wait for caller #3 (Metz's rule of 3). |
| **Delegate-then-monkey-patch** | If you delegate to module A but then mutate state belonging to it, you've created an invisible coupling. Either delegate fully or copy. |
| **"I'll align them in a follow-up PR"** | The follow-up PR doesn't happen. The drift compounds. Align now or commit to copy-with-rationale. |

## Pairs with other skills

- `reuse-before-you-build.md` — the symbol-level sibling of this skill. Cheap default that runs on every new symbol (component, controller/view-model, value type/DTO, copy constant, test fake). This skill takes over when the invention is a multi-step flow at 20+ lines and the copy/extract/delegate choice needs deliberate weighing.
- `refactoring-strategy.md` — when the "extract" choice is real, treat it as cross-module work (impact radius, parallel change).
- `code-simplification.md` — the new impl's simplify pass should preserve the divergence justifications, not delete them as "obvious comments".
- `doubt-driven-development.md` — the copy/extract/delegate decision is exactly the kind of non-trivial decision that should pass the adversarial-subagent check.
