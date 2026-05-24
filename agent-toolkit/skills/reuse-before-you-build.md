---
name: reuse-before-you-build
description: Before introducing any new symbol — composable, ViewModel, UseCase, repository method, DTO, sealed UiState, Hilt binding, navigation route, copy constant, test tag, theme token, error mapper, formatter, test fake, analytics event — scan for an existing sibling and decide reuse / extend / mirror / new. Use this BEFORE writing the symbol, not after. Pairs with cross-module-flow-reuse.md (which handles multi-step flow deliberation at 20+ lines).
---

# Reuse before you build

**Every new symbol is tech debt until proven otherwise.** Before introducing one, prove no reusable version already exists in this codebase.

This skill is the cheap, ubiquitous default — runs every time you reach for `class`, `fun`, `object`, `@Composable`, `data class`, `const val`. The `cross-module-flow-reuse.md` skill is the expensive sibling — runs when you're about to copy a multi-step flow (claim-then-retry, upload-then-poll, login-then-fetch) at 20+ lines. Most invention happens below that threshold and silently compounds.

## When to use

Trigger this skill whenever your next planned action is "create a new …":

| Category | Examples |
|---|---|
| Composables | screens, sheets, dialogs, cards, scaffolds, modifiers |
| State holders | ViewModels, UseCases, sealed UiStates, state machines |
| Data/contracts | DTOs, domain models, Hilt bindings, sealed errors |
| Behavior recipes | polling loops, retry policies, error mapping, dispatcher choices, Flow operator chains |
| Constants | copy strings, test tags, theme tokens, route keys, analytics event names |
| Test scaffolding | fakes, fixtures, builders, JUnit rules, Compose test rules |

If your task touches any of these, you owe a scan.

## When NOT to use

- The symbol is genuinely first-of-its-kind for this domain (you've actually looked — see step 1).
- You're modifying an existing symbol in place, not adding a new one.
- The new symbol is a one-line private helper inside a single function and won't outlive that function.

## The four-step gate

### Step 1 — Locate (cheap)

Spend ≤ 5 minutes searching for the existing impl before writing anything.

Methods in order of preference:

1. **Graph query** (if a code-review-graph MCP is available): `semantic_search_nodes` for the domain noun + likely suffix (`*Sheet`, `*ViewModel`, `*UseCase`, `*Repository`, `*Dto`, `*Mapper`, `*Card`, `*Scaffold`, `*Validator`, `*Formatter`). `query_graph(pattern=callers_of)` or `imports_of` on the closest neighbor to see how it's typically extended.
2. **Grep the canonical homes** for your category:
   - Composables → your shared components / screens directory
   - State holders → your `usecase/` and `viewmodel/` packages
   - DTOs / models → your `data/remote/dto/` and `domain/model/` packages
   - Constants → your shared `copy/` object, test-tags object, theme tokens file, navigation-route enum
   - Test scaffolding → your `test/` and `androidTest/` trees for existing fakes
   - Hilt bindings → all `@Module` files for an existing `@Provides`/`@Binds` of the same return type
3. **Grep for the matching domain noun** — even noisy results are useful. If you're about to write `PdfDocumentValidator`, grep for `*Validator` and `*Pdf*`. If you're about to add a `"Not now"` string, grep for it as a literal across `**/*.kt`.

Output: 0..N existing implementations or near-siblings. If 0, skip to step 4. If ≥ 1, continue.

### Step 2 — Diff (cheap)

For each candidate, write the **shape** of the existing symbol in 3-6 bullets:

```
DailyLimitReachedBottomSheet (library-compose/.../screens/):
- shell: QuizGenBottomSheet (not raw ModalBottomSheet)
- primitives: BottomSheetPrimaryAction + BottomSheetDeferredAction
- header: icon-in-tinted-card + bold emoji title + body copy
- info row: Card(containerColor = primary.copy(alpha = 0.06f)) with label + value
- helper text: "Ads help keep QuizGen free." centered, 62% alpha
```

Then write the shape of what you're about to build. Compare:

- **What's the same?** → reuse / extend / mirror it.
- **What's different — and why?** The differences are the load-bearing question.

### Step 3 — Decide: reuse, extend, mirror, or new

Four valid choices. Pick the leftmost that fits.

| Choice | Pick when | Cost |
|---|---|---|
| **Reuse** | The existing symbol satisfies the new requirement as-is | None — just use it |
| **Extend** | The existing symbol needs a small backwards-compatible parameter / branch to cover the new case | Touches the existing surface; verify no caller breaks |
| **Mirror** | A new symbol must exist (different domain, different lifecycle, different owner) but should look like a structural sibling of the existing one — same shell, same primitives, same shape | New file/symbol; risk is drift if the original later evolves |
| **New** | No sibling exists; you've searched and the category is genuinely first-of-its-kind in this repo | Highest — you're setting precedent for the next person |

Record the choice **before writing the code** (commit body or PR description):

> *reuse:* `SharedCopy.NOT_NOW` already exists for the secondary-dismiss CTA on every sheet.
>
> *extend:* `TodaysQuizPollingUseCase` — the new PDF polling case slots in via an existing `PollingPolicy` enum; no new orchestration logic needed.
>
> *mirror:* `PdfRewardedUnlockBottomSheet` mirrors `DailyLimitReachedBottomSheet` — same `QuizGenBottomSheet` shell, same `BottomSheetPrimaryAction` + `BottomSheetDeferredAction` pair, same icon-tinted-card header.
>
> *new:* `PdfDocumentValidator` — searched for `*Validator`, `*Pdf*Check`, and `*FileGuard` across the graph; no sibling exists. Setting precedent.

The artefact is what prevents the "wait, why are these subtly different?" archaeology session three months later.

### Step 4 — Implement + cross-link

- **Reuse:** import and call it. Done.
- **Extend:** make the surface change minimal (default-valued parameter, additive enum case). Existing callers compile without edits.
- **Mirror:** add a one-line code comment at the new symbol pointing at the original. `// Mirrors DailyLimitReachedBottomSheet — see PR #N for the rationale.`
- **New:** if you genuinely had no sibling, the new symbol is now the precedent. Name it well, document its role, and expect the next "new feature" to mirror you.

## Red flags

| Anti-pattern | Why it's wrong |
|---|---|
| Plain `ModalBottomSheet` when your shared sheet shell exists | You bypassed every accumulated UX/dismiss/inset decision baked into the shell |
| Raw button pair inside a sheet when your `BottomSheet*Action` primitives exist | Same — primitives encode tone, spacing, and a11y choices |
| New `*UseCase` re-implementing a polling/retry recipe that an existing `*UseCase` already encodes | Two divergent recipes is two divergent bug surfaces |
| New DTO field with a slightly different name than an equivalent on a sibling DTO | The server contract is the server's; aligning shapes downstream prevents mapper bloat |
| New copy constant when the shared copy object already has it | Translation/branding/A-B-test pipelines bypass the new constant silently |
| Custom `try/catch` mapping an exception that an existing error-mapper already handles | The error-mapper's call site is where future error UX lives; you just split the home |
| A new symbol that looks meaningfully different from its closest sibling without a stated reason | Reviewers can't tell intentional divergence from accidental — and neither can you in six months |
| **Silent invention** — no commit-body line, no PR-description note | The failure mode this skill exists to catch |

## Pairs with other skills

- **`cross-module-flow-reuse.md`** — when the invention is a multi-step flow (claim-then-retry, upload-then-poll, recovery state machine) at 20+ lines, escalate to the four-step copy/extract/delegate gate there. This skill is the symbol-level default; that one is the flow-level deliberation.
- **`refactoring-strategy.md`** — when "extract" is the right choice but it requires modifying the original symbol, treat it as cross-module refactoring (impact radius, parallel change).
- **`code-simplification.md`** — the simplify pass should not delete the `reuse: …` / `mirror: …` rationale as an "obvious comment"; it's load-bearing.
- **`doubt-driven-development.md`** — if the decision is non-trivial (mirror vs new on a high-stakes symbol), the adversarial-subagent check applies.
