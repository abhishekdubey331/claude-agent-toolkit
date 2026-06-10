---
name: planning-and-task-breakdown
description: Breaks work into ordered tasks. Use when you have a spec or clear requirements and need to break work into implementable tasks. Use when a task feels too large to start, when you need to estimate scope, or when parallel work is possible.
---

# Planning and Task Breakdown

> Adapted from [addyosmani/agent-skills/skills/planning-and-task-breakdown/SKILL.md](https://github.com/addyosmani/agent-skills/blob/main/skills/planning-and-task-breakdown/SKILL.md) — MIT, © Addy Osmani.

## Adaptation note for this repo

Bundled in the `agent-toolkit` plugin for use across any project, regardless of language or platform. Extends upstream with **issue-ready task scaffolding** so plans flow into the `/agent-issue` pipeline without re-interviewing the user.

Specifically, this version adds:
- **Two mandatory Architecture Decisions** (verification strategy, issue-filing strategy) that pre-answer the most common `/agent-issue` interview questions.
- **Per-task issue-ready fields** (suggested issue title, suggested labels, filing hint, edge cases, rollback note).
- **Merged Acceptance + Verification** into a single list of observable testable criteria (matches the `/agent-issue` body shape).
- **Risk-to-AC promotion** column on the project-wide risk table.
- **A "plan-only, do-not-copy-to-issue" marker** on `Files likely touched`.

If you are NOT going to feed the plan into `/agent-issue`, the upstream-only fields still work — the additions are additive, not replacements.

---

## Overview

Decompose work into small, verifiable tasks with explicit acceptance criteria. Good task breakdown is the difference between an agent that completes work reliably and one that produces a tangled mess. Every task should be small enough to implement, test, and verify in a single focused session — AND structured so it can be filed as a GitHub issue with minimal additional interview.

## When to Use

- You have a spec and need to break it into implementable units
- A task feels too large or vague to start
- Work needs to be parallelized across multiple agents or sessions
- You need to communicate scope to a human
- The implementation order isn't obvious

**When NOT to use:** Single-file changes with obvious scope, or when the spec already contains well-defined tasks.

## The Planning Process

### Step 1: Enter Plan Mode

Before writing any code, operate in read-only mode:

- Read the spec and relevant codebase sections
- Identify existing patterns and conventions
- Map dependencies between components
- Note risks and unknowns

**Do NOT write code during planning.** The output is a plan document, not implementation.

### Step 2: Identify the Dependency Graph

Map what depends on what:

```
Database schema
    │
    ├── API models/types
    │       │
    │       ├── API endpoints
    │       │       │
    │       │       └── Frontend API client
    │       │               │
    │       │               └── UI components
    │       │
    │       └── Validation logic
    │
    └── Seed data / migrations
```

Implementation order follows the dependency graph bottom-up: build foundations first.

### Step 3: Slice Vertically

Instead of building all the database, then all the API, then all the UI — build one complete feature path at a time:

**Bad (horizontal slicing):**
```
Task 1: Build entire database schema
Task 2: Build all API endpoints
Task 3: Build all UI components
Task 4: Connect everything
```

**Good (vertical slicing):**
```
Task 1: User can create an account (schema + API + UI for registration)
Task 2: User can log in (auth schema + API + UI for login)
Task 3: User can create a task (task schema + API + UI for creation)
Task 4: User can view task list (query + API + UI for list view)
```

Each vertical slice delivers working, testable functionality.

### Step 4: Lock Two Project-Wide Decisions Up Front

Before writing tasks, lock these in the plan's **Architecture Decisions** section. They get asked over and over by `/agent-issue` otherwise.

1. **Verification strategy.** How will acceptance be checked? Pick one (or one-per-layer):
   - Unit tests only (e.g. against a mock server or an in-memory store)
   - Unit + integration / UI / instrumentation
   - Unit + manual staging smoke
   - Unit + CI integration against staging

2. **Issue-filing strategy.** How do tasks become GitHub issues? Pick one:
   - One issue per phase (bundle all tasks in a phase)
   - One issue per task (maximum granularity)
   - One issue per vertical slice (group by feature path)
   - Mixed — call it out per-phase in the Phase header

Quoting these once at the top of the plan eliminates 2–3 rounds of interview for every task that gets filed.

### Step 5: Write Tasks (Issue-Ready)

Each task follows this structure. Every field below is required unless marked **(plan-only)**.

```markdown
## Task [N]: [Short descriptive title]

**Description:** One paragraph explaining what this task accomplishes.

**Suggested issue title:** `[Area] verb-led one-liner under 70 chars`

**Suggested labels:** `area:X`, `type:Y` (pick from the live `gh label list`; add `severity:*` only if bug)

**Filing hint:** Standalone | Bundle with Task N | Bundle with all of Phase X

**Acceptance criteria** (observable, testable, no implementation prescription):
- [ ] [Behavior visible from outside the code under change. NOT "modify class X" or "use library Y".]
- [ ] [Include the test command if it's load-bearing, e.g. "migration test passes: run the suite filtered to the migration tests".]
- [ ] [Each AC must be checkable without reading the implementation.]

**Edge cases to consider:**
- [Case + expected behavior]
- [Case + expected behavior]

**Rollback note:** One sentence — blast radius if this ships broken, and how to revert.

**Dependencies:** [Task N during planning; swap to `#NNN` after filing — `None` if none]

**Files likely touched** *(plan-only — do not copy into the GitHub issue body)*:
- `src/path/to/file.ts`
- `tests/path/to/test.ts`

**Estimated scope:** [XS: 1 file | S: 1-2 | M: 3-5 | L: 5-8 — break down if larger]
```

**Why the merged AC list?** Upstream splits Acceptance from Verification. In a GitHub issue body, those merge into a single list. Plan in the same shape you'll file in.

**Why "no file paths in AC"?** `/agent-issue` strips file paths from issue bodies because they go stale. AC should describe observable behavior — the implementer finds the right file via the graph or grep.

### Step 6: Order and Checkpoint

Arrange tasks so that:

1. Dependencies are satisfied (build foundation first)
2. Each task leaves the system in a working state
3. Verification checkpoints occur after every 2-3 tasks
4. High-risk tasks are early (fail fast)

Add explicit checkpoints:

```markdown
## Checkpoint: After Tasks 1-3
- [ ] All tests pass
- [ ] Application builds without errors
- [ ] Core user flow works end-to-end
- [ ] Review with human before proceeding
```

### Step 7: Promote Load-Bearing Risks to Per-Task AC

The project-wide risk table catches the big picture. But risks that are **load-bearing** (a missed mitigation would be a real incident) should be hoisted into the relevant task's acceptance criteria. Mark them in the risk table with a "Surface as AC?" column.

A risk should be hoisted if it meets at least one of:
- It has a concrete, testable mitigation (e.g. "migration test asserts data integrity")
- A reviewer can't catch it by reading the diff alone (e.g. cold-start constructor-I/O)
- Skipping the mitigation produces a silent regression (no immediate error, surfaces later)

Risks that are informational only ("backend might not be ready yet") stay in the table and skip the AC promotion.

## Task Sizing Guidelines

| Size | Files | Scope | Example |
|------|-------|-------|---------|
| **XS** | 1 | Single function or config change | Add a validation rule |
| **S** | 1-2 | One component or endpoint | Add a new API endpoint |
| **M** | 3-5 | One feature slice | User registration flow |
| **L** | 5-8 | Multi-component feature | Search with filtering and pagination |
| **XL** | 8+ | **Too large — break it down further** | — |

If a task is L or larger, it should be broken into smaller tasks. An agent performs best on S and M tasks.

**When to break a task down further:**
- It would take more than one focused session (roughly 2+ hours of agent work)
- You cannot describe the acceptance criteria in 3 or fewer bullet points
- It touches two or more independent subsystems (e.g., auth and billing)
- You find yourself writing "and" in the task title (a sign it is two tasks)

## Plan Document Template

```markdown
# Implementation Plan: [Feature/Project Name]

## Overview
[One paragraph summary of what we're building]

## Architecture Decisions

- **Verification strategy:** [unit-only / unit + instrumentation / unit + staging-smoke / unit + CI-integration]
- **Issue-filing strategy:** [one issue per phase / one per task / one per vertical slice / mixed]
- [Key architectural decision 1 and rationale]
- [Key architectural decision 2 and rationale]

## Task List

### Phase 1: Foundation
- [ ] Task 1: ...
- [ ] Task 2: ...

### Checkpoint: Foundation
- [ ] Tests pass, builds clean

### Phase 2: Core Features
- [ ] Task 3: ...
- [ ] Task 4: ...

### Checkpoint: Core Features
- [ ] End-to-end flow works

### Phase 3: Polish
- [ ] Task 5: ...
- [ ] Task 6: ...

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review

## Risks and Mitigations

| Risk | Impact | Mitigation | Surface as AC? |
|------|--------|------------|----------------|
| [Risk] | [High/Med/Low] | [Strategy] | [Yes → Task N / No — informational] |

## Open Questions
- [Question needing human input]
```

## Parallelization Opportunities

When multiple agents or sessions are available:

- **Safe to parallelize:** Independent feature slices, tests for already-implemented features, documentation
- **Must be sequential:** Database migrations, shared state changes, dependency chains
- **Needs coordination:** Features that share an API contract (define the contract first, then parallelize)

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll figure it out as I go" | That's how you end up with a tangled mess and rework. 10 minutes of planning saves hours. |
| "The tasks are obvious" | Write them down anyway. Explicit tasks surface hidden dependencies and forgotten edge cases. |
| "Planning is overhead" | Planning is the task. Implementation without a plan is just typing. |
| "I can hold it all in my head" | Context windows are finite. Written plans survive session boundaries and compaction. |
| "The verification strategy is obvious" | If it were, `/agent-issue` wouldn't keep asking. Lock it in Architecture Decisions once. |
| "The labels and issue title can wait" | They can't — `/agent-issue` will pause to ask. Pre-fill them now while you have full context. |

## Red Flags

- Starting implementation without a written task list
- Tasks that say "implement the feature" without acceptance criteria
- AC that names a class, library, or file path — implementer should find the pattern
- AC that's identical to the description (means it's not observable yet — rewrite)
- All tasks are XL-sized
- No checkpoints between tasks
- Dependency order isn't considered
- **Verification strategy not declared in Architecture Decisions** — every task will get re-interviewed
- **Issue-filing strategy not declared** — every issue will get a bundling-vs-splitting interview
- Risks in the project table with no "Surface as AC?" column filled in

## Verification

Before starting implementation, confirm:

- [ ] Architecture Decisions declares verification strategy AND issue-filing strategy
- [ ] Every task has a suggested issue title and suggested labels
- [ ] Every task has acceptance criteria written as observable behavior (no class names, file paths, or library prescriptions)
- [ ] Every task has at least 1 edge case and a one-line rollback note
- [ ] Every task has a filing hint (Standalone / Bundle with N)
- [ ] Task dependencies are identified and ordered correctly
- [ ] No task touches more than ~5 files
- [ ] Checkpoints exist between major phases
- [ ] Risk table has the "Surface as AC?" column filled in for every row
- [ ] The human has reviewed and approved the plan
