import { postSlackText } from "./slackPost.js";

const TYPING_TEXT = "Qiko typing...";

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

/**
 * Shows a temporary "Qiko typing..." message, runs async work (e.g. Qiko API),
 * then removes the indicator and posts the formatted reply.
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
    text: TYPING_TEXT,
  };
  if (threadTs) loadingPayload.thread_ts = threadTs;

  const loading = await chat.postMessage(loadingPayload);
  const loadingTs = loading.ts;

  try {
    const result = await work();
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
    const msg = error instanceof Error ? error.message : "Something went wrong";
    if (loadingTs) {
      await chat.update({ channel, ts: loadingTs, text: msg });
    } else {
      throw error;
    }
  }
}
