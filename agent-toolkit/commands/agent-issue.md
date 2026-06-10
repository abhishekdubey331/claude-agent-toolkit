---
description: Interactively craft a high-quality GitHub issue for the `agent` pipeline. Runs the interview-me Socratic protocol until ~95% intent confidence, then serializes the result into a structured issue body and files it via `gh issue create`. Use this when you have a rough task in mind and want the pipeline to do its best work on it.
argument-hint: <rough task description, e.g. "add swipe-to-dismiss to the result screen">
---

You're about to craft a GitHub issue that will be picked up by the `agent`-labeled pipeline (or used as a personal spec). Pipeline output quality is bounded by issue spec quality — vague specs cause implementer thrash and extra fixer cycles. This command's job is to close the spec gap BEFORE any worktree spins up.

**Rough task:**

$ARGUMENTS

---

# Phase 1 — Run the interview-me protocol

Load the **`interview-me`** skill in full now. Then execute its protocol on the rough task above. Drive the interview to ≥95% intent confidence.

## How to ask questions: prefer `AskUserQuestion`, fall back to chat

For every question that has 2-4 reasonable concrete options, **use the `AskUserQuestion` tool**. It renders a real picker UI: 2-4 options + an auto-provided "Other" slot for free-text. The user sees crisp choices AND can override with a custom answer. This is the right shape for most interview questions.

Use plain chat (conversational free-text) ONLY when the question genuinely has no enumerable options (e.g., "describe the symptom you saw" — open-ended description) OR when you've truly exhausted options and need the user to type something specific.

For questions where the answer space is naturally a set (single choice OR multi-pick), AskUserQuestion is better. Examples:

| Question shape | Tool | Example |
|---|---|---|
| Single-select with concrete options | AskUserQuestion (multiSelect: false) | "Which user is affected: free / paid / both?" |
| Multi-select where >1 can apply | AskUserQuestion (multiSelect: true) | "Which areas does this touch? (pick all)" |
| Anchored guess with confirm/refine | AskUserQuestion (single-select with the guess as first option) | "I think you mean *per-user adaptive*. (a) yes that's it, (b) no, globally harder, (c) something else" |
| Free-text description | Chat | "What does the user see when this happens? Describe in 1-2 lines." |
| Yes/no confirmation | AskUserQuestion (multiSelect: false, 2 options) | "Same behavior on tablets too? (Yes / No)" |

When using AskUserQuestion: keep `description` short (one line, names the trade-off), put your best guess first with "(Recommended)" appended to the label, max 4 options. The user can always pick "Other" and free-text — don't worry about exhaustiveness; cover the 80% case.

## Discipline rules (mirroring interview-me — do not relax)

- **One question at a time.** No batched lists in a single AskUserQuestion call unless they're genuinely independent (and even then prefer separate turns). Wait for the user's answer before the next question.
- **Attach your best guess.** When using AskUserQuestion, your best guess is the first option labelled "(Recommended)". When using chat, prefix with "I think it's X. Confirm or correct?" — never "What is X?" with no anchor.
- **State your current confidence number** (e.g. "70%") before each new question, in the question stem itself or as a one-line preface.
- **Refuse "whatever you think is best."** If the user picks an option that defers ("you decide" / "Other: idk") restate the trade-off concretely and re-ask ("If I pick A, then B becomes impossible. If I pick B, then A becomes harder. Which constraint matters more?").
- **Explicit out-of-scope gate.** Before stopping, ask "What is *not* in scope?" — this catches scope creep that would otherwise leak in during implementation. Use AskUserQuestion with multi-select on the likely scope-creep candidates plus "Other".
- **Don't proceed to Phase 2 without an explicit "yes"** from the user to a restated-intent block.

Stop interviewing when you can predict the user's next answer with ≥95% confidence on every remaining open question. Typically 4–8 questions for a feature, 2–4 for a bug.

---

# Phase 2 — Restate intent + get explicit confirmation

Show the user a restated-intent block before serializing. Format:

```
Here's what I understand:
- WHAT: <one-line description of the change>
- WHO benefits: <user role / stakeholder>
- WHY now: <triggering need / problem this solves>
- ACCEPTANCE: how we'll know it's done (≤3 bullets)
- OUT OF SCOPE: what we explicitly aren't doing in this issue
- RISK: what could break if we get this wrong

Yes / no / refine?
```

If "no" or "refine" — go back to Phase 1. Don't proceed on a "yeah I guess".

If "yes" — proceed to Phase 3.

---

# Phase 3 — Expand into GitHub issue body

Transform the restated intent into this exact structure:

```markdown
## Summary

<one-line user-facing description of the change>

## Problem

<2-4 sentences: who is affected, what's the friction today, why this matters now. No implementation detail.>

## Acceptance criteria

- [ ] <testable condition 1 — observable, not internal>
- [ ] <testable condition 2>
- [ ] <testable condition 3 if needed; keep ≤5>

## Out of scope

- <explicit non-goal 1 — typical scope-creep risks>
- <explicit non-goal 2 if applicable>

## Edge cases to consider

- <case + expected behavior>
- <case + expected behavior>

## Rollback / risk

<one paragraph: what's the blast radius if this ships broken; how do we revert; is there a feature flag / remote config kill switch>

## Suggested labels

`agent`, `<area:...>`, `<type:...>`, `<severity:... if bug>`
```

Discover the repo's real labels first by running `gh label list`, then suggest the best-fitting labels from that output. If the repo has no relevant labels yet, fall back to generic placeholders: `area:<x>`, `type:feature|bug|chore`, `severity:critical|high|medium`. Always include `agent` (required for pipeline trigger).

Notes for the issue body:
- **No file paths or line numbers.** They go stale and the implementer should find the right place via the codebase. The exception is when the finding is specifically about a known location.
- **No implementation prescription.** The acceptance criteria describe observable behavior, not "use X library" or "modify Y class". Let the implementer find the pattern.
- **Match the repo's existing issue voice.** Read 2-3 existing issues with the relevant `area:*` label via `gh issue list --label area:... --limit 3 --json title,body` to calibrate tone and shape.

---

# Phase 4 — Show body to user before filing

Print the full issue body to the user as a code-fenced block. Then use **`AskUserQuestion`** with these 4 options (single-select):

| Label | Description |
|---|---|
| `File + fire pipeline` (Recommended) | Create the issue with the `agent` label — fires the implementer pipeline within ~30s |
| `File as draft` | Create the issue WITHOUT the `agent` label — you can label later via `gh issue edit N --add-label agent` |
| `Copy only` | Don't file. Print the body for manual copy-paste into the GitHub UI |
| `Discard` | Throw away. Nothing happens. |

**Never file the issue without showing the body first.** The AskUserQuestion picker is the gate — there is no "skip and file automatically" path.

If the user picks "Other" via the picker UI, treat it as a refinement request: ask them what they want to change about the body, edit, re-show, re-ask.

---

# Phase 5 — File or print

Based on the user's selection in Phase 4:

**`File + fire pipeline`** — pipeline triggers:

```bash
gh issue create \
  --title "<title>" \
  --body "$(cat <<'EOF'
<the issue body>
EOF
)" \
  --label agent \
  $(for L in $SUGGESTED_LABELS; do printf -- '--label %s ' "$L"; done)
```

Print the resulting issue URL. Tell the user the pipeline will pick it up; expected wall-clock to PR is 5–15 minutes depending on scope.

**`File as draft`** — no pipeline trigger:

Same `gh issue create` but drop the `--label agent`. Print URL; tell the user to add the `agent` label when ready (`gh issue edit N --add-label agent`).

**`Copy only`** — don't file:

Wrap the issue body in a code fence so it's copy-pasteable verbatim. Don't run `gh`.

**`Discard`**:

Throw away. Confirm to the user.

---

# Hard rules (across all phases)

- **Load the `interview-me` skill before Phase 1.** The protocol's discipline (anchored questions, confidence numbers, out-of-scope gate) is what makes this useful. If you skip the protocol and just bulk-ask, you'll produce mediocre issues.
- **Stay interactive.** Don't fall back to assumptions. If the user gives a one-word answer, ask the follow-up that disambiguates.
- **Don't file with `agent` label without explicit user "yes" in Phase 4.** That label is the pipeline trigger; firing it by accident burns runner minutes + the post-June-15 Agent SDK credit.
- **Don't fabricate context.** Run `gh label list` to see real labels. If it's still unclear which area label fits, ask the user which area the change touches.
- **No file paths in the issue body** unless the user explicitly gave one in the interview. The implementer should discover the right location from the acceptance criteria.

---

# Stop condition

Issue is filed (or explicitly discarded). Issue URL is printed. User knows what happens next.
