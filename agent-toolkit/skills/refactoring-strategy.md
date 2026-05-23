---
name: refactoring-strategy
description: Strategic refactoring playbook for AI agents. Use when restructuring code beyond a single function — moving things across files or modules, changing function signatures with multiple callers, replacing an abstraction, or untangling dependencies. Synthesizes Fowler's catalog, Feathers' legacy-code seams, modern parallel-change/strangler-fig patterns, and AI-agent-era operational guardrails (tier gating, deterministic tooling, code-graph blast radius, coverage guards).
---

# Refactoring Strategy

> Synthesized from Fowler (*Refactoring*, 2nd ed.), Feathers (*Working Effectively with Legacy Code*), Danilo Sato (Parallel Change), Jez Humble (Branch by Abstraction), Brolund & Ellnestam (*The Mikado Method*), Kent Beck, Sandi Metz, plus AI-agent-era operational guidance from Anthropic's `code-modernization` plugin, CodeScene's *Agentic AI Coding* patterns, Kiro's *Refactoring Made Right*, and citypaul's refactoring SKILL.md.

## Adaptation note

This skill is **strategy**. Pair with:

- **`refactor-safely.md`** (if present) — the **mechanics** layer (graph-aware MCP tools: `refactor_tool`, `query_graph`, `get_impact_radius`).
- **`code-simplification.md`** — the **cleanup** layer (clarity-only post-refactor pass; no behavior change).

Canonical sequence: **Strategy (this skill) → Mechanics → Cleanup.**

## When to use

- Cross-module changes (signature/field/class move)
- Untangling dependencies before adding a feature ("make the change easy, then make the easy change")
- Replacing an abstraction (parser, repository, queue, persistence layer)
- Renaming a function called from many places
- Code is hard to change because of accidental complexity, not essential complexity

## When NOT to use (Chesterton's Fence)

- Code works and nothing upcoming touches it
- You can't articulate the win in one sentence
- No tests exist AND you can't write characterization tests
- You're mid-feature with the "feature hat" on (see Two Hats Rule)
- The "duplication" is two functions that *look* alike but evolve independently — Sandi Metz: *"Duplication is far cheaper than the wrong abstraction."*

---

## The Two Hats Rule (Fowler)

At any moment you are either **Adding Feature** OR **Refactoring**. Never both in one commit.

- If you start a refactor and notice a bug → write it down → finish the refactor first → switch hats.
- If you start a feature and discover you need a refactor first → STASH the feature → switch hats → ship the refactor → switch back.
- One PR can contain commits in both hats; but each **commit** is single-hat. The hat is named in the commit subject (`refactor:` vs `feat:` vs `fix:`).

---

## Tier classification — DO THIS BEFORE TOUCHING CODE

| Tier | Scope | Rigor required |
|---|---|---|
| **T1 — Local** | One function or file | Tests pass before AND after. That's it. |
| **T2 — Cross-module** | Multiple files; signature, field, or class moves | Plan-first. Characterization tests if coverage is thin. Parallel Change when callers ≥ 5. |
| **T3 — Architectural** | Cross-package, abstraction replacement, dependency inversion | **STOP.** Confirm with human first. Mikado Method to discover prerequisites. Strangler Fig or Branch by Abstraction. Multiple commits, each green. |

### Stop-and-ask triggers (mandatory — agent must stop and ask the human)

1. Public API would change (signature visible outside the module)
2. Test coverage would drop
3. You hit a **Chesterton's Fence** — a guard/branch/abstraction you cannot explain
4. The refactor crosses team or package boundaries
5. You'd delete >50 lines you did not author
6. The refactor requires a database migration, schema change, or wire-format change

---

## The five workflows (Fowler, 2nd ed.)

AI agents should default to **Preparatory** or **Comprehension**. Other modes require explicit human ack.

1. **Opportunistic** — clean up while passing through (Boy Scout Rule). **Scope: files already in your diff only.** Do not extend the diff.
2. **Preparatory** — refactor first to make a coming change easy. *Two separate commits: the refactor, then the feature.*
3. **Comprehension** — refactor to understand what code does, while reading it.
4. **Planned** — scheduled refactoring with a written goal. Stop-and-ask before starting.
5. **Long-term** — months of incremental change behind a feature flag. Probably not the agent's job in one session.

---

## Decision tree

```
What's the scope?
├─ One file, one function ──────────────── T1 → refactor on green
├─ Signature change with >1 caller
│   ├─ <5 callers ─────────────────────── T2 → atomic refactor commit
│   └─ ≥5 callers ─────────────────────── T2 → Parallel Change (Expand–Migrate–Contract)
├─ Move class/module across packages ──── T2 → graph impact-radius FIRST
├─ Replace abstraction ─────────────────── T3 → STOP, confirm with human
└─ Architectural / cross-package ──────── T3 → STOP, confirm with human

Do tests exist for the affected code?
├─ Yes, green ──────────── proceed
├─ Yes, red ────────────── STOP, fix tests first (refactor on GREEN only)
└─ No tests ────────────── write characterization tests FIRST (Feathers)
                            OR commit `blocked: no test harness for <file>` and ask
```

---

## Patterns by tier

### T1 — Local tactics (Fowler catalog highlights)

- **Extract Method / Inline Method / Extract Variable / Rename**
- **Replace Magic Number with Named Constant**
- **Replace Conditional with Guard Clauses** (flatten nesting; single-exit dogma is dead)
- **Introduce Parameter Object** when a parameter list grows past ~3 items
- **Slide Statements / Split Loop** — co-locate things that change together *before* extracting

### T2 — Cross-module

- **Sprout Method / Sprout Class** (Feathers) — add new behavior **beside** legacy code instead of editing it; isolate the new code so it can be tested
- **Wrap Method / Wrap Class** (Feathers) — decorate legacy without changing it
- **Move Function / Move Field / Change Function Declaration** (Fowler) — graph the callers first
- **Extract Class / Extract Interface / Extract Superclass** (Fowler)
- **Parallel Change / Expand–Migrate–Contract** (Sato) — the canonical safe cross-module change
- **Seams / Dependency-Breaking** (Feathers) — Extract Interface, Subclass to Test, Parameterize Constructor — break dependencies to get code under test *before* refactoring
- **Characterization Tests First** — never touch un-tested legacy without pinning behavior

### T3 — Architectural

- **Strangler Fig** (Fowler) — wrap the legacy with a new facade, redirect traffic one route at a time, retire old behind the facade. Each cutover is reversible.
- **Branch by Abstraction** (Humble) — introduce an abstraction layer over the current implementation → migrate consumers to the abstraction → add new implementation under the abstraction → switch via DI/feature flag → remove old. Trunk stays shippable throughout.
- **Mikado Method** (Brolund & Ellnestam) — try the change → it breaks → revert → write the prerequisite as a node in a Mikado graph → repeat until you find a leaf that compiles green → commit that leaf → work back up. Commits are always green.
- **Preparatory Refactoring** (Beck) — *"Make the change easy, then make the easy change."* Refactor first in its own commit; feature lands in a second commit.

---

## Characterization tests (Feathers)

The answer to *"but there are no tests."*

**Principles:**

- **The legacy code is the oracle.** Test what it *actually does*, not what spec says. If spec says 19.28 but code computes 19.27 — assert **19.27** and flag the discrepancy separately. Equivalence first; bug-fixing is a separate decision.
- **Concrete over abstract.** Every test has literal input and literal expected output. No "should calculate correctly" — instead: *"given balance 1250.00 and APR 18.5%, returns 19.27."*
- **Cover every branch the legacy covers.** Every `if`/`when`/`switch`/`match` arm gets ≥ 1 test case. Boundaries explicit: zero, negative, max, empty, null.
- **Pin THEN refactor.** Tests must be **GREEN** before the first line of refactor lands.
- **Executable, not aspirational.** Skipped tests are marked, not deleted (`@Disabled`, `it.todo()`, `@pytest.mark.skip` with a reason).

---

## Rules and heuristics

- **Rule of Three** (Fowler) — first time write it; second time wince; third time refactor. Resist DRYing the first two duplicates.
- **DRY is about knowledge, not shape** — two functions that look alike but evolve independently are not duplication. Don't merge.
- **Refactor on GREEN only.** A failing test is your behavior anchor — refactoring while red means you're moving two unknowns.
- **Commit-sized slices.** One named refactoring per commit. Conventional Commits subject names the pattern: `refactor: extract method renderHeader`, `refactor: move UserRepo to data layer`, `refactor: parallel-change step 2/3 (migrate callers)`. Tests green **before AND after** every commit.
- **Boy Scout Rule (constrained for agents):** clean **only files already in your diff**. Do not expand the diff to satisfy this rule.

---

## Anti-patterns

| Anti-pattern | Why it's wrong |
|---|---|
| **The Big Rewrite** | Strangler always wins. Rewrites stall, miss invariants, ship late. (Spolsky) |
| **Mixed-mode commits** (refactor + behavior change together) | Doubles review cost; regressions hide in the diff noise. |
| **Premature abstraction** | Extracting an interface with one concrete user. Wait for 3+. (Metz) |
| **Speculative generality / gold-plating** | Adding hooks "for future" with no failing test demanding them. (Fowler smell) |
| **Refactor without tests** | Edit-and-pray. Write characterization tests OR commit `blocked: no test harness` and stop. |
| **Drive-by reformatting** | Whitespace/imports/style outside the diff scope poisons reviewability. |
| **Improving adjacent code** | Expanding the blast radius beyond the request. Surgical-change discipline wins. |
| **Symptom-swallowing** | `try/catch` that hides the bug; null-coalesce on a value that shouldn't be null; sleep/retry to mask a race. Find the root cause. |
| **Treating a shared lambda type as "just a callback"** | A `() -> Unit` (or any `(T) -> R`) passed between routes/screens IS a public API surface. Changing its signature ripples to every call site silently — the compiler catches arity changes but not semantic ones (what the callback now expects to do, when it fires, what it's allowed to assume about VM state). Apply the same rigor as renaming a public function: list callers via the code graph, decide expand/migrate/contract, and explicitly justify the signature change in the commit body. T2-grade work, not T1. |

---

## AI-agent-specific guardrails

1. **Tier-gate FIRST.** Classify before touching code. T3 stops and asks the human.
2. **Prefer deterministic tooling over LLM text-rewriting.** Use language-server rename, IDE move-file, ast-grep, codemods. Agents hallucinate imports and miss callers across files. Don't text-replace what an LSP can do safely.
3. **Use the code graph for blast radius.** Before any T2/T3 change: `get_impact_radius`, `query_graph(pattern=callers_of)`, `get_affected_flows`. Verify the change touches what you expect — no more, no less.
4. **Plan mode before Act mode.** For T2/T3: write a Mikado-style prerequisite list (notes file or PR-body draft), get human ack on T3, *then* execute.
5. **State-file checkpoints on long refactors.** Every few commits, append to `notes.md`: done / open / decisions / tricky parts. The next session can resume without re-reading the whole diff.
6. **Coverage as guardrail.** Coverage must be ≥ pre-refactor. Never delete or weaken tests during a refactor — that turns a refactor into an unobservable behavior change.
7. **Boring renames are the agent's sweet spot.** Architectural choices are not. Match the task to the strength.
8. **Mutation testing** before declaring T2+ done — proves the tests actually constrain behavior, not just exercise lines.
9. **One refactor per commit; commit subject names the pattern.** A reviewer should be able to predict the diff from the subject line.

---

## Mini-playbook A — "I need to rename a function called from 8 places"

**T2, callers ≥ 5 → Parallel Change.**

1. `query_graph(pattern=callers_of, target=<function>)` — confirm the 8 callers (don't trust your eyeballs)
2. **Expand:** add new function with the correct name; it delegates to old. *Commit:* `refactor: introduce <newName> wrapping <oldName>`. Tests GREEN.
3. **Migrate:** update callers in 1–2 commits (group by package if possible). *Commit:* `refactor: migrate <module> callers to <newName>`. Tests GREEN between commits.
4. **Contract:** delete the old function. *Commit:* `refactor: remove deprecated <oldName>`. Tests GREEN.

Each commit is independently reviewable and revertible.

---

## Mini-playbook B — "I need to replace the persistence layer"

**T3 — STOP, confirm with human FIRST.** Then Branch by Abstraction:

1. **Plan** — write a Mikado prerequisite list as `notes.md`. Get human ack on the plan and the target abstraction shape.
2. **Abstract** — introduce `Repository` interface over current impl. *Commit:* `refactor: introduce Repository abstraction`. Tests GREEN.
3. **Migrate consumers** to the interface (no behavior change). Multiple commits, one consumer or layer per commit.
4. **Implement new** — add `NewBackedRepository` impl. Switch via DI / feature flag. Old still default.
5. **Cutover** — flip the flag in staging → prod. Monitor for regressions.
6. **Contract** — remove old impl and the temporary feature flag once stable. *Commit:* `refactor: remove legacy persistence`.

Each step ships independently. Rollback at any point is a flag flip, not a revert.

---

## Mini-playbook C — "I'm refactoring untested legacy code"

1. **STOP** — do not touch the code yet.
2. Read the code's branches. List every observable behavior (inputs → outputs, exceptions thrown, side effects).
3. Write **characterization tests** that pin every branch with concrete input/output pairs derived from the legacy code itself (the code is the oracle).
4. Run the tests — they must be GREEN against the legacy code.
5. NOW you may refactor. Re-run the characterization tests after every commit. If a test goes red, you changed behavior — revert.
6. After the refactor stabilizes, consider whether any characterization test encoded a *bug* (the spec said 19.28 but code said 19.27). Open a separate ticket for the bug — do not fix it in the refactor.

---

## Pairs with other skills

- **`code-simplification`** — runs AFTER refactor as a clarity pass on the new shape. Behavior-preserving only.
- **`deprecation-and-migration`** — strategic removal of an old system; uses Strangler Fig from this skill.
- **`debugging-and-error-recovery`** — if a test goes red mid-refactor, switch hats (Two Hats Rule). Fix or revert; don't push through.
- **`doubt-driven-development`** — spawn an adversarial reviewer before committing T3 architectural choices.
- **`test-driven-development`** — for new behavior. Switch hats: TDD for the feature, then this skill for the refactor.
- **`code-review-and-quality`** — five-axis review before merge.

---

## Source attribution

- **Martin Fowler**, *Refactoring* (2nd ed., 2018) — catalog, workflows, two-hats, preparatory refactoring, Strangler Fig
- **Michael Feathers**, *Working Effectively with Legacy Code* (2004) — characterization tests, seams, sprout/wrap, dependency-breaking
- **Danilo Sato** — [Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)
- **Jez Humble** — [Branch by Abstraction](https://www.branchbyabstraction.com/)
- **Daniel Brolund & Ola Ellnestam** — *The Mikado Method* (2014)
- **Kent Beck** — *"Make the change easy, then make the easy change."*
- **Sandi Metz** — *"Duplication is far cheaper than the wrong abstraction."*
- **Joel Spolsky** — *Things You Should Never Do, Part I* (the Big Rewrite warning)
- **Anthropic** — [`code-modernization` plugin](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/code-modernization) — single-module transform shape, characterization-test agent, architecture-critic adversarial review
- **CodeScene** — *Agentic AI Coding: Best-Practice Patterns for Speed with Quality* (2025) — coverage guardrail, tier gating, encode principles in AGENTS.md
- **Kiro** — *Refactoring Made Right* — deterministic tooling > LLM text rewriting
- **citypaul** — [refactoring SKILL.md](https://github.com/citypaul/.dotfiles/blob/main/claude/.claude/skills/refactoring/SKILL.md) — commit discipline, mutation testing
