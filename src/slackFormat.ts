/** Slack mrkdwn uses *bold* (single asterisk), not GitHub **bold**. */

export function markdownToSlackMrkdwn(text: string): string {
  let out = text;
  // **bold** → *bold*
  out = out.replace(/\*\*([^*]+)\*\*/g, "*$1*");
  // __bold__ → *bold*
  out = out.replace(/__([^_]+)__/g, "*$1*");
  // Headings ### → bold line
  out = out.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
  return out;
}

type TableRow = string[];

function parseTableRow(line: string): TableRow | null {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return null;
  const cells = trimmed
    .split("|")
    .map((c) => c.trim())
    .filter((c, i, arr) => !(i === 0 && c === "") && !(i === arr.length - 1 && c === ""));
  return cells.length >= 2 ? cells : null;
}

function isSeparatorRow(line: string): boolean {
  return /^\|?[\s\-:|]+\|?$/.test(line.trim());
}

function parseMarkdownTable(lines: string[]): { header: TableRow; rows: TableRow[] } | null {
  if (lines.length < 2) return null;
  const header = parseTableRow(lines[0]);
  if (!header) return null;
  const dataStart = isSeparatorRow(lines[1]) ? 2 : 1;
  const rows: TableRow[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const row = parseTableRow(lines[i]);
    if (row) rows.push(row);
  }
  return rows.length > 0 ? { header, rows } : null;
}

type SlackBlock = Record<string, unknown>;

function sectionMrkdwn(text: string): SlackBlock {
  return {
    type: "section",
    text: { type: "mrkdwn", text: text.slice(0, 3000) },
  };
}

/** Split API reply into Slack blocks (tables + sections) with mrkdwn. */
export function buildSlackBlocks(raw: string): { text: string; blocks: SlackBlock[] } {
  const normalized = markdownToSlackMrkdwn(raw.trim());
  const lines = normalized.split("\n");
  const blocks: SlackBlock[] = [];
  let textBuffer: string[] = [];

  const flushText = (): void => {
    const chunk = textBuffer.join("\n").trim();
    if (chunk) blocks.push(sectionMrkdwn(chunk));
    textBuffer = [];
  };

  let i = 0;
  while (i < lines.length) {
    if (lines[i].includes("|") && parseTableRow(lines[i])) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const parsed = parseMarkdownTable(tableLines);
      if (parsed && parsed.header.length <= 20 && parsed.rows.length <= 50) {
        flushText();
        blocks.push(sectionMrkdwn(tableAsCodeBlock(parsed.header, parsed.rows)));
        continue;
      }
      textBuffer.push(...tableLines);
      continue;
    }
    textBuffer.push(lines[i]);
    i++;
  }
  flushText();

  if (blocks.length === 0) {
    return { text: normalized.slice(0, 3900), blocks: [sectionMrkdwn(normalized)] };
  }

  const preview = normalized.slice(0, 200).replace(/\n/g, " ");
  return { text: preview, blocks };
}

function tableAsCodeBlock(header: TableRow, rows: TableRow[]): string {
  const lines = [
    header.join(" | "),
    header.map(() => "---").join(" | "),
    ...rows.map((r) => r.join(" | ")),
  ];
  return "```\n" + lines.join("\n") + "\n```";
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
