---
name: incremental-implementation
description: Delivers changes incrementally. Use when implementing any feature or change that touches more than one file. Use when you're about to write a large amount of code at once, or when a task feels too big to land in one step.
---

> Adapted from [addyosmani/agent-skills/skills/incremental-implementation/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/incremental-implementation/SKILL.md) — MIT-licensed, © Addy Osmani.

## Adaptation note for this repo

The skill content below is unmodified from upstream; this section adds the two adaptations needed when reading it in this repo:

- **Stack-specific commands.** Examples below use npm/Node. For this Android
  Kotlin codebase substitute:
  - `npm test` / `npm run test` → `./gradlew testDebugUnitTest`
  - `npm run build` → `./gradlew assembleDebug`
  - `npm run lint` → `./gradlew detekt` (and/or `./gradlew ktlintCheck`)
  - `npx tsc --noEmit` → not applicable; kotlinc runs as part of the build
  - `npm audit` → no direct equivalent; review `app/build.gradle.kts` and
    `gradle/libs.versions.toml` for dependency hygiene

- **Cross-references to other Addy skills** (e.g. `git-workflow-and-versioning`,
  `references/orchestration-patterns.md`). The full upstream skill set was
  not imported — only the three currently in `.claude/skills/`. Apply the
  conceptual principle when referenced; the explicit cross-references will
  not resolve here.

# Incremental Implementation

## Overview

Build in thin vertical slices — implement one piece, test it, verify it, then expand. Avoid implementing an entire feature in one pass. Each increment should leave the system in a working, testable state. This is the execution discipline that makes large features manageable.

## When to Use

- Implementing any multi-file change
- Building a new feature from a task breakdown
- Refactoring existing code
- Any time you're tempted to write more than ~100 lines before testing

**When NOT to use:** Single-file, single-function changes where the scope is already minimal.

## The Increment Cycle

```
┌──────────────────────────────────────┐
│                                      │
│   Implement ──→ Test ──→ Verify ──┐  │
│       ▲                           │  │
│       └───── Commit ◄─────────────┘  │
│              │                       │
│              ▼                       │
│          Next slice                  │
│                                      │
└──────────────────────────────────────┘
```

For each slice:

1. **Implement** the smallest complete piece of functionality
2. **Test** — run the test suite (or write a test if none exists)
3. **Verify** — confirm the slice works as expected (tests pass, build succeeds, manual check)
4. **Commit** -- save your progress with a descriptive message (see `git-workflow-and-versioning` for atomic commit guidance)
5. **Move to the next slice** — carry forward, don't restart

## Slicing Strategies

### Vertical Slices (Preferred)

Build one complete path through the stack:

```
Slice 1: Create a task (DB + API + basic UI)
    → Tests pass, user can create a task via the UI

Slice 2: List tasks (query + API + UI)
    → Tests pass, user can see their tasks

Slice 3: Edit a task (update + API + UI)
    → Tests pass, user can modify tasks

Slice 4: Delete a task (delete + API + UI + confirmation)
    → Tests pass, full CRUD complete
```

Each slice delivers working end-to-end functionality.

### Contract-First Slicing

When backend and frontend need to develop in parallel:

```
Slice 0: Define the API contract (types, interfaces, OpenAPI spec)
Slice 1a: Implement backend against the contract + API tests
Slice 1b: Implement frontend against mock data matching the contract
Slice 2: Integrate and test end-to-end
```

### Risk-First Slicing

Tackle the riskiest or most uncertain piece first:

```
Slice 1: Prove the WebSocket connection works (highest risk)
Slice 2: Build real-time task updates on the proven connection
Slice 3: Add offline support and reconnection
```

If Slice 1 fails, you discover it before investing in Slices 2 and 3.

## Implementation Rules

### Rule 0: Simplicity First

Before writing any code, ask: "What is the simplest thing that could work?"

After writing code, review it against these checks:
- Can this be done in fewer lines?
- Are these abstractions earning their complexity?
- Would a staff engineer look at this and say "why didn't you just..."?
- Am I building for hypothetical future requirements, or the current task?

```
SIMPLICITY CHECK:
✗ Generic EventBus with middleware pipeline for one notification
✓ Simple function call

✗ Abstract factory pattern for two similar components
✓ Two straightforward components with shared utilities

✗ Config-driven form builder for three forms
✓ Three form components
```

Three similar lines of code is better than a premature abstraction. Implement the naive, obviously-correct version first. Optimize only after correctness is proven with tests.

### Rule 0.3: Reuse Before You Build

Before introducing any new symbol, scan for an existing sibling. The CORRECT action depends on the category — not all categories want reuse. The full per-category table lives in `reuse-before-you-build.md`; this is the per-slice checklist.

The four category buckets and their defaults:

| Bucket | Examples | Default when sibling exists |
|---|---|---|
| Shared primitives | UI primitives, UseCases, DTOs, copy/tokens/test-tags, error mappers, formatters, test fakes | **REUSE / EXTEND** |
| Pattern-instance composables | sheets / dialogs / cards built FROM the primitives | **MIRROR** (new instance, same shell + primitives) |
| Per-destination units | `*Route`, `*Screen`, `*ViewModel`, per-VM sealed UI states | **NEW per route** + mirror structure only |
| First-of-its-kind | no precedent in the codebase | **NEW** (you're setting precedent) |

Per slice that introduces a symbol:

1. **Graph search first.** `semantic_search_nodes` for the domain noun + likely suffix (`*Sheet`, `*ViewModel`, `*UseCase`, `*Repository`, `*Dto`, `*Mapper`). `query_graph` for `callers_of` / `imports_of` the closest neighbor. Walk the canonical homes for your category.
2. **Identify the bucket.** The bucket determines the default. Two failure modes are equally bad: inventing where you should have reused (shared-primitive bucket); reusing where you should have created new (per-destination bucket — sharing a VM across destinations, cloning a sealed UiState across unrelated VMs, hosting one screen's logic in another's composable).
3. **Apply the default UNLESS you have a stated reason to deviate.** Deviations are legitimate (Activity-scoped VM, cross-cutting sealed-state base) but must be stated, not silent.
4. **Attest in the commit body.** One line per new symbol naming the bucket default and your choice. Empty attestation = the failure mode this rule exists to catch.

```
REUSE CHECK (shared primitive — default REUSE/EXTEND):
✗ New ModalBottomSheet with custom Column + AppPrimaryButton pair
✓ Shared BottomSheet shell + BottomSheetPrimaryAction + BottomSheetDeferredAction

✗ New polling UseCase re-implementing backoff + correlation-id threading
✓ Extend the existing polling UseCase, or factor the policy into a shared helper

✗ New "Not now" string literal in a fresh copy object
✓ SharedCopy.NOT_NOW

✗ New domain-specific ErrorResponseDto with a slightly different field name
✓ Reuse the existing ErrorResponseDto; add the variant via the sealed mapper

✗ New FakePdfRepository hand-rolling state when FakeQuizRepository already has the pattern
✓ Mirror FakeQuizRepository's structure, or extend its base

REUSE CHECK (pattern-instance composable — default MIRROR):
✗ New rewarded-unlock sheet that looks nothing like the existing DailyLimitSheet
✓ New sheet built as a structural sibling: same shell + primitives + icon-card header

REUSE CHECK (per-destination unit — default NEW per route + mirror structure):
✗ One ViewModel shared across two unrelated nav destinations (silent, no justification)
✓ Two new VMs per destination, mirrored layering. Deviation only with explicit
  "Activity-scoped because X" rationale.

✗ New screen composable hosting another screen's logic inline
✓ New screen; navigate to the other route; mirror the existing screen's scaffold + VM injection

✗ Sealed UiState cloned identically across multiple unrelated VMs
✓ Share a base only if the concept is cross-cutting; otherwise keep per-VM types diverged
```

If no sibling exists in the shared-primitive bucket, that's a signal to ASK before inventing. If you're in the per-destination bucket and NEW is the default, no question needed — just attest the bucket and the mirroring decision. See `reuse-before-you-build.md` for the full four-step gate and red-flag list.

### Rule 0.5: Scope Discipline

Touch only what the task requires.

Do NOT:
- "Clean up" code adjacent to your change
- Refactor imports in files you're not modifying
- Remove comments you don't fully understand
- Add features not in the spec because they "seem useful"
- Modernize syntax in files you're only reading

If you notice something worth improving outside your task scope, note it — don't fix it:

```
NOTICED BUT NOT TOUCHING:
- src/utils/format.ts has an unused import (unrelated to this task)
- The auth middleware could use better error messages (separate task)
→ Want me to create tasks for these?
```

### Rule 1: One Thing at a Time

Each increment changes one logical thing. Don't mix concerns:

**Bad:** One commit that adds a new component, refactors an existing one, and updates the build config.

**Good:** Three separate commits — one for each change.

### Rule 2: Keep It Compilable

After each increment, the project must build and existing tests must pass. Don't leave the codebase in a broken state between slices.

### Rule 3: Feature Flags for Incomplete Features

If a feature isn't ready for users but you need to merge increments:

```typescript
// Feature flag for work-in-progress
const ENABLE_TASK_SHARING = process.env.FEATURE_TASK_SHARING === 'true';

if (ENABLE_TASK_SHARING) {
  // New sharing UI
}
```

This lets you merge small increments to the main branch without exposing incomplete work.

### Rule 4: Safe Defaults

New code should default to safe, conservative behavior:

```typescript
// Safe: disabled by default, opt-in
export function createTask(data: TaskInput, options?: { notify?: boolean }) {
  const shouldNotify = options?.notify ?? false;
  // ...
}
```

### Rule 5: Rollback-Friendly

Each increment should be independently revertable:

- Additive changes (new files, new functions) are easy to revert
- Modifications to existing code should be minimal and focused
- Database migrations should have corresponding rollback migrations
- Avoid deleting something in one commit and replacing it in the same commit — separate them

## Working with Agents

When directing an agent to implement incrementally:

```
"Let's implement Task 3 from the plan.

Start with just the database schema change and the API endpoint.
Don't touch the UI yet — we'll do that in the next increment.

After implementing, run `npm test` and `npm run build` to verify
nothing is broken."
```

Be explicit about what's in scope and what's NOT in scope for each increment.

## Increment Checklist

After each increment, verify:

- [ ] The change does one thing and does it completely
- [ ] All existing tests still pass (`npm test`)
- [ ] The build succeeds (`npm run build`)
- [ ] Type checking passes (`npx tsc --noEmit`)
- [ ] Linting passes (`npm run lint`)
- [ ] The new functionality works as expected
- [ ] The change is committed with a descriptive message

**Note:** Run each verification command after a change that could affect it. After a successful run, don't repeat the same command unless the code has changed since — re-running on unchanged code adds no information.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll test it all at the end" | Bugs compound. A bug in Slice 1 makes Slices 2-5 wrong. Test each slice. |
| "It's faster to do it all at once" | It *feels* faster until something breaks and you can't find which of 500 changed lines caused it. |
| "These changes are too small to commit separately" | Small commits are free. Large commits hide bugs and make rollbacks painful. |
| "I'll add the feature flag later" | If the feature isn't complete, it shouldn't be user-visible. Add the flag now. |
| "This refactor is small enough to include" | Refactors mixed with features make both harder to review and debug. Separate them. |
| "Let me run the build command again just to be sure" | After a successful run, repeating the same command adds nothing unless the code has changed since. Run it again after subsequent edits, not as reassurance. |

## Red Flags

- More than 100 lines of code written without running tests
- Multiple unrelated changes in a single increment
- "Let me just quickly add this too" scope expansion
- Skipping the test/verify step to move faster
- Build or tests broken between increments
- Large uncommitted changes accumulating
- Building abstractions before the third use case demands it
- Touching files outside the task scope "while I'm here"
- Creating new utility files for one-time operations
- Running the same build/test command twice in a row without any intervening code change

## Verification

After completing all increments for a task:

- [ ] Each increment was individually tested and committed
- [ ] The full test suite passes
- [ ] The build is clean
- [ ] The feature works end-to-end as specified
- [ ] No uncommitted changes remain
