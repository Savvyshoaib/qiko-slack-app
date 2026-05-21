import { postSlackText } from "./slackPost.js";

const TYPING_PHRASES = [
  "Processing Request",
  "Thinking Securely",
  "Fetching Data",
  "Generating Response",
  "Preparing Reply",
] as const;

/** How often the status line cycles (ms). */
const TYPING_INTERVAL_MS = 1800;

type ChatClient = {
  chat: {
    postMessage: (args: Record<string, unknown>) => Promise<{ ts?: string }>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
    delete: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

export type QikoChatResult = {
  content: string;
  workerName?: string;
};

function formatTypingLine(phrase: string): string {
  return `_⏳ ${phrase}_`;
}

function startTypingLoop(
  chat: ChatClient["chat"],
  channel: string,
  threadTs: string | undefined,
  loadingTs: string
): () => void {
  let index = 0;

  const timer = setInterval(() => {
    index = (index + 1) % TYPING_PHRASES.length;
    const text = formatTypingLine(TYPING_PHRASES[index]);
    void chat.update({ channel, ts: loadingTs, text }).catch(() => {
      /* ignore rate limits / deleted message */
    });
  }, TYPING_INTERVAL_MS);

  return () => clearInterval(timer);
}

/**
 * Rotating status message while Qiko API runs, then delete indicator and post reply.
 */
export async function withQikoTyping(
  client: unknown,
  channel: string,
  threadTs: string | undefined,
  work: () => Promise<QikoChatResult>
): Promise<void> {
  const { chat } = client as ChatClient;

  const loadingPayload: Record<string, unknown> = {
    channel,
    text: formatTypingLine(TYPING_PHRASES[0]),
  };
  if (threadTs) loadingPayload.thread_ts = threadTs;

  const loading = await chat.postMessage(loadingPayload);
  const loadingTs = loading.ts;

  let stopLoop = (): void => undefined;
  if (loadingTs) {
    stopLoop = startTypingLoop(chat, channel, threadTs, loadingTs);
  }

  try {
    const result = await work();
    stopLoop();
    if (loadingTs) {
      try {
        await chat.delete({ channel, ts: loadingTs });
      } catch {
        /* already gone */
      }
    }
    await postSlackText(client, channel, result.content, {
      workerName: result.workerName,
      threadTs,
    });
  } catch (error) {
    stopLoop();
    const msg = error instanceof Error ? error.message : "Something went wrong";
    if (loadingTs) {
      await chat.update({ channel, ts: loadingTs, text: msg });
    } else {
      throw error;
    }
  }
}
