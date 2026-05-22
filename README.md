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

| Skill | When it loads |
|---|---|
| `interview-me` | Underlies `/agent-issue` — anchored-guess questioning, confidence tracking, out-of-scope gate. |
| `incremental-implementation` | Thin vertical slices; build green between slices. |
| `debugging-and-error-recovery` | Six-step triage: Reproduce → Localize → Reduce → Fix → Guard → Verify. |
| `doubt-driven-development` | Spawn fresh-context adversarial reviewer before non-trivial decisions. |
| `code-simplification` | Strip dead branches, defensive null-checks, single-use helpers, restating-comments — without changing behavior. |

## Notes

- `/implement` and `/fix` were originally written for an Android + Jetpack Compose codebase (gradle test commands, Compose-specific simplify rules). When using on a non-Android project, you'll want to swap `./gradlew testDebugUnitTest` → your project's test command. Customize per-repo by copying into `.claude/commands/` and editing.
- `/agent-issue` files issues with an `agent` label by default (for an automated agent pipeline). If you don't have that pipeline, pick "File as draft" in the picker to file without the label.

## Attribution

The following skills are adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT):

- `interview-me`
- `code-simplification`
- `incremental-implementation`
- `debugging-and-error-recovery`
- `doubt-driven-development`

Each skill file retains its adaptation-note header.

## License

MIT. See [LICENSE](./LICENSE).
