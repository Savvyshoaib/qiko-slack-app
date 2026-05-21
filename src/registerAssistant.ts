import { Assistant, type App } from "@slack/bolt";
import { postSlackText } from "./slackPost.js";
import { sendMessageToActiveWorker } from "./workerChat.js";

const TYPING_STATUS = "typing...";

export function registerAssistant(app: App): void {
  const assistant = new Assistant({
    threadStarted: async ({ say, saveThreadContext }) => {
      await say(
        "Hi — I'm *Qikobot*. Send *login* to connect your Qiko account, then *workers* and *worker <name>*, or ask a question once a worker is active."
      );
      await saveThreadContext();
    },

    userMessage: async ({ event, client, context, setStatus, say }) => {
      if (event.subtype || !("user" in event) || !event.user) return;
      const text = "text" in event ? event.text?.trim() ?? "" : "";
      if (!text || text.startsWith("/")) return;

      const teamId = context.teamId;
      const userId = event.user;
      if (!teamId || !userId) return;

      const threadTs = "thread_ts" in event ? event.thread_ts : undefined;
      if (!threadTs || !("channel" in event)) return;

      await setStatus(TYPING_STATUS);

      try {
        const { reply, worker } = await sendMessageToActiveWorker(teamId, userId, text);
        await postSlackText(client, event.channel, reply, {
          workerName: worker.name,
          threadTs,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Something went wrong";
        await say(message);
      } finally {
        await setStatus("");
      }
    },
  });

  app.assistant(assistant);
}
