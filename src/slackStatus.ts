import fs from "node:fs";
import path from "node:path";

export type SlackStatusClient = {
  chat: {
    postMessage: (args: {
      channel: string;
      text: string;
      thread_ts?: string;
    }) => Promise<{ ts?: string }>;
  };
  assistant: {
    threads: {
      setStatus: (args: {
        channel_id: string;
        thread_ts: string;
        status: string;
        loading_messages?: string[];
      }) => Promise<unknown>;
    };
  };
};

const ANCHORS_PATH = path.join(process.cwd(), "data", "slack-thread-anchors.json");

const TYPING_STATUS = "typing...";

function readAnchors(): Record<string, string> {
  try {
    if (!fs.existsSync(ANCHORS_PATH)) return {};
    return JSON.parse(fs.readFileSync(ANCHORS_PATH, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeAnchors(anchors: Record<string, string>): void {
  const dir = path.dirname(ANCHORS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ANCHORS_PATH, JSON.stringify(anchors, null, 2), "utf8");
}

function anchorKey(
  teamId: string,
  channelId: string,
  userId: string,
  threadTs?: string
): string {
  return threadTs
    ? `${teamId}:${channelId}:${threadTs}:${userId}`
    : `${teamId}:${channelId}:${userId}`;
}

/** Thread root used for composer-level "Qiko is thinking…" status. */
export async function resolveStatusThreadTs(
  client: SlackStatusClient,
  teamId: string,
  channelId: string,
  userId: string,
  threadTsFromPayload?: string
): Promise<string> {
  if (threadTsFromPayload) return threadTsFromPayload;

  const key = anchorKey(teamId, channelId, userId, threadTsFromPayload);
  const anchors = readAnchors();
  if (anchors[key]) return anchors[key];

  try {
    const posted = await client.chat.postMessage({
      channel: channelId,
      text: `<@${userId}> · _Qiko session_`,
    });
    const ts = posted.ts;
    if (!ts) throw new Error("Could not start Qiko thread in this channel");

    anchors[key] = ts;
    writeAnchors(anchors);
    return ts;
  } catch (error) {
    const err = error as { data?: { error?: string } };
    if (err.data?.error === "not_in_channel") {
      throw new Error(
        "Qikobot is not in this channel. Run `/invite @Qikobot` here, or use `/qiko-login` in Apps → Qikobot (DM)."
      );
    }
    throw error;
  }
}

/** Composer typing indicator (below message box). Requires Agents & AI Apps on the Slack app. */
export async function showTyping(
  client: SlackStatusClient,
  channelId: string,
  threadTs: string
): Promise<boolean> {
  try {
    await client.assistant.threads.setStatus({
      channel_id: channelId,
      thread_ts: threadTs,
      status: TYPING_STATUS,
    });
    return true;
  } catch (error) {
    const detail = error as { data?: { error?: string } };
    console.warn(
      "assistant.threads.setStatus (typing) failed:",
      detail.data?.error ?? error
    );
    return false;
  }
}

export async function clearTyping(
  client: SlackStatusClient,
  channelId: string,
  threadTs: string
): Promise<void> {
  try {
    await client.assistant.threads.setStatus({
      channel_id: channelId,
      thread_ts: threadTs,
      status: "",
    });
  } catch {
    // Cleared automatically when a reply is posted
  }
}

/** Show typing under the composer during async work; always cleared in finally. */
export async function withTypingIndicator(
  client: unknown,
  channelId: string,
  threadTs: string | undefined,
  work: () => Promise<void>
): Promise<void> {
  if (!threadTs) {
    await work();
    return;
  }
  const statusClient = client as SlackStatusClient;
  await showTyping(statusClient, channelId, threadTs);
  try {
    await work();
  } finally {
    await clearTyping(statusClient, channelId, threadTs);
  }
}
