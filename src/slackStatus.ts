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

const LOADING_MESSAGES = [
  "Connecting to Qiko…",
  "Loading your workers…",
  "Thinking…",
  "Preparing a reply…",
];

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

function anchorKey(teamId: string, channelId: string, userId: string): string {
  return `${teamId}:${channelId}:${userId}`;
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

  const key = anchorKey(teamId, channelId, userId);
  const anchors = readAnchors();
  if (anchors[key]) return anchors[key];

  const posted = await client.chat.postMessage({
    channel: channelId,
    text: `<@${userId}> · _Qiko session_`,
  });
  const ts = posted.ts;
  if (!ts) throw new Error("Could not start Qiko thread in this channel");

  anchors[key] = ts;
  writeAnchors(anchors);
  return ts;
}

export async function showQikoWorking(
  client: SlackStatusClient,
  channelId: string,
  threadTs: string
): Promise<boolean> {
  try {
    await client.assistant.threads.setStatus({
      channel_id: channelId,
      thread_ts: threadTs,
      status: "is thinking…",
      loading_messages: LOADING_MESSAGES,
    });
    return true;
  } catch (error) {
    console.warn("assistant.threads.setStatus failed:", error);
    return false;
  }
}

export async function clearQikoWorking(
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
    // Status may already be cleared by chat.postMessage
  }
}
