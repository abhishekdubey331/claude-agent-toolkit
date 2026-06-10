// Golden-fixture tests for the deterministic review renderer.
// Run: `node --test agent-toolkit/scripts/render-review.test.mjs`
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReview } from "./render-review.mjs";

// A one-file diff that adds `n` lines (right-side lines 1..n) so findings on
// lines 1..n anchor cleanly.
function diffAdding(path, n) {
  const header = `diff --git a/${path} b/${path}\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${n} @@\n`;
  const body = Array.from({ length: n }, (_, i) => `+line ${i + 1}`).join("\n");
  return header + body + "\n";
}
const finding = (id, line, severity, extra = {}) => ({ id, path: "foo.js", line, severity, body: `issue ${id}`, ...extra });
const keep = (id, confidence = 90) => ({ id, keep: true, confidence });

// Regression for the severity-cap ordering bug: a high finding sitting past the
// inline cap (in input order) must NOT be silently capped out / downgraded.
test("a high finding past the inline cap still blocks AND is posted", () => {
  const findings = [];
  const verdicts = [];
  for (let i = 1; i <= 8; i++) { findings.push(finding(`l${i}`, i, "low")); verdicts.push(keep(`l${i}`)); }
  findings.push(finding("h1", 9, "high")); verdicts.push(keep("h1")); // high is LAST in input order

  const { payload, decision } = renderReview({
    findingsDoc: { findings }, verifiedDoc: { verdicts }, diffText: diffAdding("foo.js", 12),
  });

  assert.equal(decision.event, "REQUEST_CHANGES", "a surviving high must block");
  assert.ok(decision.blocking >= 1);
  assert.equal(payload.comments.length, 8, "inline cap still respected");
  assert.equal(decision.capped, 1);
  assert.ok(payload.comments.some((c) => c.line === 9), "the high finding must be posted, not capped out");
});

test("findings are ordered high -> medium -> low in the posted set", () => {
  const findings = [finding("lo", 1, "low"), finding("hi", 2, "high"), finding("mid", 3, "medium")];
  const verdicts = [keep("lo"), keep("hi"), keep("mid")];
  const { payload } = renderReview({ findingsDoc: { findings }, verifiedDoc: { verdicts }, diffText: diffAdding("foo.js", 5) });
  assert.deepEqual(payload.comments.map((c) => c.line), [2, 3, 1]);
});

test("confidence gate drops findings below the threshold", () => {
  const { payload, decision } = renderReview({
    findingsDoc: { findings: [finding("a", 1, "medium"), finding("b", 2, "medium")] },
    verifiedDoc: { verdicts: [keep("a", 90), keep("b", 50)] }, // b is below the default 60
    diffText: diffAdding("foo.js", 5),
  });
  assert.equal(payload.comments.length, 1);
  assert.equal(decision.event, "COMMENT");
});

test("refuter drop (keep:false) excludes the finding even at high confidence", () => {
  const { payload } = renderReview({
    findingsDoc: { findings: [finding("a", 1, "high")] },
    verifiedDoc: { verdicts: [{ id: "a", keep: false, confidence: 99 }] },
    diffText: diffAdding("foo.js", 5),
  });
  assert.equal(payload.comments.length, 0);
});

test("a finding outside the diff is not posted inline (routed to the outside-diff section)", () => {
  const { payload, decision } = renderReview({
    findingsDoc: { findings: [{ id: "x", path: "other.js", line: 3, severity: "high", body: "nope" }] },
    verifiedDoc: { verdicts: [keep("x")] },
    diffText: diffAdding("foo.js", 5),
  });
  assert.equal(payload.comments.length, 0);
  assert.equal(decision.dropped, 1);
});

test("a high finding outside the diff still blocks (routed to outside-diff, not demoted)", () => {
  const { payload, decision } = renderReview({
    findingsDoc: { findings: [{ id: "x", path: "other.js", line: 3, severity: "high", body: "nope" }] },
    verifiedDoc: { verdicts: [keep("x")] },
    diffText: diffAdding("foo.js", 5),
  });
  assert.equal(payload.comments.length, 0, "out-of-diff finding is not posted inline");
  assert.equal(decision.dropped, 1);
  assert.ok(decision.blocking >= 1, "an out-of-diff high still counts toward blocking");
  assert.equal(decision.event, "REQUEST_CHANGES", "a surviving high must block even when it can't anchor");
});

test("a suggestion is dropped when the finding's line is snapped to a neighbor", () => {
  // line 7 isn't a changed line; it snaps to the nearest add. The committable
  // suggestion must NOT survive — it would rewrite the snapped neighbor.
  const diff = `diff --git a/foo.js b/foo.js\n--- a/foo.js\n+++ b/foo.js\n@@ -1,1 +1,1 @@\n+real line 1\n`;
  const { payload } = renderReview({
    findingsDoc: { findings: [{ id: "s", path: "foo.js", line: 7, severity: "medium", body: "bad", suggestion: "fixed line" }] },
    verifiedDoc: { verdicts: [keep("s")] },
    diffText: diff,
  });
  assert.equal(payload.comments.length, 1, "finding still anchors via snap");
  const body = payload.comments[0].body;
  assert.ok(body.includes("📍 Snapped"), "snap sub-note is present");
  assert.ok(!body.includes("```suggestion"), "no committable suggestion on a snapped line");
  assert.ok(!body.includes("Quick fix"), "no Quick fix pill when the suggestion is dropped");
});

test("no surviving findings -> neutral COMMENT, nothing posted", () => {
  const { payload, decision } = renderReview({ findingsDoc: { findings: [] }, verifiedDoc: { verdicts: [] }, diffText: diffAdding("foo.js", 3) });
  assert.equal(decision.event, "COMMENT");
  assert.equal(payload.comments.length, 0);
});
