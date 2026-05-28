#!/usr/bin/env node
// Renders gated findings into the SAME comment UX as the pr-reviewer product
// (~/Documents/dev/products/pr-reviewer/.github/pr-reviewer/review.mjs):
// CodeRabbit-style pill row + bold title + body + committable suggestion +
// summary table + outside-diff / review-info collapsibles.
//
// Differs from that harness only in its INPUT: instead of asking Claude inline,
// it consumes the multi-stage pipeline's artifacts and applies the confidence +
// skeptic gate before formatting.
//
// Env in:
//   FINDINGS         /tmp/review-findings.json   (FIND stage)
//   VERIFIED         /tmp/review-verified.json   (VERIFY stage; {verdicts:[{id,keep,confidence}]})
//   DIFF_FILE        raw unified diff (for line anchoring + snapping)
//   CONFIDENCE_MIN   integer gate (default 60)
//   PR_HEAD_SHA      commit_id for the review
// Writes:
//   /tmp/review-payload.json    { commit_id, event, body, comments[] }
//   /tmp/review-decision.json   { event, posted, blocking, dropped, capped }

import { readFileSync, writeFileSync } from "node:fs";

const MAX_INLINE_COMMENTS = 8;
const SNAP_DISTANCE = 10;
const CONFIDENCE_MIN = parseInt(process.env.CONFIDENCE_MIN || "60", 10);

const SEVERITY_LABEL = { high: "🔴 High", medium: "🟠 Medium", low: "🟡 Low" };
const CATEGORY_LABEL = {
  correctness: "🐛 Correctness",
  security: "🛡️ Security",
  performance: "⚡ Performance",
  reliability: "🔧 Reliability",
  contract: "📐 API / Contract",
  readability: "📖 Readability",
};

const findingsDoc = readJson(process.env.FINDINGS) || { findings: [] };
const verifiedDoc = readJson(process.env.VERIFIED) || { verdicts: [] };
const diffText = safeRead(process.env.DIFF_FILE);

const verdicts = new Map((verifiedDoc.verdicts || []).map((v) => [v.id, v]));
const { validLines, lineText } = buildLineMaps(parseUnifiedDiff(diffText));

// Gate: keep only findings the skeptic kept AND confidence >= threshold.
const gated = (findingsDoc.findings || []).filter((f) => {
  const v = verdicts.get(f.id) || { keep: false, confidence: 0 };
  if (!v.keep) return false;
  const c = typeof v.confidence === "number" ? v.confidence : f.confidence ?? 0;
  return c >= CONFIDENCE_MIN;
});

const droppedFindings = [];
const normalized = [];
const severities = [];
for (const f of gated) {
  const r = normalizeComment(f, validLines, lineText);
  if (r.comment) { normalized.push(r.comment); severities.push(r.severity); }
  else droppedFindings.push({ raw: f, reason: r.reason });
}
const comments = normalized.slice(0, MAX_INLINE_COMMENTS);
const postedSeverities = severities.slice(0, MAX_INLINE_COMMENTS);
const cappedCount = normalized.length - comments.length;
const includedFiles = [...validLines.keys()];

const body = renderBody(findingsDoc, { droppedFindings, cappedCount, includedFiles, postedCount: comments.length });
const event = postedSeverities.includes("high") ? "REQUEST_CHANGES" : "COMMENT";

writeFileSync("/tmp/review-payload.json", JSON.stringify({
  commit_id: process.env.PR_HEAD_SHA, event, body, comments,
}));
writeFileSync("/tmp/review-decision.json", JSON.stringify({
  event, posted: comments.length, blocking: postedSeverities.filter((s) => s === "high").length,
  dropped: droppedFindings.length, capped: cappedCount,
}));
console.log(`render: event=${event} posted=${comments.length} dropped=${droppedFindings.length} capped=${cappedCount}`);

// --------------------------------------------------------------------------
function readJson(p) { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } }
function safeRead(p) { try { return readFileSync(p, "utf8"); } catch { return ""; } }

function parseUnifiedDiff(text) {
  const files = []; let cur = null, cursor = 0, inHunk = false;
  for (const raw of (text || "").split("\n")) {
    if (raw.startsWith("diff --git")) { if (cur) files.push(cur); cur = null; inHunk = false; continue; }
    if (raw.startsWith("+++ ")) {
      const p = raw.slice(4).trim();
      cur = { path: p === "/dev/null" ? null : p.replace(/^b\//, ""), lines: [] };
      inHunk = false; continue;
    }
    const m = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (m) { cursor = parseInt(m[1], 10); inHunk = true; continue; }
    if (!cur || !inHunk || raw.startsWith("\\")) continue;
    if (raw.startsWith("+") && !raw.startsWith("+++")) { cur.lines.push({ kind: "add", rightLine: cursor, text: raw.slice(1) }); cursor++; }
    else if (raw.startsWith("-") && !raw.startsWith("---")) { cur.lines.push({ kind: "del", rightLine: null, text: raw.slice(1) }); }
    else { cur.lines.push({ kind: "ctx", rightLine: cursor, text: raw.slice(1) }); cursor++; }
  }
  if (cur) files.push(cur);
  return files.filter((f) => f.path);
}

function buildLineMaps(parsedFiles) {
  const validLines = new Map(), lineText = new Map();
  for (const file of parsedFiles) {
    const lines = new Set(), texts = new Map();
    for (const l of file.lines) if (l.kind === "add") { lines.add(l.rightLine); texts.set(l.rightLine, l.text); }
    if (lines.size) { validLines.set(file.path, lines); lineText.set(file.path, texts); }
  }
  return { validLines, lineText };
}

function snapNearest(target, validLines) {
  if (!validLines || validLines.size === 0) return null;
  for (let d = 1; d <= SNAP_DISTANCE; d++) {
    if (validLines.has(target - d)) return target - d;
    if (validLines.has(target + d)) return target + d;
  }
  return null;
}

function headerPills({ severity, category, hasSuggestion }) {
  const pills = ["⚠️ Potential issue", SEVERITY_LABEL[severity] || SEVERITY_LABEL.medium];
  if (category && CATEGORY_LABEL[category]) pills.push(CATEGORY_LABEL[category]);
  if (hasSuggestion) pills.push("💡 Quick fix");
  return pills.map((p) => `_${p}_`).join(" | ");
}

function deriveTitle(raw) {
  if (typeof raw.title === "string" && raw.title.trim()) return raw.title.trim().replace(/[.!]+$/, "");
  const b = String(raw.body || "").trim();
  if (!b) return "Issue";
  return b.split(/(?<=[.!?])\s+/)[0].replace(/[.!?]+$/, "").slice(0, 120);
}

function normalizeComment(raw, validLinesByPath, lineTextByPath) {
  if (!raw || typeof raw !== "object") return { reason: "malformed" };
  if (typeof raw.path !== "string" || typeof raw.line !== "number") return { reason: "missing_path_or_line" };
  const validLines = validLinesByPath.get(raw.path);
  if (!validLines) return { reason: `file_not_in_diff:${raw.path}` };

  let line = raw.line, snapped = false;
  if (!validLines.has(line)) {
    const s = snapNearest(line, validLines);
    if (s == null) return { reason: `line_${line}_not_anchorable` };
    line = s; snapped = true;
  }
  let startLine = null;
  if (typeof raw.start_line === "number" && raw.start_line < line && validLines.has(raw.start_line)) startLine = raw.start_line;

  const sevRaw = String(raw.severity || "medium").toLowerCase();
  const severity = ["high", "medium", "low"].includes(sevRaw) ? sevRaw : "medium";
  const catRaw = String(raw.category || "").toLowerCase();
  const category = CATEGORY_LABEL[catRaw] ? catRaw : null;

  let suggestion = typeof raw.suggestion === "string" ? raw.suggestion.replace(/\s+$/, "") : null;
  if (suggestion === "" ) suggestion = null;
  else if (suggestion && suggestion.includes("```")) suggestion = null;
  else if (suggestion) { const orig = lineTextByPath.get(raw.path)?.get(line); if (orig != null && suggestion === orig) suggestion = null; }

  const title = deriveTitle(raw);
  const description = String(raw.body || "").trim();
  const parts = [headerPills({ severity, category, hasSuggestion: !!suggestion }), "", `**${title}**`];
  if (description) parts.push("", description);
  if (suggestion) parts.push("", "<details>", "<summary>💡 Committable suggestion</summary>", "",
    "> ⚠️ Review the suggestion before committing. Make sure it accurately replaces the highlighted code with correct indentation.",
    "", "```suggestion", suggestion, "```", "", "</details>");
  if (snapped) parts.push("", `<sub>📍 Snapped to nearest changed line (original target: line ${raw.line}).</sub>`);

  const comment = { path: raw.path, line, side: "RIGHT", body: parts.join("\n") };
  if (startLine != null) { comment.start_line = startLine; comment.start_side = "RIGHT"; }
  return { comment, severity };
}

function oneLine(v) { return v == null ? "—" : (String(v).replace(/\s+/g, " ").replace(/\|/g, "\\|").trim() || "—"); }

function renderBody(review, { droppedFindings, cappedCount, includedFiles, postedCount }) {
  const score = typeof review.score === "number" ? `${Math.round(review.score)} / 100` : "—";
  const effort = typeof review.estimated_effort_to_review === "number" ? `${review.estimated_effort_to_review} / 5` : "—";
  const lines = [
    `**Actionable comments posted: ${postedCount}**`, "",
    `- **Summary** — ${oneLine(review.summary || "(no summary)")}`,
    `- **Score** — ${score}`,
    `- **Effort to review** — ${effort}`,
    `- **Tests cover changes** — ${oneLine(review.relevant_tests ?? "—")}`,
    `- **Security concerns** — ${oneLine(review.security_concerns ?? "—")}`,
  ];
  if (Array.isArray(review.questions) && review.questions.length) {
    lines.push("", "### Questions for the author");
    for (const q of review.questions) lines.push(`- ${String(q).trim()}`);
  }
  if (droppedFindings.length) lines.push("", renderOutsideDiff(droppedFindings));
  lines.push("", renderReviewInfo({ includedFiles, postedCount, cappedCount, droppedFindings }));
  lines.push("", "<sub>🤖 Reviewed by claude-reviewer — findings survived a fresh-process skeptic + confidence gate.</sub>");
  return lines.join("\n");
}

function renderOutsideDiff(droppedFindings) {
  const byPath = new Map();
  for (const d of droppedFindings) { const p = d.raw?.path || "(unknown)"; if (!byPath.has(p)) byPath.set(p, []); byPath.get(p).push(d); }
  const lines = ["> [!CAUTION]", "> Some findings reference lines outside the PR diff and could not be posted inline.", "",
    "<details>", `<summary>⚠️ Outside diff range comments (${droppedFindings.length})</summary>`, ""];
  for (const [path, group] of byPath.entries()) {
    lines.push("<details>", `<summary><code>${path}</code> (${group.length})</summary>`, "");
    for (const d of group) {
      const c = d.raw || {};
      const sev = c.severity ? SEVERITY_LABEL[c.severity] || "🟠 Medium" : "❓ Unknown";
      const cat = c.category && CATEGORY_LABEL[c.category] ? ` | _${CATEGORY_LABEL[c.category]}_` : "";
      const where = c.line != null ? `Line ${c.line}` : "Unknown line";
      const title = c.title?.trim() || (c.body || "").trim().split(/[.\n]/)[0] || "(no title)";
      lines.push(`_⚠️ Potential issue_ | _${sev}_${cat}`, "", `**${title}** _(${where})_`);
      const desc = (c.body || "").trim();
      if (desc && desc !== title) lines.push("", desc);
      lines.push("", `<sub>Reason couldn't anchor: \`${d.reason}\`</sub>`, "");
    }
    lines.push("</details>", "");
  }
  lines.push("</details>");
  return lines.join("\n");
}

function renderReviewInfo({ includedFiles, postedCount, cappedCount, droppedFindings }) {
  const lines = ["<details>", "<summary>ℹ️ Review info</summary>", ""];
  if (includedFiles.length) { lines.push(`**Files reviewed (${includedFiles.length}):**`, ""); for (const p of includedFiles) lines.push(`- \`${p}\``); lines.push(""); }
  lines.push("**Run stats:**", "", `- Inline comments posted: **${postedCount} / ${MAX_INLINE_COMMENTS}**`);
  if (cappedCount > 0) lines.push(`- Trimmed to fit cap: ${cappedCount}`);
  if (droppedFindings.length > 0) lines.push(`- Outside-diff findings: ${droppedFindings.length} (see section above)`);
  lines.push("", "</details>");
  return lines.join("\n");
}
