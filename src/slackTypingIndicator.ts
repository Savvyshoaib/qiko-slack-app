import { config } from "./config.js";
import { postSlackText } from "./slackPost.js";

const TYPING_PHRASES = [
  "Processing Request",
  "Thinking Securely",
  "Fetching Data",
  "Generating Response",
  "Preparing Reply",
] as const;

const TYPING_INTERVAL_MS = 1800;

type ChatClient = {
  chat: {
    postMessage: (args: Record<string, unknown>) => Promise<{ ts?: string }>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
    delete: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

export type TypingWorkResult = {
  content: string;
  workerName?: string;
  /** Final reply only visible to the user who ran the command */
  ephemeral?: boolean;
  userId?: string;
};

function qikoAppImageUrl(): string {
  return `${config.appUrl}/qiko-app.png`;
}

function typingMessagePayload(
  channel: string,
  phrase: string,
  threadTs?: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    channel,
    text: phrase,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `_${phrase}_` },
        accessory: {
          type: "image",
          image_url: qikoAppImageUrl(),
          alt_text: "Qiko",
        },
      },
    ],
  };
  if (threadTs) payload.thread_ts = threadTs;
  return payload;
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
    const phrase = TYPING_PHRASES[index];
    void chat
      .update(typingMessagePayload(channel, phrase, threadTs))
      .catch(() => {
        /* ignore rate limits / deleted message */
      });
  }, TYPING_INTERVAL_MS);

  return () => clearInterval(timer);
}

/**
 * Rotating status + Qiko icon while async work runs; then final reply.
 */
export async function withQikoTyping(
  client: unknown,
  channel: string,
  threadTs: string | undefined,
  work: () => Promise<TypingWorkResult>
): Promise<void> {
  const { chat } = client as ChatClient;

  const loading = await chat.postMessage(
    typingMessagePayload(channel, TYPING_PHRASES[0], threadTs)
  );
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

    if (result.ephemeral && result.userId) {
      await postSlackText(client, channel, result.content, {
        user: result.userId,
        ephemeral: true,
        threadTs,
        workerName: result.workerName,
      });
    } else {
      await postSlackText(client, channel, result.content, {
        workerName: result.workerName,
        threadTs,
      });
    }
  } catch (error) {
    stopLoop();
    const msg = error instanceof Error ? error.message : "Something went wrong";
    if (loadingTs) {
      await chat.update({ channel, ts: loadingTs, text: msg, blocks: undefined });
    } else {
      throw error;
    }
  }
}
