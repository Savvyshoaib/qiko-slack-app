import {
  chatWithQikoWorker,
  fetchQikoAgents,
  type QikoAgent,
  type QikoChatPayload,
} from "./qikoClient.js";
import { getSession, setActiveWorker, type ActiveWorker } from "./userSessions.js";

export function requireSession(teamId: string, userId: string) {
  const session = getSession(teamId, userId);
  if (!session) {
    throw new Error("Not connected to Qiko. Run `/qiko-login` first.");
  }
  return session;
}

export function agentChatId(agent: QikoAgent): string {
  return agent.agent_unique_id || agent.user_name || agent.id;
}

export function agentDisplayName(agent: QikoAgent): string {
  return agent.agent_name || agent.user_name || agentChatId(agent);
}

export function formatWorkersList(agents: QikoAgent[]): string {
  const ready = agents.filter((a) => (a.status || "").toLowerCase() === "ready");
  const list = ready.length > 0 ? ready : agents;

  if (list.length === 0) {
    return "No workers found on your Qiko account. Create one in the Qiko dashboard first.";
  }

  return list
    .map((a, i) => {
      const id = agentChatId(a);
      const status = a.status ? ` (${a.status})` : "";
      return `${i + 1}. *${agentDisplayName(a)}* — \`${id}\`${status}`;
    })
    .join("\n");
}

export function resolveWorker(
  agents: QikoAgent[],
  query: string
): QikoAgent | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const ready = agents.filter((a) => (a.status || "").toLowerCase() === "ready");

  const exact = ready.find((a) => {
    const id = agentChatId(a).toLowerCase();
    const name = agentDisplayName(a).toLowerCase();
    return id === q || name === q;
  });
  if (exact) return exact;

  const partial = ready.find((a) => {
    const id = agentChatId(a).toLowerCase();
    const name = agentDisplayName(a).toLowerCase();
    return id.includes(q) || name.includes(q);
  });
  return partial ?? null;
}

export function toActiveWorker(agent: QikoAgent): ActiveWorker {
  return {
    agentId: agentChatId(agent),
    name: agentDisplayName(agent),
    userName: agent.user_name,
  };
}

export async function selectWorker(
  teamId: string,
  userId: string,
  query: string
): Promise<{ worker: ActiveWorker; agents: QikoAgent[] }> {
  const session = requireSession(teamId, userId);
  const agents = await fetchQikoAgents(session.token);
  const match = resolveWorker(agents, query);

  if (!match) {
    throw new Error(
      `Worker "${query}" not found. Run \`/qiko-workers\` to see names and IDs.`
    );
  }

  if ((match.status || "").toLowerCase() !== "ready") {
    throw new Error(
      `Worker "${agentDisplayName(match)}" is not ready yet (status: ${match.status || "unknown"}).`
    );
  }

  const worker = toActiveWorker(match);
  setActiveWorker(teamId, userId, worker);
  return { worker, agents };
}

export async function sendMessageToActiveWorker(
  teamId: string,
  userId: string,
  message: string
): Promise<{ reply: string; worker: ActiveWorker }> {
  const session = requireSession(teamId, userId);
  const text = message.trim();
  if (!text) {
    throw new Error("Message cannot be empty. Example: `/qiko-chat What are my top leads?`");
  }

  let worker = session.activeWorker ?? null;
  if (!worker) {
    const agents = await fetchQikoAgents(session.token);
    const ready = agents.filter((a) => (a.status || "").toLowerCase() === "ready");
    if (ready.length === 1) {
      worker = toActiveWorker(ready[0]);
      setActiveWorker(teamId, userId, worker);
    } else {
      throw new Error(
        "No worker selected. Run `/qiko-worker <name>` or `/qiko-workers` first."
      );
    }
  }

  const payload: QikoChatPayload = {
    agent_unique_id: worker.agentId,
    user_name: worker.userName || worker.agentId,
    message: text,
    email: session.email,
  };

  const reply = await chatWithQikoWorker(session.token, worker.agentId, payload);
  return { reply, worker };
}
