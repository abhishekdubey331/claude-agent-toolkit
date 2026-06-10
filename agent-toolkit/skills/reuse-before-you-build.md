---
name: reuse-before-you-build
description: Before introducing any new symbol — component, view-model/controller/presenter, use-case/interactor, repository method, value type/DTO, state type, dependency binding, navigation route, copy constant, test tag, design token, error mapper, formatter, test fake/fixture/builder — scan for an existing sibling and apply the CORRECT default for the category (reuse for shared primitives; mirror for pattern-instance components; new-per-feature for controllers/view-models/per-feature state types). Use BEFORE writing the symbol. Multi-step flows (20+ lines) get the same gate — see the Flow-level escalation section.
---

# Reuse before you build

**Scan for siblings before introducing ANY new symbol.** Silent invention — adding a parallel implementation without first looking — is the failure mode this skill catches.

The principle is **not** "reuse everything you find". Some categories want reuse (shared primitives, copy, use-cases, value types/DTOs). Some want mirroring (a new dialog built as a structural sibling of an existing one). Some want a genuinely new instance per feature (controllers/view-models per feature, screen entry points per route, per-feature state types). Picking the wrong action — reusing where you should have created new, or inventing where you should have reused — both ship the wrong choice for the category.

This gate runs every time you reach for a new class, function, constant, type, or component definition. It also covers the expensive case — copying a multi-step flow (claim-then-retry, upload-then-poll, login-then-fetch) at 20+ lines — in the Flow-level escalation section below. Most invention happens below that threshold and silently compounds.

## When to use

Trigger this skill whenever your next planned action is "create a new …" in any of the categories below. The **default action** column tells you what to do when a sibling exists:

| Sub-category | Examples | Default when sibling exists | Anti-pattern |
|---|---|---|---|
| Shared UI primitives | shared button components, shared dialog/sheet shell, shared action primitives, shared header components | **REUSE** | Re-implementing the primitive |
| Pattern-instance components | dialogs / sheets / cards / forms built FROM the primitives (e.g. a limit-reached dialog, an upgrade prompt sheet) | **MIRROR** for a sibling use case (new instance, same shell + primitives + header pattern); **REUSE** if the existing one literally fits the new caller | Raw platform dialog when a shared shell exists; new component that looks meaningfully different from its closest sibling without a stated reason |
| Screen / page entry points | per-route or per-destination entry point components | **NEW per route** — mirror the existing entry point's layering (controller injection, scaffold/layout choice, state hoisting) but do NOT host one screen's logic inside another's component | Two routes sharing one entry-point component; one route's logic inlined into another's layout |
| Controllers / view-models / presenters | per-feature state holders | **NEW per feature** + mirror the existing peer's use-case/stream/lifecycle conventions | Sharing one controller across unrelated features. Rare exceptions (a controller intentionally shared to survive a conditional re-render in a parent route) require an explicit one-line justification |
| Use-cases / interactors | orchestration for polling, retry, claim flows, error mapping | **REUSE** or **EXTEND** with a parameter | Cloning the polling/retry logic in a parallel use-case |
| Repository / data-source methods | data-layer functions | **REUSE** or **EXTEND** | Adding a parallel method with slightly different semantics |
| Value types / DTOs / domain models | wire and domain shapes | **REUSE** (same wire contract = same type) | Cloning with a slightly different field name; domain-specific variant of a generic shape |
| Per-feature state types | state types scoped to a single controller/view-model | **NEW per controller** in most cases. Share a base ONLY for genuinely cross-cutting concepts (auth state, generic loading wrappers) | Sharing one controller's state type across two controllers (couples lifecycles); cloning the same `Loading/Success/Error` shape across many controllers (use a shared base) |
| Dependency bindings / DI config | `@Provides` / `@Binds` / provider functions | **EXTEND** the closest relevant module/container | New module per binding |
| Copy / test tags / design tokens / route keys / analytics events | shared constants | **REUSE** | Re-defining the literal |
| Error mappers / formatters | exception → message, value → display string | **REUSE** or **EXTEND** | Re-mapping the same exception inline |
| Test scaffolding | fakes, fixtures, builders, test rules, test helpers | **REUSE** or **EXTEND a base** | Hand-rolling state per test class |

The four mental buckets (compressed): **shared primitives** (REUSE/EXTEND), **pattern-instance components** (MIRROR), **per-feature units** (NEW per feature + mirror structure), **first-of-its-kind** (NEW after search confirms).

## When NOT to use

- The symbol is genuinely first-of-its-kind for this domain (you've actually looked — see step 1).
- You're modifying an existing symbol in place, not adding a new one.
- The new symbol is a one-line private helper inside a single function and won't outlive that function.

## The four-step gate

### Step 1 — Locate (cheap)

Spend ≤ 5 minutes searching for the existing impl before writing anything.

Methods in order of preference:

1. Search the codebase for the domain noun + likely suffix (e.g. `*Dialog`, `*Controller`, `*UseCase`, `*Repository`, `*Dto`, `*Mapper`, `*Card`, `*Validator`, `*Formatter`). Then find callers or importers of the closest neighbor — using grep, find-references, or any code-search tool available — to see how it's typically extended.
2. **Grep the canonical homes** for your category:
   - UI components → your shared components / screens directory
   - State holders → your use-case and controller/view-model packages
   - Value types / models → your data/remote/dto and domain/model directories
   - Constants → your shared copy object, test-tags object, design-token file, navigation-route enum
   - Test scaffolding → your test trees for existing fakes and fixtures
   - DI bindings → all provider/module files for an existing binding of the same return type
3. **Grep for the matching domain noun** — even noisy results are useful. If you're about to write a `DocumentValidator`, grep for `*Validator` and the domain noun. If you're about to add a `"Not now"` string, grep for it as a literal across the codebase.

Output: 0..N existing implementations or near-siblings. If 0, skip to step 4. If ≥ 1, continue.

### Step 2 — Diff (cheap)

For each candidate, write the **shape** of the existing symbol in 3-6 bullets:

```
LimitReachedDialog (shared-ui/.../dialogs/):
- shell: shared dialog shell (not a raw platform dialog)
- primitives: shared primary-action + deferred-action components
- header: icon-in-tinted-card + bold title + body copy
- info row: Card with label + value
- helper text: supporting copy centered, reduced opacity
```

Then write the shape of what you're about to build. Compare:

- **What's the same?** → reuse / extend / mirror it.
- **What's different — and why?** The differences are the load-bearing question.

### Step 3 — Apply the category's default action

The category determines the default. The four valid actions:

| Action | Pick when | Cost |
|---|---|---|
| **Reuse** | The existing symbol satisfies the new requirement as-is. Default for shared primitives + copy + use-cases + value types/DTOs + tokens + test fakes + error mappers | None — just use it |
| **Extend** | The existing symbol needs a small backwards-compatible parameter / branch to cover the new case | Touches the existing surface; verify no caller breaks |
| **Mirror** | A new symbol must exist (different domain, different lifecycle) but should look like a structural sibling — same shell + primitives + shape. Default for pattern-instance components. Also the right answer when creating a new controller/screen — mirror the *structure* of an existing peer, not its instance | New file/symbol; risk is drift if the original later evolves |
| **New** | Two cases: (a) no sibling exists at all (genuinely first-of-its-kind — set precedent); (b) the per-feature bucket default — each feature owns its own controller/view-model, screen entry point, and per-feature state type. In case (b) you're "new" relative to other features but you still mirror the existing peer's structure | (a) Highest — you're setting precedent. (b) Low — bucket default |

**Reusing where the bucket default is NEW is just as wrong as inventing where the bucket default is REUSE.** Sharing a controller across unrelated features couples lifecycles. Cloning a state type into another controller couples state surfaces that should evolve independently. Hosting one screen's logic inside another's entry point bypasses the navigation system. Each of these is a misapplication of "reuse".

Record the choice **before writing the code** (commit body or PR description). Examples spanning all four buckets:

> *reuse:* `SharedCopy.NOT_NOW` (shared primitive: bucket default = reuse).
>
> *extend:* `TodaysQuizPollingUseCase` — the new document case slots in via the existing `PollingPolicy` enum; no new orchestration logic.
>
> *mirror:* `DocumentUnlockDialog` mirrors `LimitReachedDialog` — same shared dialog shell, same primary-action + deferred-action pair, same icon-tinted-card header (pattern-instance component: bucket default = mirror).
>
> *new (category default):* `DocumentGenerateScreen` is a new screen entry point per route; mirrors `CreateRoute`'s controller injection + layout layering (per-feature unit: bucket default = new + mirror structure).
>
> *new (deviation):* `DocumentGenerateController` is hosted at activity/app scope inside `CreateRoute` to survive the conditional re-render and preserve in-flight upload state — stated exception to the per-feature default.
>
> *new:* `DocumentValidator` — searched for `*Validator`, `*DocumentCheck`, and `*FileGuard` across the codebase; no sibling exists. Setting precedent (first-of-its-kind).

The artefact is what prevents the "wait, why are these subtly different?" archaeology session three months later — AND the "wait, why is this controller shared across two flows?" lifecycle bug six months later.

### Step 4 — Implement + cross-link

- **Reuse:** import and call it. Done.
- **Extend:** make the surface change minimal (default-valued parameter, additive enum case). Existing callers compile without edits.
- **Mirror:** add a one-line code comment at the new symbol pointing at the original. `// Mirrors LimitReachedDialog — see PR #N for the rationale.`
- **New:** if you genuinely had no sibling, the new symbol is now the precedent. Name it well, document its role, and expect the next "new feature" to mirror you.

## Red flags

Two failure modes, equally bad:

**A. Inventing where you should have reused (shared-primitive bucket):**

| Anti-pattern | Why it's wrong |
|---|---|
| Raw platform dialog/sheet when your shared dialog shell exists | Bypasses every accumulated UX/dismiss/inset decision baked into the shell |
| Raw action buttons inside a dialog when your shared action primitives exist | Primitives encode tone, spacing, and accessibility choices |
| New use-case re-implementing a polling/retry recipe that an existing use-case already encodes | Two divergent recipes = two divergent bug surfaces |
| New value type/DTO field with a slightly different name than an equivalent on a sibling type | Aligning shapes downstream prevents mapper bloat |
| New copy constant when the shared copy object already has it | Translation/branding/A-B-test pipelines silently bypass the new constant |
| Custom inline exception handling for an exception that an existing error-mapper handles | Future error UX lives at the mapper's call site — you just split the home |

**B. Reusing where you should have created new (per-feature bucket):**

| Anti-pattern | Why it's wrong |
|---|---|
| One controller/view-model shared across two unrelated features (silent, no justification) | Couples lifecycles; one feature's state pollutes the other. App-scoped sharing is sometimes the right answer — but only with stated rationale |
| Per-feature state type cloned identically across multiple controllers that aren't structurally related | Either share a base (cross-cutting concept) OR genuinely diverge the per-feature types — silent cloning is the failure mode |
| New screen entry point that hosts another screen's logic inline instead of navigating to it | Bypasses the navigation stack, breaks back-handling, couples layouts |
| "Extracting" a base class from two controllers that happen to look alike but model different domains | False-DRY — the parent class becomes an attractor for unrelated logic over time |

**Cross-cutting:**

| Anti-pattern | Why it's wrong |
|---|---|
| A new symbol meaningfully different from its closest sibling without a stated reason | Reviewers can't tell intentional divergence from accidental — and neither can you in six months |
| **Silent invention OR silent miscategorization** — no commit-body line, no PR note | The failure modes this skill exists to catch. Both are equally bad: shipping the wrong action for the category |

## Flow-level escalation (multi-step flows, 20+ lines)

When the symbol you're about to write is a **multi-step orchestration** (claim-then-retry, upload-then-poll, login-then-fetch, recovery state machine) and is 20+ lines, the same four-step gate applies — but Step 3's action set expands:

| Action | Pick when | Cost |
|---|---|---|
| **Copy with simplifications** | Differences are large (analytics requirements differ, state shapes differ, lifecycles differ) AND importing would cargo-cult unused complexity | Drift risk — record the divergence in the commit body so future readers know it's separate-by-design |
| **Extract to shared use-case / helper** | Differences are small AND bug fixes should propagate to both surfaces | Up-front refactoring cost; apply the rule of 3 — wait for a third real consumer before extracting |
| **Delegate to the existing impl** | The other module's public surface already fits with minimal adaptation | Couples the new module to the existing one; only viable if the existing impl is already public-facing |

**Flow-specific anti-patterns:**
- Re-implementing an existing validate→call→map→handle orchestration inline instead of reusing or delegating.
- Silent copy (no comment, no PR-body note) — future readers can't tell intentional divergence from accidental drift.
- Premature extract after only two callers — the wrong abstraction gets locked in; wait for caller #3.
- "I'll align them in a follow-up PR" — the follow-up doesn't happen; commit to copy-with-rationale now or extract now.

Record any deliberate divergence in the PR/commit body (e.g. *"copy-with-simplifications: mirrors `QuizController.claimRewardedGenerationUnlock` but omits analytics (Phase 5) and pending-request preservation — treat as separate-by-design until a third caller appears"*). Add a one-line cross-link comment at the new impl pointing at the original.

## Pairs with other skills

- **`refactoring-strategy.md`** — when "extract" is the right choice but it requires modifying the original symbol, treat it as cross-module refactoring (impact radius, parallel change).
- **`code-simplification.md`** — the simplify pass should not delete the `reuse: …` / `mirror: …` rationale as an "obvious comment"; it's load-bearing.
- **`doubt-driven-development.md`** — if the decision is non-trivial (mirror vs new on a high-stakes symbol, or copy vs extract on a flow), the adversarial-subagent check applies.
