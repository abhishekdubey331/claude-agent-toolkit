# claude-agent-toolkit

A personal [Claude Code](https://claude.com/claude-code) plugin marketplace. Bundles Socratic issue crafting, incremental implementation, surgical bug-fixing, and code simplification as installable commands + skills.

## Install

```
/plugin marketplace add abhishekdubey331/claude-agent-toolkit
/plugin install agent-toolkit@claude-agent-toolkit
```

Update later:

```
/plugin update agent-toolkit@claude-agent-toolkit
```

## What's inside

### Slash commands (`/agent-toolkit:...`)

| Command | Purpose |
|---|---|
| `/implement` | Interactive 7-phase implementer protocol: read CLAUDE.md → write failing tests → implement → simplify → verify. |
| `/fix` | Interactive 7-phase fixer protocol: reproduce → root-cause → fix → guard → verify. Refuses symptom patches. |
| `/agent-issue` | Socratic issue-crafting wizard: anchored questions until ~95% intent confidence, then expands into a structured GitHub issue body and files via `gh issue create`. |

### Skills (auto-loaded when relevant)

**Workflow & process**

| Skill | When it loads |
|---|---|
| `interview-me` | Underlies `/agent-issue` — anchored-guess questioning, confidence tracking, out-of-scope gate. |
| `planning-and-task-breakdown` | Decompose work into small, verifiable tasks with explicit acceptance criteria. |
| `incremental-implementation` | Thin vertical slices; build green between slices. |
| `test-driven-development` | Failing test first; "Prove-It Pattern" for bug fixes. |
| `code-simplification` | Strip dead branches, defensive null-checks, single-use helpers, restating-comments — without changing behavior. |
| `refactoring-strategy` | Tier-gated structural refactoring playbook: Parallel Change, Strangler Fig, Branch by Abstraction, Mikado Method, characterization tests, Two Hats Rule, stop-and-ask triggers. |
| `doubt-driven-development` | Spawn fresh-context adversarial reviewer before non-trivial decisions. |
| `code-review-and-quality` | Five-axis review: correctness, readability, architecture, security, performance. |
| `debugging-and-error-recovery` | Six-step triage: Reproduce → Localize → Reduce → Fix → Guard → Verify. |
| `git-workflow-and-versioning` | Trunk-based development, atomic commits, Conventional Commits. |

**Design & engineering**

| Skill | When it loads |
|---|---|
| `api-and-interface-design` | Hyrum's Law, stable interfaces, deprecation-aware design. REST/GraphQL, module boundaries, component props. |
| `security-and-hardening` | Input validation, parameterized queries, auth, secrets, headers, OWASP basics. |
| `performance-optimization` | Measure-before-optimize discipline; profiling workflow. |
| `deprecation-and-migration` | Safely remove old systems; migrate users from old to new. |

## Notes

- `/implement` and `/fix` were originally written for an Android + Jetpack Compose codebase (gradle test commands, Compose-specific simplify rules). When using on a non-Android project, you'll want to swap `./gradlew testDebugUnitTest` → your project's test command. Customize per-repo by copying into `.claude/commands/` and editing.
- `/agent-issue` files issues with an `agent` label by default (for an automated agent pipeline). If you don't have that pipeline, pick "File as draft" in the picker to file without the label.

## Attribution

Most skills under `agent-toolkit/skills/` are adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT, © Addy Osmani). Each skill file retains its adaptation-note header pointing at the upstream source.

The `refactoring-strategy` skill is original to this repo, synthesized from Fowler's *Refactoring* (2nd ed.), Feathers' *Working Effectively with Legacy Code*, Sato's Parallel Change, Humble's Branch by Abstraction, Brolund & Ellnestam's Mikado Method, Beck, Metz, Spolsky, Anthropic's `code-modernization` plugin, CodeScene's *Agentic AI Coding* patterns, Kiro's *Refactoring Made Right*, and citypaul's refactoring SKILL.md. Full source list inside the skill.

## License

MIT. See [LICENSE](./LICENSE).
