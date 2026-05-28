---
name: reuse-before-you-build
description: Before introducing any new symbol — composable, ViewModel, UseCase, repository method, DTO, sealed UiState, Hilt binding, navigation route, copy constant, test tag, theme token, error mapper, formatter, test fake, analytics event — scan for an existing sibling and apply the CORRECT default for the category (reuse for shared primitives; mirror for pattern-instance composables; new-per-destination for ViewModels/screens/per-VM sealed states). Use BEFORE writing the symbol. Pairs with cross-module-flow-reuse.md (which handles multi-step flow deliberation at 20+ lines).
---

# Reuse before you build

**Scan for siblings before introducing ANY new symbol.** Silent invention — adding a parallel implementation without first looking — is the failure mode this skill catches.

The principle is **not** "reuse everything you find". Some categories want reuse (shared primitives, copy, UseCases, DTOs). Some want mirroring (a new sheet built as a structural sibling of an existing one). Some want a genuinely new instance per route (ViewModels per destination, screen composables per route, per-VM sealed UI states). Picking the wrong action — reusing where you should have created new, or inventing where you should have reused — both ship the wrong choice for the category.

This skill is the cheap, ubiquitous default — runs every time you reach for `class`, `fun`, `object`, `@Composable`, `data class`, `const val`. The `cross-module-flow-reuse.md` skill is the expensive sibling — runs when you're about to copy a multi-step flow (claim-then-retry, upload-then-poll, login-then-fetch) at 20+ lines. Most invention happens below that threshold and silently compounds.

## When to use

Trigger this skill whenever your next planned action is "create a new …" in any of the categories below. The **default action** column tells you what to do when a sibling exists:

| Sub-category | Examples | Default when sibling exists | Anti-pattern |
|---|---|---|---|
| Shared UI primitives | `AppPrimaryButton`, `BottomSheetPrimaryAction`, `BottomSheetDeferredAction`, `BottomSheetHeader`, sheet shells | **REUSE** | Re-implementing the primitive |
| Pattern-instance composables | sheets / dialogs / cards built FROM the primitives (e.g. `DailyLimitSheet`, `GuestUpgradeSheet`) | **MIRROR** for a sibling use case (new instance, same shell + primitives + header pattern); **REUSE** if the existing one literally fits the new caller | Plain `ModalBottomSheet` when a shared shell exists; new sheet that looks meaningfully different from its closest sibling without a stated reason |
| Screen composables | `*Route`, `*Screen` (per navigation destination) | **NEW per route** — mirror the existing screen's layering (VM injection, scaffold choice, state hoisting) but do NOT host one screen's logic inside another's composable | Two routes sharing one screen composable; one route's logic inlined into another's scaffold |
| ViewModels | per-destination `*ViewModel` | **NEW per destination** + mirror the existing VM's UseCase/Flow/scope conventions | Sharing one VM across unrelated nav destinations. Rare exceptions (Activity-scoped helpers; a VM intentionally shared to survive a conditional re-render in a parent route) require an explicit one-line justification |
| UseCases | `*UseCase` for polling, retry, claim flows, error mapping | **REUSE** or **EXTEND** with a parameter | Cloning the polling/retry logic in a parallel UseCase |
| Repository methods | data-layer functions | **REUSE** or **EXTEND** | Adding a parallel method with slightly different semantics |
| DTOs / domain models | wire and domain shapes | **REUSE** (same wire contract = same DTO) | Cloning with a slightly different field name; domain-specific variant of a generic shape |
| Sealed UI states | per-VM state types | **NEW per VM** in most cases. Share a base ONLY for genuinely cross-cutting concepts (auth state, generic loading wrappers) | Sharing one VM's `UiState` across two VMs (couples lifecycles); cloning the same `sealed class Loading/Success/Error` across many VMs (use a shared base) |
| Hilt bindings | `@Provides` / `@Binds` | **EXTEND** the closest relevant `@Module` | New `@Module` per binding |
| Copy / test tags / theme tokens / route keys / analytics events | shared constants | **REUSE** | Re-defining the literal |
| Error mappers / formatters | exception → message, value → display string | **REUSE** or **EXTEND** | Re-mapping the same exception inline |
| Test scaffolding | fakes, fixtures, builders, JUnit rules, Compose test rules | **REUSE** or **EXTEND a base** | Hand-rolling state per test class |

The four mental buckets (compressed): **shared primitives** (REUSE/EXTEND), **pattern-instance composables** (MIRROR), **per-destination units** (NEW per route + mirror structure), **first-of-its-kind** (NEW after search confirms).

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

### Step 3 — Apply the category's default action

The category determines the default. The four valid actions:

| Action | Pick when | Cost |
|---|---|---|
| **Reuse** | The existing symbol satisfies the new requirement as-is. Default for shared primitives + copy + UseCases + DTOs + tokens + test fakes + error mappers | None — just use it |
| **Extend** | The existing symbol needs a small backwards-compatible parameter / branch to cover the new case | Touches the existing surface; verify no caller breaks |
| **Mirror** | A new symbol must exist (different domain, different lifecycle) but should look like a structural sibling — same shell + primitives + shape. Default for pattern-instance composables. Also the right answer when creating a new VM/screen — mirror the *structure* of an existing peer, not its instance | New file/symbol; risk is drift if the original later evolves |
| **New** | Two cases: (a) no sibling exists at all (genuinely first-of-its-kind — set precedent); (b) the per-destination bucket default — each route owns its own ViewModel, screen composable, and per-VM sealed UiState. In case (b) you're "new" relative to other destinations but you still mirror the existing peer's structure | (a) Highest — you're setting precedent. (b) Low — bucket default |

**Reusing where the bucket default is NEW is just as wrong as inventing where the bucket default is REUSE.** Sharing a ViewModel across unrelated nav destinations couples lifecycles. Cloning a sealed UiState into another VM couples state surfaces that should evolve independently. Hosting one screen's logic inside another's composable bypasses the navigation system. Each of these is a misapplication of "reuse".

Record the choice **before writing the code** (commit body or PR description). Examples spanning all four buckets:

> *reuse:* `SharedCopy.NOT_NOW` (shared primitive: bucket default = reuse).
>
> *extend:* `TodaysQuizPollingUseCase` — the new PDF case slots in via the existing `PollingPolicy` enum; no new orchestration logic.
>
> *mirror:* `PdfRewardedUnlockSheet` mirrors `DailyLimitSheet` — same shared sheet shell, same `BottomSheetPrimaryAction` + `BottomSheetDeferredAction` pair, same icon-tinted-card header (pattern-instance composable: bucket default = mirror).
>
> *new (category default):* `PdfGenerateScreen` is a new screen composable per route; mirrors `CreateRoute`'s VM injection + scaffold layering (per-destination unit: bucket default = new + mirror structure).
>
> *new (deviation):* `PdfGenerateViewModel` is hosted Activity-scoped inside `CreateRoute` to survive the conditional re-render and preserve in-flight upload state — stated exception to the per-destination default.
>
> *new:* `PdfDocumentValidator` — searched for `*Validator`, `*Pdf*Check`, and `*FileGuard` across the graph; no sibling exists. Setting precedent (first-of-its-kind).

The artefact is what prevents the "wait, why are these subtly different?" archaeology session three months later — AND the "wait, why is this VM shared across two flows?" lifecycle bug six months later.

### Step 4 — Implement + cross-link

- **Reuse:** import and call it. Done.
- **Extend:** make the surface change minimal (default-valued parameter, additive enum case). Existing callers compile without edits.
- **Mirror:** add a one-line code comment at the new symbol pointing at the original. `// Mirrors DailyLimitReachedBottomSheet — see PR #N for the rationale.`
- **New:** if you genuinely had no sibling, the new symbol is now the precedent. Name it well, document its role, and expect the next "new feature" to mirror you.

## Red flags

Two failure modes, equally bad:

**A. Inventing where you should have reused (shared-primitive bucket):**

| Anti-pattern | Why it's wrong |
|---|---|
| Plain `ModalBottomSheet` when your shared sheet shell exists | Bypasses every accumulated UX/dismiss/inset decision baked into the shell |
| Raw button pair inside a sheet when your `BottomSheet*Action` primitives exist | Primitives encode tone, spacing, and a11y choices |
| New `*UseCase` re-implementing a polling/retry recipe that an existing `*UseCase` already encodes | Two divergent recipes = two divergent bug surfaces |
| New DTO field with a slightly different name than an equivalent on a sibling DTO | Aligning shapes downstream prevents mapper bloat |
| New copy constant when the shared copy object already has it | Translation/branding/A-B-test pipelines silently bypass the new constant |
| Custom `try/catch` mapping an exception that an existing error-mapper handles | Future error UX lives at the mapper's call site — you just split the home |

**B. Reusing where you should have created new (per-destination bucket):**

| Anti-pattern | Why it's wrong |
|---|---|
| One ViewModel shared across two unrelated nav destinations (silent, no justification) | Couples lifecycles; one destination's state pollutes the other. Activity-scoped sharing is sometimes the right answer — but only with stated rationale |
| Sealed `UiState` cloned identically across multiple VMs that aren't structurally related | Either share a base (cross-cutting concept) OR genuinely diverge the per-VM types — silent cloning is the failure mode |
| New screen composable that hosts another screen's logic inline instead of navigating to it | Bypasses the navigation stack, breaks back-handling, couples scaffolds |
| "Extracting" a base class from two VMs that happen to look alike but model different domains | False-DRY — the parent class becomes an attractor for unrelated logic over time |

**Cross-cutting:**

| Anti-pattern | Why it's wrong |
|---|---|
| A new symbol meaningfully different from its closest sibling without a stated reason | Reviewers can't tell intentional divergence from accidental — and neither can you in six months |
| **Silent invention OR silent miscategorization** — no commit-body line, no PR note | The failure modes this skill exists to catch. Both are equally bad: shipping the wrong action for the category |

## Pairs with other skills

- **`cross-module-flow-reuse.md`** — when the invention is a multi-step flow (claim-then-retry, upload-then-poll, recovery state machine) at 20+ lines, escalate to the four-step copy/extract/delegate gate there. This skill is the symbol-level default; that one is the flow-level deliberation.
- **`refactoring-strategy.md`** — when "extract" is the right choice but it requires modifying the original symbol, treat it as cross-module refactoring (impact radius, parallel change).
- **`code-simplification.md`** — the simplify pass should not delete the `reuse: …` / `mirror: …` rationale as an "obvious comment"; it's load-bearing.
- **`doubt-driven-development.md`** — if the decision is non-trivial (mirror vs new on a high-stakes symbol), the adversarial-subagent check applies.
