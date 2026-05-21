import { buildSlackBlocks, formatWorkerReply } from "./slackFormat.js";

export type SlackChatClient = {
  chat: {
    postMessage: (args: Record<string, unknown>) => Promise<unknown>;
    postEphemeral: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

export async function postSlackText(
  client: unknown,
  channel: string,
  content: string,
  options?: {
    user?: string;
    workerName?: string;
    ephemeral?: boolean;
    threadTs?: string;
  }
): Promise<void> {
  const { chat } = client as SlackChatClient;
  const formatted = options?.workerName
    ? formatWorkerReply(options.workerName, content)
    : (() => {
        const { text, blocks } = buildSlackBlocks(content);
        return { text, blocks };
      })();

  const payload: Record<string, unknown> = {
    channel,
    text: formatted.text.slice(0, 3900),
    unfurl_links: false,
    unfurl_media: false,
  };

  if (formatted.blocks?.length) {
    payload.blocks = formatted.blocks;
  }

  if (options?.threadTs) {
    payload.thread_ts = options.threadTs;
  }

  if (options?.ephemeral && options.user) {
    await chat.postEphemeral({ ...payload, user: options.user });
  } else {
    await chat.postMessage(payload);
  }
}
