---
description: Apply a minimal targeted fix to a specific finding using the project's full fixer protocol — all relevant skills loaded, simplify mini-pass, verify gate, conventional commits. Self-contained — does not rely on you reading the canonical pipeline workflow.
argument-hint: <finding description, ideally with file:line and the concern>
---

You are addressing a single finding (review comment, bug report, lint flag, audit note) using this repo's full fixer discipline — the **same** protocol the headless `claude-fixer.yaml` pipeline applies to pull-panda comments, but interactive. This command body does not rely on you reading the canonical `.github/agent-prompts/fixer.md` — its protocol is fully inlined below. (Skill files under `.claude/skills/` are still external reads, invoked on demand per the routing rules in Phase 2.)

**Finding:**

$ARGUMENTS

---

# Phase 0 — Mandatory reads (do not skip)

Before any code change:

1. **`CLAUDE.md`** at the repo root. Read all 6 sections. §3 (Surgical Changes) and §5 (Bug-Fix Discipline) are the load-bearing sections for fixer work. §5 explicitly forbids the patch-mindset fixes that are tempting under interactive pressure.
2. **`REVIEW.md`** at the repo root. Read the severity table + "Always check" list. Lets you judge whether the finding is 🔴/🟠/🟡 and whether your fix accidentally violates any always-check item.

These reads are non-negotiable. Confirm + skip only if already read this session.

---

# Phase 1 — Read the file, understand the concern

- Open the file at the cited line (or grep for the symbol if the finding doesn't give a line). Read ~30 lines around it for context.
- Read the surrounding function/class to understand what it's trying to do.
- Read any tests that exercise this code path. If they look thin, that's a signal the original behavior wasn't well-pinned — proceed carefully.
- **Restate the concern in one sentence to the user before fixing.** This catches misunderstandings early.

---

# Phase 2 — Route to the right skill (BEFORE writing the fix)

Match the finding's shape against the skill list. Read each matching skill **now** — not after the fix.

## Addy Osmani process skills

- **`.claude/skills/debugging-and-error-recovery.md`** — REQUIRED if the finding describes a failing test, broken build, or unexpected behavior. Six-step triage: Reproduce → Localize → Reduce → Fix → Guard → Verify. Don't push past a failing test; don't "fix" a flake with `Thread.sleep`. CLAUDE.md §5 forbids those.
- **`.claude/skills/doubt-driven-development.md`** — REQUIRED if the finding asks you to assert a non-trivial correctness property (thread-safety, idempotence, no-leak, exactly-once, ordering guarantee). Spawn a fresh-context adversarial subagent on your proposed fix BEFORE committing. Interactive mode has no pull-panda; this is the substitute.
- **`.claude/skills/incremental-implementation.md`** — REQUIRED if the finding implies changes across >1 file. Thin slices, one commit per logical change, build green between slices.
- **`.claude/skills/code-simplification.md`** — DEFERRED until Phase 6 (the fix's simplify pass).

## Compose skills — MANDATORY if the finding cites a `@Composable`

Any `.kt` file under `app/src/main/.../ui/` or any function annotated `@Composable`. REVIEW.md grades 🔴 against patch-style fixes that violate these. A `?.let { }` or `try/catch` slapped onto a Compose finding will earn another `needs-fixes`.

Start with `compose-state-authoring`; it routes.

- **`.claude/skills/compose-state-authoring.md`** — bare `var` in `@Composable`, `mutableStateOf` vs `mutableStateListOf`, `@ReadOnlyComposable` violations
- **`.claude/skills/compose-state-hoisting.md`** — state at the wrong level
- **`.claude/skills/compose-state-holder-ui-split.md`** — ViewModel + layout mixed in one Composable
- **`.claude/skills/compose-side-effects.md`** — `LaunchedEffect(Unit)` with changing keys, stale captures, missing `DisposableEffect` cleanup
- **`.claude/skills/compose-recomposition-performance.md`** — needless recomposition, layout→composition back-write, missing `derivedStateOf`
- **`.claude/skills/compose-stability-diagnostics.md`** — unstable params, list/map without stable keys, Konfetti-style rebuilds
- **`.claude/skills/compose-modifier-and-layout-style.md`** — parent-decides-placement, modifier-chain order
- **`.claude/skills/compose-state-deferred-reads.md`** — frame-rate State reads in composition, `onSizeChanged { stateWrite }` back-write

---

# Phase 3 — Decide: fix, push back, or escalate

For each finding, you have three valid responses:

1. **Fix it.** Most common. Proceed to Phase 4.
2. **Push back.** If you genuinely believe the finding is wrong (🟡 nit you disagree with, or 🔴 that doesn't actually apply on closer reading), surface the disagreement to the user with reasoning. Don't silently ignore. The user decides.
3. **Escalate.** If the finding implies a deeper architectural change beyond the scope of this fix, say so. Don't try to solve a system-design problem under "fix this lint".

Patch-mindset traps (CLAUDE.md §5 — these are 🔴 unless commit body explains why root cause can't be addressed):

- `try/catch` that swallows the exception
- `?.let { }` / `?: return` on a value that should never be null
- `Thread.sleep` / `delay` / retry loop "fixing" a flake
- `@Ignore`, `@Disabled`, `// TODO: re-enable` on a failing test
- `@Suppress` on a lint/detekt rule without commit-body justification
- Timeout increase without explaining the slow path

If you find yourself reaching for any of the above, stop and surface the trade-off explicitly. The user can override; you can't choose silently.

---

# Phase 4 — Apply the minimal targeted fix

- **Read the file again at the line. Touch only the code that addresses the finding.**
- Do NOT refactor adjacent code, even if it's tempting. CLAUDE.md §3.
- Do NOT "improve" naming, comments, or formatting outside the finding's scope.
- If the finding is in `@Composable` code and a compose-* skill suggests a different pattern, follow the skill — but only for the lines covered by the finding.
- If your fix made a non-trivial correctness claim (thread-safety, idempotence, etc.), invoke `.claude/skills/doubt-driven-development.md` BEFORE committing.

Commit with subject prefix `chore(agent-fix):` followed by a short summary (matches what the headless fixer produces, so commit history stays consistent across interactive + pipeline runs).

Example:
```
chore(agent-fix): null-guard ConfigRepository.lastFetchTimestamp on cold start
```

Body explains the why if non-obvious. Keep subject under 60 chars.

---

# Phase 5 — Run the verify gate

- `./gradlew testDebugUnitTest` — green, including any new test you added
- `./gradlew detekt` — no new findings on the touched file

If either fails, do not proceed. Fix and re-run.

**Never delete or weaken existing tests.** If the finding suggests adding a test, add a new one — don't modify existing ones. If a test that previously passed now fails because of your fix, you changed behavior beyond what the finding required — revisit Phase 4.

---

# Phase 6 — Mini simplify pass (sized to the fix's scope)

Read **`.claude/skills/code-simplification.md`** if you haven't this session.

Apply it ONLY to the lines your fix touched. Scope:

- Did your fix add a defensive null-check the type system already guarantees? Remove.
- Did you add a comment that restates what the code says? Remove.
- Did you wrap a non-throwing call in `try/catch`? Remove.
- Did you add a single-use helper that could be inlined? Inline.

**Re-run tests after.** If a simplification requires test changes, revert it.

This pass is small (a fix is small) but matters — fixer commits accumulate, and noise in each one compounds.

---

# Phase 7 — Final pre-stop checklist

Before saying done:

- [ ] CLAUDE.md + REVIEW.md were read (Phase 0)
- [ ] Concern was understood and restated to the user (Phase 1)
- [ ] Matching skill(s) were read BEFORE writing the fix (Phase 2)
- [ ] If the finding cited a `@Composable`, the compose-state-authoring skill (at minimum) was read
- [ ] If non-trivial correctness claim, doubt-driven-development was invoked
- [ ] Fix is minimal — touches only the lines the finding addresses
- [ ] No patch-mindset trap (CLAUDE.md §5 list) without commit-body justification
- [ ] `./gradlew testDebugUnitTest` is green
- [ ] `./gradlew detekt` shows no new findings
- [ ] Mini simplify pass was run (Phase 6) and tests still green
- [ ] No existing test was deleted, weakened, or `@Ignore`d
- [ ] Commit uses `chore(agent-fix):` prefix, subject ≤60 chars

If any box is unchecked, do not stop.

---

# Hard rules (adapted for interactive mode)

- **Don't switch branches.** Stay where you are; the user picked it.
- **Don't push or open a PR.** Stop after Phase 7; user pushes.
- **Never edit files under `.github/`** — CODEOWNERS gates anyway.
- **Never run destructive operations** — `rm -rf`, `git reset --hard`, `git push --force`, branch deletion of main. Don't propose them either.
- **If you can't fix the finding** (missing context, unclear requirement, architectural mismatch), surface the blocker explicitly. Don't fake-finish or pretend ambiguity is resolved.

---

# Stop condition

You're done when Phase 7's checklist is fully satisfied AND you've told the user what changed + what's left (typically: push the commit).
