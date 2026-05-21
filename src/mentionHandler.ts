import { fetchQikoAgents } from "./qikoClient.js";
import { getSession } from "./userSessions.js";
import {
  formatWorkersList,
  requireSession,
  selectWorker,
  selectWorkerByIndex,
  sendMessageToActiveWorker,
} from "./workerChat.js";

/** Remove `<@U123>` bot mention from message text. */
export function stripBotMention(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/gi, "").trim();
}

const GREETING = /^(hi|hello|hey|help|\?|thanks|thank you)$/i;

export type MentionRoute =
  | { kind: "help" }
  | { kind: "workers" }
  | { kind: "select_worker"; query: string }
  | { kind: "chat"; message: string };

export function parseMentionCommand(text: string): MentionRoute {
  const t = text.trim();
  if (!t || GREETING.test(t)) return { kind: "help" };
  if (/^workers?$/i.test(t) || /^list$/i.test(t)) return { kind: "workers" };

  const workerMatch = t.match(/^(?:worker|use)\s+(.+)$/i);
  if (workerMatch) return { kind: "select_worker", query: workerMatch[1].trim() };

  if (/^\d+$/.test(t)) return { kind: "select_worker", query: t };

  return { kind: "chat", message: t };
}

export function mentionHelpText(loggedIn: boolean): string {
  if (!loggedIn) {
    return (
      "Connect Qiko first with `/qiko-login`, then mention me anytime.\n" +
      "Example: `@Qikobot what were my top expenses in February?`"
    );
  }
  return (
    "*Talk to Qiko with @Qikobot*\n" +
    "• Ask anything — I'll reply using your active worker (or the first ready one).\n" +
    "• `@Qikobot workers` — list workers\n" +
    "• `@Qikobot worker 1` or `@Qikobot worker Daniel` — switch worker\n" +
    "• `/qiko-login` only needed once to sign in"
  );
}

export async function handleMentionRoute(
  teamId: string,
  userId: string,
  route: MentionRoute
): Promise<{ content: string; workerName?: string }> {
  if (!getSession(teamId, userId)) {
    return { content: mentionHelpText(false) };
  }

  switch (route.kind) {
    case "help":
      return { content: mentionHelpText(true) };
    case "workers": {
      const session = requireSession(teamId, userId);
      const agents = await fetchQikoAgents(session.token);
      const active = session.activeWorker?.name;
      const header = active
        ? `*Your Qiko workers* (active: *${active}*)\n\n`
        : "*Your Qiko workers*\n\n";
      return {
        content:
          header +
          formatWorkersList(agents) +
          "\n\nSwitch: `@Qikobot worker 1` or `@Qikobot worker <name>`",
      };
    }
    case "select_worker": {
      const q = route.query;
      const { worker } = /^\d+$/.test(q)
        ? await selectWorkerByIndex(teamId, userId, Number.parseInt(q, 10))
        : await selectWorker(teamId, userId, q);
      return {
        content: `Active worker: *${worker.name}*. Ask me anything!`,
        workerName: worker.name,
      };
    }
    case "chat": {
      const { reply, worker } = await sendMessageToActiveWorker(
        teamId,
        userId,
        route.message
      );
      return { content: reply, workerName: worker.name };
    }
  }
}
