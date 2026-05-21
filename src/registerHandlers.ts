import type { App, BlockButtonAction, BlockPlainTextInputAction } from "@slack/bolt";
import { fetchQikoAgents, loginToQiko } from "./qikoClient.js";
import { clearLoginDraft, getLoginDraft, setLoginDraft } from "./loginDraft.js";
import { postSlackText } from "./slackPost.js";
import { clearSession, getSession, setSession } from "./userSessions.js";
import {
  buildLoginLoadingModal,
  buildLoginModal,
  PASSWORD_INPUT_ACTION,
  PASSWORD_TOGGLE_ACTION,
  QIKO_LOGIN_MODAL_CALLBACK,
} from "./views.js";
import {
  formatWorkersList,
  requireSession,
  selectWorker,
  sendMessageToActiveWorker,
} from "./workerChat.js";
import { withQikoTyping } from "./slackTypingIndicator.js";

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

async function closeLoginModal(
  client: { apiCall: (method: string, options?: Record<string, unknown>) => Promise<unknown> },
  viewId: string
): Promise<void> {
  try {
    await client.apiCall("views.pop", { view_id: viewId });
  } catch (error) {
    console.warn("Could not close login modal:", error);
  }
}

export function registerHandlers(app: App): void {
  app.error(async (error) => {
    console.error("Slack app error:", error);
  });

  app.command("/qiko-login", async ({ ack, body, client }) => {
    await ack();
    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: buildLoginModal() as never,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open login window";
      console.error("/qiko-login error:", error);
      await replyEphemeral(client, body.channel_id, body.user_id, message);
    }
  });

  app.command("/qiko-status", async ({ ack, body, client }) => {
    await ack();
    const threadTs = body.thread_ts || undefined;
    try {
      await withQikoTyping(client, body.channel_id, threadTs, async () => {
        const session = getSession(body.team_id, body.user_id);
        if (!session) {
          return {
            content: "Not connected to Qiko. Run `/qiko-login` to sign in.",
            ephemeral: true,
            userId: body.user_id,
          };
        }
        const name =
          session.user?.user_name ||
          session.user?.name ||
          session.user?.email ||
          session.email;
        return {
          content: `Connected to Qiko as *${name}* (linked ${new Date(session.linkedAt).toLocaleString()}).`,
          ephemeral: true,
          userId: body.user_id,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      await replyEphemeral(client, body.channel_id, body.user_id, message);
    }
  });

  app.command("/qiko-workers", async ({ ack, body, client }) => {
    await ack();
    const threadTs = body.thread_ts || undefined;
    try {
      await withQikoTyping(client, body.channel_id, threadTs, async () => {
        const session = requireSession(body.team_id, body.user_id);
        const agents = await fetchQikoAgents(session.token);
        const active = session.activeWorker?.name;
        const header = active
          ? `*Your Qiko workers* (active: *${active}*)\n\n`
          : "*Your Qiko workers*\n\n";
        return {
          content:
            header +
            formatWorkersList(agents) +
            "\n\n`/qiko-worker <name>` then `/qiko-chat <message>` or type in Qikobot Messages.",
        };
      });
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

    const threadTs = body.thread_ts || undefined;
    try {
      await withQikoTyping(client, body.channel_id, threadTs, async () => {
        const { worker } = await selectWorker(body.team_id, body.user_id, query);
        return {
          content: `Active worker: *${worker.name}*\n\nChat: \`/qiko-chat your question\` or message Qikobot directly.`,
        };
      });
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

    const threadTs = body.thread_ts || undefined;

    try {
      await withQikoTyping(client, body.channel_id, threadTs, async () => {
        const { reply, worker } = await sendMessageToActiveWorker(
          body.team_id,
          body.user_id,
          message
        );
        return { content: reply, workerName: worker.name };
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Something went wrong";
      await replyEphemeral(client, body.channel_id, body.user_id, msg);
    }
  });

  app.command("/qiko-logout", async ({ ack, body, client }) => {
    await ack();
    const threadTs = body.thread_ts || undefined;
    try {
      await withQikoTyping(client, body.channel_id, threadTs, async () => {
        const removed = clearSession(body.team_id, body.user_id);
        return {
          content: removed
            ? "Disconnected from Qiko on this Slack workspace."
            : "You were not connected to Qiko.",
          ephemeral: true,
          userId: body.user_id,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      await replyEphemeral(client, body.channel_id, body.user_id, message);
    }
  });

  app.action(PASSWORD_TOGGLE_ACTION, async ({ ack, body, client }) => {
    await ack();
    const actionBody = body as BlockButtonAction;
    const view = actionBody.view;
    if (!view || view.type !== "modal" || !view.id || !view.hash) return;

    const teamId = actionBody.team?.id ?? actionBody.user.team_id ?? "";
    const userId = actionBody.user.id;
    const show = actionBody.actions[0]?.value === "show";

    const email = view.state?.values?.email_block?.email_input?.value?.trim() ?? "";
    const fromInput = view.state?.values?.password_block?.[PASSWORD_INPUT_ACTION]?.value;
    let password = typeof fromInput === "string" ? fromInput : "";
    if (!password) password = getLoginDraft(teamId, userId)?.password ?? "";

    if (!show && password) {
      setLoginDraft(teamId, userId, { email, password });
    }

    await client.views.update({
      view_id: view.id,
      hash: view.hash,
      view: buildLoginModal({
        showPassword: show,
        email,
        passwordValue: password,
      }) as never,
    });
  });

  app.action(
    { action_id: PASSWORD_INPUT_ACTION, callback_id: QIKO_LOGIN_MODAL_CALLBACK },
    async ({ ack, body }) => {
      await ack();
      const actionBody = body as BlockPlainTextInputAction;
      const teamId = actionBody.team?.id ?? actionBody.user.team_id ?? "";
      const userId = actionBody.user.id;
      const password = actionBody.actions[0]?.value ?? "";
      const email =
        actionBody.view?.state?.values?.email_block?.email_input?.value?.trim() ?? "";
      setLoginDraft(teamId, userId, { email, password });
    }
  );

  app.view(
    { callback_id: QIKO_LOGIN_MODAL_CALLBACK, type: "view_closed" },
    async ({ body }) => {
      const teamId = body.team?.id ?? body.user.team_id ?? "";
      clearLoginDraft(teamId, body.user.id);
    }
  );

  app.view(QIKO_LOGIN_MODAL_CALLBACK, async ({ ack, body, view, client }) => {
    const teamId = body.team?.id ?? "";
    const email = view.state.values.email_block?.email_input?.value?.trim() ?? "";
    const fromField = view.state.values.password_block?.[PASSWORD_INPUT_ACTION]?.value ?? "";
    const password =
      fromField || getLoginDraft(teamId, body.user.id)?.password || "";

    if (!email || !password) {
      await ack({
        response_action: "errors",
        errors: {
          ...(!email ? { email_block: "Email is required" } : {}),
          ...(!password
            ? {
                email_block:
                  "Password is required. Use *Show password* if the field is hidden.",
              }
            : {}),
        },
      });
      return;
    }

    const viewId = view.id;
    const viewHash = view.hash;

    await ack({
      response_action: "update",
      view: buildLoginLoadingModal(),
    });

    try {
      const result = await loginToQiko({ email, password });
      const token = result.data!.token!;
      const user = result.data?.user ?? null;

      setSession(teamId, body.user.id, {
        token,
        user,
        email: user?.email ?? email,
      });

      clearLoginDraft(teamId, body.user.id);
      await closeLoginModal(client, viewId);

      const displayName = user?.user_name || user?.name || user?.email || email;
      await dmUser(
        client,
        body.user.id,
        `Qikobot connected as *${displayName}*.\n• Message this app directly, or use \`/qiko-workers\`, \`/qiko-worker <name>\`, \`/qiko-chat <message>\``
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      console.error("Qiko modal login error:", message);
      clearLoginDraft(teamId, body.user.id);

      const short = message.length > 140 ? `${message.slice(0, 137)}…` : message;
      try {
        await client.views.update({
          view_id: viewId,
          hash: viewHash,
          view: buildLoginModal({
            email,
            passwordValue: password,
            showPassword: true,
            error: short,
          }) as never,
        });
      } catch (updateError) {
        console.error("Could not restore login modal:", updateError);
        await dmUser(client, body.user.id, `Login failed: ${short}`);
      }
    }
  });

  app.event("message", async ({ event, client, context }) => {
    if (event.subtype || !("user" in event) || !event.user) return;
    if ("channel_type" in event && event.channel_type !== "im") return;
    const text = "text" in event ? event.text?.trim() : "";
    if (!text || text.startsWith("/")) return;

    const teamId = context.teamId ?? ("team" in event ? event.team : undefined);
    if (!teamId) return;

    const threadTs =
      ("thread_ts" in event && event.thread_ts) ||
      ("ts" in event ? event.ts : undefined);

    try {
      await withQikoTyping(client, event.channel, threadTs, async () => {
        const { reply, worker } = await sendMessageToActiveWorker(
          teamId,
          event.user,
          text
        );
        return { content: reply, workerName: worker.name };
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      await postSlackText(client, event.channel, message, {
        user: event.user,
        ephemeral: true,
        threadTs,
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
