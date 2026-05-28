# scripts/render-review.mjs

Deterministic renderer for the automated PR-review pipeline. It consumes the
findings produced by the **code-review-bot** skill (FIND) and the verdicts from
the **code-review-refuter** skill (VERIFY), applies the gate, and emits a single
GitHub-review payload in the CodeRabbit-style UX (pill row · bold title · body ·
committable `suggestion` · summary table · outside-diff / review-info
collapsibles).

It deliberately does **no** model work and posts nothing — a CI step posts the
payload it writes, using whatever identity/token that step provides.

## Inputs (env)

| var | meaning |
|-----|---------|
| `FINDINGS` | path to `/tmp/review-findings.json` (FIND output) |
| `VERIFIED` | path to `/tmp/review-verified.json` (VERIFY output; `{verdicts:[{id,keep,confidence}]}`) |
| `DIFF_FILE` | raw unified diff (used to anchor + snap inline comments to valid `+` lines) |
| `CONFIDENCE_MIN` | integer gate; findings below this post-verification confidence are dropped (default 60) |
| `PR_HEAD_SHA` | commit id for the review |

## Gate

A finding is posted only if the refuter **kept** it AND its post-verification
confidence ≥ `CONFIDENCE_MIN`. Verdict: `REQUEST_CHANGES` if any surviving
finding is `high`, else `COMMENT` (neutral — a human still merges). Inline
comments are capped at 8; out-of-diff findings are listed in a collapsible.

## Outputs

- `/tmp/review-payload.json` — `{ commit_id, event, body, comments[] }`, ready for
  `gh api repos/{o}/{r}/pulls/{n}/reviews --input`.
- `/tmp/review-decision.json` — `{ event, posted, blocking, dropped, capped }` for
  the calling step to set labels / log eval data.

Runtime: Node (ESM) or Bun. No dependencies.
