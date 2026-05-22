/** Slack mrkdwn + Block Kit (markdown block, table block) for Qiko API replies. */

export function markdownToSlackMrkdwn(text: string): string {
  let out = text;
  out = out.replace(/\*\*([^*]+)\*\*/g, "*$1*");
  out = out.replace(/__([^_]+)__/g, "*$1*");
  out = out.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
  return out;
}

type TableRow = string[];

type ContentSegment =
  | { kind: "text"; text: string }
  | { kind: "table"; header: TableRow; rows: TableRow[] };

type SlackBlock = Record<string, unknown>;

const MAX_TABLE_ROWS = 100;
const MAX_TABLE_COLS = 20;
const MAX_MARKDOWN_BLOCK = 11_500;
const MAX_CELL_TEXT = 2000;

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtmlToText(html: string): string {
  let out = html;
  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<\/p>/gi, "\n\n");
  out = out.replace(/<\/div>/gi, "\n");
  out = out.replace(/<\/li>/gi, "\n");
  out = out.replace(/<li[^>]*>/gi, "- ");
  out = out.replace(/<h[1-6][^>]*>/gi, "\n\n*");
  out = out.replace(/<\/h[1-6]>/gi, "*\n\n");
  out = out.replace(/<strong[^>]*>/gi, "*");
  out = out.replace(/<\/strong>/gi, "*");
  out = out.replace(/<b[^>]*>/gi, "*");
  out = out.replace(/<\/b>/gi, "*");
  out = out.replace(/<em[^>]*>/gi, "_");
  out = out.replace(/<\/em>/gi, "_");
  out = out.replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(out).replace(/\n{3,}/g, "\n\n").trim();
}

function parseHtmlTable(tableHtml: string): { header: TableRow; rows: TableRow[] } | null {
  const rows: TableRow[] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  let header: TableRow | null = null;

  while ((trMatch = trRe.exec(tableHtml)) !== null) {
    const rowHtml = trMatch[1];
    const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
      cells.push(stripHtmlToText(cellMatch[1]).replace(/\s+/g, " ").trim());
    }
    if (cells.length < 2) continue;
    if (!header && /<th/i.test(rowHtml)) {
      header = cells;
      continue;
    }
    if (!header) header = cells;
    else rows.push(cells);
  }

  if (!header || rows.length === 0) return null;
  return { header, rows: normalizeTableRows(header, rows) };
}

function parseTableRow(line: string): TableRow | null {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return null;
  const parts = trimmed.split("|").map((c) => c.trim());
  const cells =
    parts[0] === "" && parts[parts.length - 1] === ""
      ? parts.slice(1, -1)
      : parts.filter((c) => c.length > 0);
  return cells.length >= 2 ? cells : null;
}

function isSeparatorRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  const cells = t.split("|").map((c) => c.trim()).filter(Boolean);
  if (cells.length === 0) return /^[\|\s\-:]+$/.test(t);
  return cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function parseMarkdownTableLines(lines: string[]): { header: TableRow; rows: TableRow[] } | null {
  if (lines.length < 2) return null;
  const header = parseTableRow(lines[0]);
  if (!header) return null;
  let dataStart = 1;
  if (lines[1] && isSeparatorRow(lines[1])) dataStart = 2;
  const rows: TableRow[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const row = parseTableRow(lines[i]);
    if (row) rows.push(row);
    else if (lines[i].trim()) break;
  }
  return rows.length > 0 ? { header, rows: normalizeTableRows(header, rows) } : null;
}

function normalizeTableRows(header: TableRow, rows: TableRow[]): TableRow[] {
  const cols = Math.min(header.length, MAX_TABLE_COLS);
  const h = header.slice(0, cols).map((c) => truncateCell(c));
  const out: TableRow[] = [];
  for (const row of rows.slice(0, MAX_TABLE_ROWS)) {
    const cells = [...row];
    while (cells.length < cols) cells.push("");
    out.push(cells.slice(0, cols).map((c) => truncateCell(c)));
  }
  return out;
}

function truncateCell(text: string): string {
  const t = text.replace(/\|/g, "¦").trim();
  return t.length > MAX_CELL_TEXT ? `${t.slice(0, MAX_CELL_TEXT - 1)}…` : t;
}

function escapePipe(cell: string): string {
  return cell.replace(/\|/g, "¦");
}

function tableToMarkdown(header: TableRow, rows: TableRow[]): string {
  const h = header.map(escapePipe);
  const lines = [
    `| ${h.join(" | ")} |`,
    `| ${h.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(escapePipe).join(" | ")} |`),
  ];
  return lines.join("\n");
}

function splitMarkdownTables(text: string): ContentSegment[] {
  const lines = text.split("\n");
  const segments: ContentSegment[] = [];
  let textBuffer: string[] = [];
  let i = 0;

  const flushText = (): void => {
    const chunk = textBuffer.join("\n").trim();
    if (chunk) segments.push({ kind: "text", text: chunk });
    textBuffer = [];
  };

  while (i < lines.length) {
    const row = parseTableRow(lines[i]);
    if (lines[i].includes("|") && row) {
      const tableLines: string[] = [lines[i]];
      i++;
      while (i < lines.length) {
        if (isSeparatorRow(lines[i])) {
          tableLines.push(lines[i]);
          i++;
          continue;
        }
        const next = parseTableRow(lines[i]);
        if (lines[i].includes("|") && next) {
          tableLines.push(lines[i]);
          i++;
          continue;
        }
        break;
      }
      const parsed = parseMarkdownTableLines(tableLines);
      if (parsed) {
        flushText();
        segments.push({ kind: "table", header: parsed.header, rows: parsed.rows });
        continue;
      }
      textBuffer.push(...tableLines);
      continue;
    }
    textBuffer.push(lines[i]);
    i++;
  }
  flushText();
  return segments;
}

function splitHtmlTables(raw: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const tableRe = /<table[^>]*>[\s\S]*?<\/table>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tableRe.exec(raw)) !== null) {
    const before = raw.slice(lastIndex, match.index);
    if (before.trim()) {
      const text = stripHtmlToText(before);
      segments.push(...splitMarkdownTables(markdownToSlackMrkdwn(text)));
    }
    const parsed = parseHtmlTable(match[0]);
    if (parsed) segments.push({ kind: "table", header: parsed.header, rows: parsed.rows });
    else segments.push({ kind: "text", text: stripHtmlToText(match[0]) });
    lastIndex = match.index + match[0].length;
  }

  const tail = raw.slice(lastIndex);
  if (tail.trim()) {
    const text = stripHtmlToText(tail);
    segments.push(...splitMarkdownTables(markdownToSlackMrkdwn(text)));
  }

  return segments.length > 0 ? segments : splitMarkdownTables(markdownToSlackMrkdwn(stripHtmlToText(raw)));
}

function segmentContent(raw: string): ContentSegment[] {
  const trimmed = raw.trim();
  if (/<table[\s>]/i.test(trimmed)) return splitHtmlTables(trimmed);
  if (/<[a-z][\s>]/i.test(trimmed)) {
    return splitMarkdownTables(markdownToSlackMrkdwn(stripHtmlToText(trimmed)));
  }
  return splitMarkdownTables(markdownToSlackMrkdwn(trimmed));
}

function sectionMrkdwn(text: string): SlackBlock {
  return {
    type: "section",
    text: { type: "mrkdwn", text: text.slice(0, 3000) },
  };
}

function markdownBlock(text: string): SlackBlock {
  return { type: "markdown", text: text.slice(0, MAX_MARKDOWN_BLOCK) };
}

function isNumericColumn(header: TableRow, rows: TableRow[], colIndex: number): boolean {
  const h = header[colIndex]?.toLowerCase() ?? "";
  if (/income|expense|profit|margin|amount|total|cost|price|£|\$|€|percent|%/i.test(h)) {
    return true;
  }
  const sample = rows.slice(0, 5).map((r) => r[colIndex] ?? "");
  return sample.filter((c) => /^[\s£$€\-+]?[\d,.]+%?$/.test(c.trim())).length >= 2;
}

function slackTableBlock(header: TableRow, rows: TableRow[]): SlackBlock {
  const column_settings = header.map((_h, i) => ({
    align: isNumericColumn(header, rows, i) ? "right" : "left",
    is_wrapped: i === 0,
  }));

  const tableRows = [
    header.map((c) => ({ type: "raw_text", text: truncateCell(c) })),
    ...rows.map((r) =>
      r.map((c) => ({ type: "raw_text", text: truncateCell(c) }))
    ),
  ];

  return {
    type: "table",
    column_settings,
    rows: tableRows,
  };
}

function segmentsToBlocks(segments: ContentSegment[]): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  for (const seg of segments) {
    if (seg.kind === "table") {
      const { header, rows } = seg;
      if (header.length === 0 || rows.length === 0) continue;

      const md = tableToMarkdown(header, rows);
      if (md.length <= MAX_MARKDOWN_BLOCK) {
        blocks.push(markdownBlock(md));
      } else {
        blocks.push(slackTableBlock(header, rows));
      }
      continue;
    }

    const text = seg.text.trim();
    if (!text) continue;

    if (text.includes("|") && parseMarkdownTableLines(text.split("\n"))) {
      blocks.push(markdownBlock(text));
      continue;
    }

    const chunks = splitLongText(text, 2900);
    for (const chunk of chunks) {
      if (looksLikeMarkdown(chunk)) {
        blocks.push(markdownBlock(chunk));
      } else {
        blocks.push(sectionMrkdwn(chunk));
      }
    }
  }

  return blocks;
}

function looksLikeMarkdown(text: string): boolean {
  return (
    /^\s*[-*]\s/m.test(text) ||
    /^\s*\d+\.\s/m.test(text) ||
    /^\|.+\|$/m.test(text) ||
    /^#{1,6}\s/m.test(text) ||
    /```/.test(text)
  );
}

function splitLongText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n\n", maxLen);
    if (cut < maxLen / 2) cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen / 2) cut = maxLen;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Split API reply into Slack blocks (native tables + formatted text). */
export function buildSlackBlocks(raw: string): { text: string; blocks: SlackBlock[] } {
  const segments = segmentContent(raw);
  let blocks = segmentsToBlocks(segments);

  if (blocks.length === 0) {
    const normalized = markdownToSlackMrkdwn(raw.trim());
    blocks = [sectionMrkdwn(normalized)];
    return { text: normalized.slice(0, 3900), blocks };
  }

  if (blocks.length > 48) {
    blocks = blocks.slice(0, 47);
    blocks.push(sectionMrkdwn("_…response truncated for Slack limits._"));
  }

  const preview = markdownToSlackMrkdwn(raw.trim()).slice(0, 200).replace(/\n/g, " ");
  return { text: preview, blocks };
}

function stripDuplicateWorkerPrefix(workerName: string, raw: string): string {
  const escaped = workerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return raw
    .replace(new RegExp(`^\\*?${escaped}\\*?:\\s*`, "i"), "")
    .replace(new RegExp(`^${escaped}:\\s*`, "i"), "")
    .trim();
}

export function formatWorkerReply(workerName: string, reply: string): {
  text: string;
  blocks: SlackBlock[];
} {
  const body = stripDuplicateWorkerPrefix(workerName, reply);
  const { text, blocks } = buildSlackBlocks(body);
  const header = sectionMrkdwn(`*${workerName}*`);
  return {
    text: `*${workerName}*: ${text}`,
    blocks: [header, ...blocks],
  };
}
