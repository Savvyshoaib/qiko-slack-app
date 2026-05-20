import type { App } from "@slack/bolt";
import { loginToQiko, fetchQikoAgents } from "./qikoClient.js";
import {
  clearQikoWorking,
  resolveStatusThreadTs,
  showQikoWorking,
  type SlackStatusClient,
} from "./slackStatus.js";
import { clearSession, getSession, setSession } from "./userSessions.js";
import { buildLoginModal, QIKO_LOGIN_MODAL_CALLBACK } from "./views.js";
import {
  formatWorkersList,
  requireSession,
  selectWorker,
  sendMessageToActiveWorker,
} from "./workerChat.js";

const SLACK_TEXT_MAX = 3900;

function truncateSlackText(text: string): string {
  if (text.length <= SLACK_TEXT_MAX) return text;
  return `${text.slice(0, SLACK_TEXT_MAX - 20)}\n\n_(truncated)_`;
}

type SlashRespond = (message: {
  response_type?: "ephemeral" | "in_channel";
  text: string;
  replace_original?: boolean;
}) => Promise<unknown>;

type SlashBody = {
  team_id: string;
  channel_id: string;
  user_id: string;
  thread_ts?: string;
};

async function replyCommand(
  respond: SlashRespond,
  text: string,
  visibleToChannel = false
): Promise<void> {
  await respond({
    response_type: visibleToChannel ? "in_channel" : "ephemeral",
    text,
  });
}

async function replyCommandWithLoading(
  client: SlackStatusClient,
  body: SlashBody,
  respond: SlashRespond,
  visibleToChannel: boolean,
  work: () => Promise<string>
): Promise<void> {
  // Slack requires a response within ~3s or shows operation_timeout.
  await respond({
    response_type: "ephemeral",
    text: "_Qiko is working…_",
  });

  const replyInThread = body.thread_ts;
  const statusThreadTs = await resolveStatusThreadTs(
    client,
    body.team_id,
    body.channel_id,
    body.user_id,
    replyInThread
  );
  const postThreadTs = replyInThread ?? statusThreadTs;
  const statusShown = await showQikoWorking(client, body.channel_id, statusThreadTs);

  try {
    const text = await work();
    await clearQikoWorking(client, body.channel_id, statusThreadTs);

    if (visibleToChannel) {
      await client.chat.postMessage({
        channel: body.channel_id,
        thread_ts: postThreadTs,
        text,
      });
    } else {
      await replyCommand(respond, text, false);
    }
  } catch (error) {
    await clearQikoWorking(client, body.channel_id, statusThreadTs);
    const message = error instanceof Error ? error.message : "Something went wrong";
    if (visibleToChannel) {
      await client.chat.postMessage({
        channel: body.channel_id,
        thread_ts: postThreadTs,
        text: message,
      });
    } else {
      await replyCommand(respond, message, false);
    }
  }
}

async function dmUser(
  client: {
    conversations: {
      open: (args: { users: string }) => Promise<{ channel?: { id?: string } }>;
    };
    chat: { postMessage: (args: { channel: string; text: string }) => Promise<unknown> };
  },
  userId: string,
  text: string
): Promise<void> {
  const opened = await client.conversations.open({ users: userId });
  const channelId = opened.channel?.id;
  if (!channelId) throw new Error("Could not open DM with user");
  await client.chat.postMessage({ channel: channelId, text });
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
      await replyCommand(
        respond,
        "Complete sign-in in the window that opened. (In channels, invite the bot with `/invite @Qiko` if nothing appears.)"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open login window";
      console.error("/qiko-login error:", error);
      await replyCommand(respond, message);
    }
  });

  app.command("/qiko-status", async ({ ack, body, client, respond }) => {
    await ack();
    await replyCommandWithLoading(client, body, respond, false, async () => {
      const session = getSession(body.team_id, body.user_id);
      if (!session) {
        return "Not connected to Qiko. Run `/qiko-login` to sign in.";
      }
      const name =
        session.user?.user_name ||
        session.user?.name ||
        session.user?.email ||
        session.email;
      return `Connected to Qiko as *${name}* (linked ${new Date(session.linkedAt).toLocaleString()}).`;
    });
  });

  app.command("/qiko-workers", async ({ ack, body, client, respond }) => {
    await ack();
    await replyCommandWithLoading(client, body, respond, true, async () => {
      const session = requireSession(body.team_id, body.user_id);
      const agents = await fetchQikoAgents(session.token);
      const active = session.activeWorker?.name;
      const header = active
        ? `Your workers (active: *${active}*):\n\n`
        : "Your Qiko workers:\n\n";
      return (
        header +
        formatWorkersList(agents) +
        "\n\nSelect: `/qiko-worker <name or id>` (in the *channel* message box, not thread reply)\nThen chat: `/qiko-chat <message>`"
      );
    });
  });

  app.command("/qiko-worker", async ({ ack, body, client, respond }) => {
    await ack();
    const query = body.text?.trim() ?? "";
    if (!query) {
      await replyCommand(
        respond,
        "Usage: `/qiko-worker <worker name or id>`\nExample: `/qiko-worker my-sales-agent`"
      );
      return;
    }

    await replyCommandWithLoading(client, body, respond, true, async () => {
      const { worker } = await selectWorker(body.team_id, body.user_id, query);
      return `Active worker: *${worker.name}* (\`${worker.agentId}\`)\n\nChat: \`/qiko-chat your question here\``;
    });
  });

  app.command("/qiko-chat", async ({ ack, body, client, respond }) => {
    await ack();
    const message = body.text?.trim() ?? "";
    if (!message) {
      await replyCommand(
        respond,
        "Usage: `/qiko-chat <message>`\nExample: `/qiko-chat Summarize my pipeline`"
      );
      return;
    }

    await replyCommandWithLoading(client, body, respond, true, async () => {
      const { reply, worker } = await sendMessageToActiveWorker(
        body.team_id,
        body.user_id,
        message
      );
      return `*${worker.name}*:\n${truncateSlackText(reply)}`;
    });
  });

  app.command("/qiko-logout", async ({ ack, body, client, respond }) => {
    await ack();
    await replyCommandWithLoading(client, body, respond, false, async () => {
      const removed = clearSession(body.team_id, body.user_id);
      return removed
        ? "Disconnected from Qiko on this Slack workspace."
        : "You were not connected to Qiko.";
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
        `Qiko connected as *${displayName}*.\n• \`/qiko-workers\` — list workers\n• \`/qiko-worker <name>\` — pick one\n• \`/qiko-chat <message>\` — talk to worker`
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
              text: "Connect your Qiko account.\n\nRun `/qiko-login` in any channel or in the Qiko app.",
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
