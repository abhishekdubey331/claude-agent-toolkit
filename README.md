# claude-agent-toolkit

A personal [Claude Code](https://claude.com/claude-code) plugin marketplace — an opinionated, **language- and platform-agnostic** workflow for shipping AI-written code without the slop:

> Socratic issue crafting → TDD-first implementation → surgical bug-fixing → tier-gated refactoring → adversarial PR review.

It is deliberately **lean on tokens**: each skill is read once and applied from memory, the expensive adversarial passes are opt-in (a passing test is the cheaper signal), and the full test/lint gate runs once at the end instead of on every commit.

## Install

```
/plugin marketplace add abhishekdubey331/claude-agent-toolkit
/plugin install agent-toolkit@claude-agent-toolkit
```

Update later:

```
/plugin update agent-toolkit@claude-agent-toolkit
```

## Design principles

- **Language/platform-agnostic.** No toolchain is hardcoded. The commands refer to "the project's test command", "the linter", "the type checker" *by role* — define the concrete commands once in your repo's `CLAUDE.md` / `AGENTS.md` and the agent uses them. Works on any stack (Node/TS, Python, Go, Rust, Android/Kotlin, …).
- **Cost-lean by default.** The heavy paths are opt-in, not mandatory:
  - per-commit adversarial review (`doubt-driven-development`) is reserved for genuinely high-stakes calls — irreversible side-effects, hard-to-reverse API/schema changes, or a guarantee no test can cover;
  - skill files are loaded **once** and applied from memory, not re-read on every commit;
  - the **full** test + lint + type-check gate runs **once** at the end; each commit only runs the focused tests for its change.
- **Discipline that survives.** TDD-first, simplify-before-every-commit, surgical (minimal-diff) changes, Conventional Commits, branch + PR by default.
- **Self-contained.** Each command inlines its own workflow; skills are read on demand by relevance.

## Slash commands (`/agent-toolkit:...`)

| Command | What it does |
|---|---|
| `/implement <task>` | TDD-first implementer. Plan + reuse scan → **write failing tests first** → per-commit loop (code → simplify → focused tests → commit) → one full-suite verify → open a PR with an **Intent / What changed / Risk / Testing** body. |
| `/fix <finding>` | Surgical fixer for a single finding (review comment, bug, lint flag). Understand → route to the right skill → decide (fix / push back / escalate) → minimal fix → simplify → verify → commit. **Refuses patch-mindset fixes** (swallowed exceptions, sleep-to-fix-a-flake, ignore annotations) unless justified. PR/update note leads with a **Risk** rating. |
| `/refactor <task>` | Tier-gated refactoring (**T1** local / **T2** cross-module / **T3** architectural) driven by the `refactoring-strategy` playbook. Classify → (write characterization tests if none exist) → plan → per-commit execute with simplify → full verify. **Behavior must not change** (Two Hats Rule); T3 enters plan mode for approval first. |
| `/agent-issue <rough task>` | Socratic issue-crafting wizard. Runs `interview-me` (one anchored question at a time) to ~95% intent confidence, restates the intent, expands it into a structured GitHub issue, and files it via `gh issue create`. |

## Skills

Skills auto-load when Claude Code matches their `description` to the work at hand. **16 skills**, grouped:

**Issue & planning**
| Skill | Purpose |
|---|---|
| `interview-me` | One-question-at-a-time intent extraction (anchored guesses, confidence tracking, out-of-scope gate). Underlies `/agent-issue`. |
| `planning-and-task-breakdown` | Decompose work into ordered, independently verifiable tasks with explicit acceptance criteria. |

**Implementation discipline**
| Skill | Purpose |
|---|---|
| `test-driven-development` | Failing test first; "Prove-It" reproduction test for bug fixes. |
| `incremental-implementation` | Thin vertical slices; keep the build green between slices. |
| `reuse-before-you-build` | Before introducing any new symbol, scan for an existing sibling and apply the right default per category (4-bucket reuse / mirror / new model + flow-level escalation for multi-step flows). |
| `code-simplification` | Strip dead branches, redundant guards, single-use helpers, restating comments — without changing behavior. |
| `comment-discipline` | What comments to write, keep, trim, or delete; catches docstring bloat and unjustified lint suppressions. Applied per-commit. |
| `doubt-driven-development` | Fresh-context adversarial review before a non-trivial decision stands. **Opt-in / high-stakes only.** |

**Debugging & refactoring**
| Skill | Purpose |
|---|---|
| `debugging-and-error-recovery` | Six-step root-cause triage: Reproduce → Localize → Reduce → Fix → Guard → Verify. |
| `refactoring-strategy` | Tier-gated structural playbook: Parallel Change, Strangler Fig, Branch by Abstraction, Mikado Method, characterization tests, Two Hats Rule, stop-and-ask triggers. |

**Review & quality**
| Skill | Purpose |
|---|---|
| `code-review-and-quality` | Multi-axis interactive review: correctness, readability, architecture, security, performance. (For headless CI review, use the pipeline below.) |

**Design & engineering**
| Skill | Purpose |
|---|---|
| `api-and-interface-design` | Stable interfaces, Hyrum's Law, module boundaries; REST/GraphQL contracts. |
| `security-and-hardening` | Input validation, parameterized queries, auth, secrets, security headers, OWASP basics (multi-ecosystem). |
| `performance-optimization` | Measure-before-optimize discipline; profiling workflow. |
| `deprecation-and-migration` | Safely sunset old systems; migrate users from old to new. |

**Git**
| Skill | Purpose |
|---|---|
| `git-workflow-and-versioning` | Trunk-based development, atomic commits, Conventional Commits. |

## Automated PR-review pipeline

A headless, CI-friendly reviewer wired as two `claude -p` stages plus a deterministic renderer — it produces a single GitHub review and **never posts from a model**:

1. **`code-review-bot`** (FIND) — emits structured findings (severity + confidence + evidence + a punchy title) to a JSON file. Posts nothing. Accepts an optional intent/PR-description so it can tell a *deliberate choice* from a mistake. Treats compiler/test/linter signals as high-confidence facts.
2. **`code-review-refuter`** (VERIFY) — a **fresh-process** skeptic that tries to *refute* each candidate finding against the actual code, keeping only the defensible ones with a post-verification confidence. The separate process is the main false-positive killer: a finding and its self-refutation from the same pass share the same blind spot.
3. **`scripts/render-review.mjs`** — deterministic gate + renderer (Node ESM or Bun, no dependencies). Drops findings below the confidence gate (`CONFIDENCE_MIN`, default 60), caps inline comments at 8, and emits a CodeRabbit-style GitHub-review payload. Verdict is `REQUEST_CHANGES` only if a surviving finding is high-severity, else a neutral `COMMENT`. A CI step posts the payload it writes — the script itself posts nothing.

See [`agent-toolkit/scripts/README.md`](agent-toolkit/scripts/README.md) for the exact env inputs and outputs.

## Configuration

The toolkit reads your repo's conventions rather than imposing them:

- **Commands**: put your test / lint / build / type-check commands in `CLAUDE.md` or `AGENTS.md`. The agent runs whatever you define; nothing is hardcoded.
- **Framework skills**: if your repo ships framework-specific skills under `.claude/skills/` (state management, rendering, concurrency, …), the commands load the ones matching the code being touched.
- **`/agent-issue` labels**: issues are filed with an `agent` label by default (to fire an automated agent pipeline). No pipeline? Pick **"File as draft"** in the picker to file without the label. It also discovers your repo's real labels via `gh label list`.

## Repo layout

```
.claude-plugin/marketplace.json        # marketplace entry → ./agent-toolkit
agent-toolkit/
  .claude-plugin/plugin.json           # plugin manifest
  commands/                            # /implement /fix /refactor /agent-issue
  skills/                              # 16 skills + the 2-skill PR-review pipeline
  scripts/render-review.mjs            # deterministic review renderer
```

## Attribution

- Most process skills are **adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)** (MIT, © Addy Osmani) — `api-and-interface-design`, `code-review-and-quality`, `code-simplification`, `debugging-and-error-recovery`, `deprecation-and-migration`, `doubt-driven-development`, `git-workflow-and-versioning`, `incremental-implementation`, `interview-me`, `performance-optimization`, `planning-and-task-breakdown`, `security-and-hardening`, `test-driven-development`. Each retains an adaptation-note header pointing at the upstream source; code examples have been genericized across languages.
- **Original to this repo**: `refactoring-strategy`, `reuse-before-you-build`, `comment-discipline`, and the automated PR-review pipeline (`code-review-bot`, `code-review-refuter`, `scripts/render-review.mjs`).
- `refactoring-strategy` is synthesized from Fowler's *Refactoring* (2nd ed.), Feathers' *Working Effectively with Legacy Code*, Sato's Parallel Change, Humble's Branch by Abstraction, Brolund & Ellnestam's Mikado Method, Beck, Metz, Spolsky, Anthropic's `code-modernization` plugin, CodeScene's *Agentic AI Coding* patterns, Kiro's *Refactoring Made Right*, and citypaul's refactoring SKILL.md. Full source list inside the skill.

## License

MIT. See [LICENSE](./LICENSE).
