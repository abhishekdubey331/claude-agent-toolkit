# claude-agent-toolkit

**A lean, language- and platform-agnostic workflow for shipping AI-written code without the slop.**

Commands and skills that encode the discipline senior engineers bring to production code — Socratic issue crafting, TDD-first implementation, surgical bug-fixing, tier-gated refactoring, and adversarial PR review — packaged so an AI agent follows them consistently. Tuned to be **cheap on tokens**: skills are read once and applied from memory, the expensive adversarial passes are opt-in, and the full test gate runs once at the end.

---

## Commands

Four slash commands that map to the development lifecycle. Each one activates the right skills automatically.

| What you're doing | Command | Key principle |
|-------------------|---------|---------------|
| Turn a rough idea into a spec'd issue | `/agent-issue` | Intent before code |
| Build a feature or task | `/implement` | Test first, simplify every commit |
| Fix a specific finding | `/fix` | Root cause, not symptom |
| Restructure existing code | `/refactor` | Behavior must not change |

Skills also activate automatically based on what you're doing — designing an interface triggers `api-and-interface-design`, restructuring code triggers `refactoring-strategy`, handling untrusted input triggers `security-and-hardening`, and so on.

---

## Quick Start

<details>
<summary><b>Claude Code (recommended)</b></summary>

**Marketplace install:**

```
/plugin marketplace add abhishekdubey331/claude-agent-toolkit
/plugin install agent-toolkit@claude-agent-toolkit
```

Update later:

```
/plugin update agent-toolkit@claude-agent-toolkit
```

**Local / development:**

```bash
git clone https://github.com/abhishekdubey331/claude-agent-toolkit.git
claude --plugin-dir /path/to/claude-agent-toolkit/agent-toolkit
```

</details>

<details>
<summary><b>Cursor / Codex / other agents</b></summary>

The skills under `agent-toolkit/skills/` are plain Markdown — copy the ones you want into your agent's rules/instructions directory (e.g. `.cursor/rules/`), or reference the directory. The slash commands are Claude Code-specific, but each one inlines its full workflow, so the body can be pasted as instructions into any agent that accepts system prompts or instruction files.

</details>

---

## All 18 Skills

The commands above are entry points. The pack includes 18 skills total — 16 lifecycle skills plus a 2-skill automated PR-review pipeline. Each skill is a structured workflow with steps, verification gates, and anti-rationalization tables. You can also reference any skill directly.

### Define - Clarify what to build

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [interview-me](agent-toolkit/skills/interview-me.md) | One-question-at-a-time interview that extracts what the user actually wants instead of what they think they should want, to ~95% confidence | The ask is underspecified, or the user invokes "interview me" / "are we sure?" |

### Plan - Break it down

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [planning-and-task-breakdown](agent-toolkit/skills/planning-and-task-breakdown.md) | Decompose a spec into small, ordered, independently verifiable tasks with acceptance criteria | You have requirements and need implementable units |

### Build - Write the code

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [test-driven-development](agent-toolkit/skills/test-driven-development.md) | Failing test first; the Prove-It reproduction test for bug fixes | Implementing logic, fixing a bug, or changing behavior |
| [incremental-implementation](agent-toolkit/skills/incremental-implementation.md) | Thin vertical slices — implement, test, verify, commit; green between slices | Any change touching more than one file |
| [reuse-before-you-build](agent-toolkit/skills/reuse-before-you-build.md) | Scan for an existing sibling before any new symbol; apply the right default per category (reuse / mirror / new) plus flow-level escalation | About to introduce a new component, type, helper, or multi-step flow |
| [code-simplification](agent-toolkit/skills/code-simplification.md) | Strip dead branches, redundant guards, single-use helpers, restating comments — without changing behavior | Code works but is harder to read than it should be |
| [comment-discipline](agent-toolkit/skills/comment-discipline.md) | What comments to keep, trim, or delete; catches docstring bloat and unjustified lint suppressions | Writing or editing comments (runs per-commit) |
| [doubt-driven-development](agent-toolkit/skills/doubt-driven-development.md) | Fresh-context adversarial review of a non-trivial decision in-flight — CLAIM → EXTRACT → DOUBT → RECONCILE → STOP. **Opt-in, high-stakes only** | An irreversible/high-stakes call a passing test can't cover |
| [api-and-interface-design](agent-toolkit/skills/api-and-interface-design.md) | Contract-first design, Hyrum's Law, error semantics, boundary validation | Designing an API, module boundary, or public interface |

### Verify - Prove it works

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [debugging-and-error-recovery](agent-toolkit/skills/debugging-and-error-recovery.md) | Six-step root-cause triage: Reproduce → Localize → Reduce → Fix → Guard → Verify | A test fails, a build breaks, or behavior is unexpected |

### Review - Quality gates before merge

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [code-review-and-quality](agent-toolkit/skills/code-review-and-quality.md) | Multi-axis review: correctness, readability, architecture, security, performance | Before merging any change (interactive) |
| [security-and-hardening](agent-toolkit/skills/security-and-hardening.md) | OWASP basics, input validation, auth patterns, secrets, dependency auditing | Handling untrusted input, auth, storage, or external integrations |
| [performance-optimization](agent-toolkit/skills/performance-optimization.md) | Measure-first approach — profiling workflow, anti-pattern detection | Performance requirements exist or you suspect a regression |

### Refactor - Restructure safely

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [refactoring-strategy](agent-toolkit/skills/refactoring-strategy.md) | Tier-gated playbook: Parallel Change, Strangler Fig, Branch by Abstraction, Mikado Method, Two Hats Rule | Restructuring beyond one function — moves, signature changes, untangling dependencies |

### Ship - Land it

| Skill | What It Does | Use When |
|-------|-------------|----------|
| [git-workflow-and-versioning](agent-toolkit/skills/git-workflow-and-versioning.md) | Trunk-based development, atomic commits, Conventional Commits | Making any code change |
| [deprecation-and-migration](agent-toolkit/skills/deprecation-and-migration.md) | Code-as-liability mindset; safe sunset and user migration patterns | Removing old systems, migrating users, or sunsetting features |

---

## Automated PR-review pipeline

A headless, CI-friendly reviewer wired as two `claude -p` stages plus a deterministic renderer. It produces a single GitHub review and **never posts from a model** — a CI step posts the payload the renderer writes.

| Stage | Component | What it does |
|-------|-----------|--------------|
| FIND | [code-review-bot](agent-toolkit/skills/code-review-bot.md) | Emits structured findings (severity + confidence + evidence + a punchy title) to JSON. Accepts optional intent so it can tell a deliberate choice from a mistake. Posts nothing. |
| VERIFY | [code-review-refuter](agent-toolkit/skills/code-review-refuter.md) | A **fresh-process** skeptic that tries to refute each candidate finding against the code, keeping only the defensible ones with a post-verification confidence. The separate process is the main false-positive killer. |
| RENDER | [scripts/render-review.mjs](agent-toolkit/scripts/render-review.mjs) | Deterministic gate + renderer (Node ESM or Bun, no deps). Drops findings below the confidence gate, caps inline comments, and emits a CodeRabbit-style review payload. `REQUEST_CHANGES` only on a surviving high-severity finding, else a neutral `COMMENT`. |

For interactive, human-facing review, use [code-review-and-quality](agent-toolkit/skills/code-review-and-quality.md) instead.

---

## How Skills Work

Every skill follows a consistent anatomy:

```
┌─────────────────────────────────────────────────┐
│  <skill>.md                                     │
│                                                 │
│  ┌─ Frontmatter ─────────────────────────────┐  │
│  │ name: lowercase-hyphen-name               │  │
│  │ description: …Use when…                   │  │
│  └───────────────────────────────────────────┘  │
│  Overview         → What this skill does        │
│  When to Use      → Triggering conditions       │
│  Process          → Step-by-step workflow       │
│  Rationalizations → Excuses + rebuttals         │
│  Red Flags        → Signs something's wrong     │
│  Verification     → Evidence requirements       │
└─────────────────────────────────────────────────┘
```

**Key design choices:**

- **Process, not prose.** Skills are workflows agents follow, not reference docs they read — steps, checkpoints, exit criteria.
- **Anti-rationalization.** Each skill carries a table of common excuses agents use to skip steps ("I'll add tests later") with documented counter-arguments.
- **Verification is non-negotiable.** Every workflow ends with evidence requirements — tests passing, build output, a runnable check. "Seems right" is never sufficient.
- **Language/platform-agnostic.** Nothing hardcodes a toolchain. Commands name your test / lint / build / type-check steps *by role*; you define the concrete commands once in `CLAUDE.md` or `AGENTS.md` and the agent uses them. Works on any stack.
- **Cost-lean by default.** The expensive paths are opt-in: adversarial review (`doubt-driven-development`) is reserved for genuinely high-stakes calls, skill files are read once and applied from memory rather than re-read per commit, and the full test/lint gate runs once at the end while each commit runs only its focused tests.

---

## Project Structure

```
claude-agent-toolkit/
├── .claude-plugin/
│   └── marketplace.json               # marketplace entry → ./agent-toolkit
├── agent-toolkit/
│   ├── .claude-plugin/plugin.json     # plugin manifest
│   ├── commands/                      # 4 slash commands
│   │   ├── agent-issue.md             #   Define
│   │   ├── implement.md               #   Build
│   │   ├── fix.md                     #   Fix
│   │   └── refactor.md                #   Refactor
│   ├── skills/                        # 16 lifecycle skills + 2-skill review pipeline
│   └── scripts/
│       └── render-review.mjs          # deterministic PR-review renderer
├── README.md
└── LICENSE
```

---

## Why claude-agent-toolkit?

AI coding agents default to the shortest path — skipping specs, tests, reuse checks, and the practices that make software reliable. This toolkit gives the agent structured workflows that enforce the same discipline a senior engineer brings to production code: *when* to clarify intent, *what* to test, *how* to keep a change minimal, and *when* to apply expensive scrutiny.

Two things make it distinct from a generic skill pack:

- **It's stack-neutral.** The same `/implement` works on a Node service, a Python CLI, or an Android app — it reads your repo's conventions instead of imposing one toolchain.
- **It's tuned for cost.** Every heavy step earns its keep. Adversarial review and full-suite verification are deliberate, not reflexive, so a routine feature doesn't quietly cost ten times what it should.

The process skills are adapted from Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills) — genericized across languages and trimmed for token cost — alongside original work: a tier-gated `refactoring-strategy`, a symbol-level `reuse-before-you-build` gate, and the adversarial FIND → VERIFY PR-review pipeline.

---

## Contributing

Skills should be **specific** (actionable steps, not vague advice), **verifiable** (clear exit criteria with evidence requirements), **language-agnostic** (name tools by role, not by toolchain), and **minimal** (only what's needed to guide the agent — every line costs tokens on every run).

---

## License

MIT — use these commands and skills in your projects, teams, and tools. See [LICENSE](./LICENSE).
