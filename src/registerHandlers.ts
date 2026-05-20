import type { App } from "@slack/bolt";
import { loginToQiko, fetchQikoAgents } from "./qikoClient.js";
import { postSlackText } from "./slackPost.js";
import { clearSession, getSession, setSession } from "./userSessions.js";
import { buildLoginModal, QIKO_LOGIN_MODAL_CALLBACK } from "./views.js";
import {
  formatWorkersList,
  requireSession,
  selectWorker,
  sendMessageToActiveWorker,
} from "./workerChat.js";

type SlashRespond = (message: {
  response_type?: "ephemeral" | "in_channel";
  text: string;
}) => Promise<unknown>;

async function replyEphemeral(
  client: unknown,
  channelId: string,
  userId: string,
  text: string
): Promise<void> {
  await postSlackText(client, channelId, text, { user: userId, ephemeral: true });
}

async function dmUser(
  client: {
    conversations: {
      open: (args: { users: string }) => Promise<{ channel?: { id?: string } }>;
    };
  },
  userId: string,
  text: string
): Promise<void> {
  const opened = await client.conversations.open({ users: userId });
  const channelId = opened.channel?.id;
  if (!channelId) throw new Error("Could not open DM with user");
  await postSlackText(client, channelId, text);
}

export function registerHandlers(app: App): void {
  app.error(async (error) => {
    console.error("Slack app error:", error);
  });

  app.command("/qiko-login", async ({ ack, body, client, respond }) => {
    await ack();
    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: buildLoginModal(),
      });
      await respond({
        response_type: "ephemeral",
        text: "Complete sign-in in the window that opened. (In channels, `/invite @Qikobot` first if needed.)",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open login window";
      console.error("/qiko-login error:", error);
      await respond({ response_type: "ephemeral", text: message });
    }
  });

  app.command("/qiko-status", async ({ ack, body, client, respond }) => {
    await ack();
    try {
      const session = getSession(body.team_id, body.user_id);
      if (!session) {
        await replyEphemeral(
          client,
          body.channel_id,
          body.user_id,
          "Not connected to Qiko. Run `/qiko-login` to sign in."
        );
        return;
      }
      const name =
        session.user?.user_name ||
        session.user?.name ||
        session.user?.email ||
        session.email;
      await replyEphemeral(
        client,
        body.channel_id,
        body.user_id,
        `Connected to Qiko as *${name}* (linked ${new Date(session.linkedAt).toLocaleString()}).`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      await replyEphemeral(client, body.channel_id, body.user_id, message);
    }
  });

  app.command("/qiko-workers", async ({ ack, body, client, respond }) => {
    await ack();
    try {
      const session = requireSession(body.team_id, body.user_id);
      const agents = await fetchQikoAgents(session.token);
      const active = session.activeWorker?.name;
      const header = active
        ? `*Your Qiko workers* (active: *${active}*)\n\n`
        : "*Your Qiko workers*\n\n";
      const text =
        header +
        formatWorkersList(agents) +
        "\n\n`/qiko-worker <name>` then `/qiko-chat <message>` or type in Qikobot Messages.";
      await postSlackText(client, body.channel_id, text);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      await replyEphemeral(client, body.channel_id, body.user_id, message);
    }
  });

  app.command("/qiko-worker", async ({ ack, body, client, respond }) => {
    await ack();
    const query = body.text?.trim() ?? "";
    if (!query) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/qiko-worker <worker name>`\nExample: `/qiko-worker Daniel Carter`",
      });
      return;
    }

    try {
      const { worker } = await selectWorker(body.team_id, body.user_id, query);
      await postSlackText(
        client,
        body.channel_id,
        `Active worker: *${worker.name}*\n\nChat: \`/qiko-chat your question\` or message Qikobot directly.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      await replyEphemeral(client, body.channel_id, body.user_id, message);
    }
  });

  app.command("/qiko-chat", async ({ ack, body, client, respond }) => {
    await ack();
    const message = body.text?.trim() ?? "";
    if (!message) {
      await respond({
        response_type: "ephemeral",
        text: "Usage: `/qiko-chat <message>`\nExample: `/qiko-chat Summarize my pipeline`",
      });
      return;
    }

    try {
      const { reply, worker } = await sendMessageToActiveWorker(
        body.team_id,
        body.user_id,
        message
      );
      await postSlackText(client, body.channel_id, reply, { workerName: worker.name });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      await replyEphemeral(client, body.channel_id, body.user_id, msg);
    }
  });

  app.command("/qiko-logout", async ({ ack, body, respond }) => {
    await ack();
    const removed = clearSession(body.team_id, body.user_id);
    await respond({
      response_type: "ephemeral",
      text: removed
        ? "Disconnected from Qiko on this Slack workspace."
        : "You were not connected to Qiko.",
    });
  });

  app.view(QIKO_LOGIN_MODAL_CALLBACK, async ({ ack, body, view, client }) => {
    const email = view.state.values.email_block?.email_input?.value?.trim() ?? "";
    const password = view.state.values.password_block?.password_input?.value ?? "";
    const teamId = body.team?.id ?? "";

    if (!email || !password) {
      await ack({
        response_action: "errors",
        errors: {
          ...(!email ? { email_block: "Email is required" } : {}),
          ...(!password ? { password_block: "Password is required" } : {}),
        },
      });
      return;
    }

    try {
      const result = await loginToQiko({ email, password });
      const token = result.data!.token!;
      const user = result.data?.user ?? null;

      setSession(teamId, body.user.id, {
        token,
        user,
        email: user?.email ?? email,
      });

      await ack();

      const displayName = user?.user_name || user?.name || user?.email || email;
      await dmUser(
        client,
        body.user.id,
        `Qikobot connected as *${displayName}*.\n• Message this app directly, or use \`/qiko-workers\`, \`/qiko-worker <name>\`, \`/qiko-chat <message>\``
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      console.error("Qiko modal login error:", message);
      await ack({
        response_action: "errors",
        errors: {
          email_block: message.length > 140 ? `${message.slice(0, 137)}…` : message,
        },
      });
    }
  });

  app.event("message", async ({ event, client, context }) => {
    if (event.subtype || !("user" in event) || !event.user) return;
    if ("channel_type" in event && event.channel_type !== "im") return;
    const text = "text" in event ? event.text?.trim() : "";
    if (!text || text.startsWith("/")) return;

    const teamId = context.teamId ?? ("team" in event ? event.team : undefined);
    if (!teamId) return;

    try {
      const { reply, worker } = await sendMessageToActiveWorker(
        teamId,
        event.user,
        text
      );
      await postSlackText(client, event.channel, reply, { workerName: worker.name });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      await postSlackText(client, event.channel, message, {
        user: event.user,
        ephemeral: true,
      });
    }
  });

  app.event("app_home_opened", async ({ event, client, context }) => {
    const teamId = context.teamId ?? "";
    const session = getSession(teamId, event.user);
    const blocks = session
      ? [
          {
            type: "section" as const,
            text: {
              type: "mrkdwn" as const,
              text: `Signed in as *${session.user?.email ?? session.email}*${
                session.activeWorker
                  ? `\nActive worker: *${session.activeWorker.name}*`
                  : ""
              }\n\n\`/qiko-workers\` · \`/qiko-worker <name>\` · \`/qiko-chat <message>\``,
            },
          },
        ]
      : [
          {
            type: "section" as const,
            text: {
              type: "mrkdwn" as const,
              text: "Connect your Qiko account.\n\nRun `/qiko-login` in any channel or in the Qikobot app.",
            },
          },
        ];

    await client.views.publish({
      user_id: event.user,
      view: {
        type: "home",
        blocks,
      },
    });
  });
}
