import { qikoApiHeaders, readQikoErrorBody } from "./qikoHttp.js";

export interface QikoLoginPayload {
  email: string;
  password: string;
}

export interface QikoUser {
  id?: number | string;
  email?: string;
  user_name?: string;
  name?: string;
  agent_unique_id?: string;
  type?: string;
  [key: string]: unknown;
}

export interface QikoLoginResponse {
  success?: boolean;
  message?: string;
  data?: {
    token?: string;
    user?: QikoUser;
  };
}

function getBaseUrl(): string {
  const base = process.env.QIKO_API_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("QIKO_API_BASE_URL is not set");
  }
  return base;
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const message = typeof obj.message === "string" ? obj.message : null;
    const errors = obj.errors;
    if (errors && typeof errors === "object") {
      const first = Object.values(errors as Record<string, unknown>)[0];
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
    if (message && message !== "Unauthorized") return message;
  }
  return fallback;
}

export async function loginToQiko(payload: QikoLoginPayload): Promise<QikoLoginResponse> {
  const url = `${getBaseUrl()}/login`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: qikoApiHeaders(),
      body: JSON.stringify({ email: payload.email, password: payload.password }),
    });
  } catch (error) {
    console.error("Qiko login network error:", error);
    throw new Error(
      "Could not reach Qiko API. Check QIKO_API_BASE_URL on the server (should end with /api/avatar)."
    );
  }

  if (!res.ok) {
    const detail = await readQikoErrorBody(res);
    const msg =
      res.status === 403
        ? detail ||
          "Qiko API blocked this server (HTTP 403). Ask backend to allow Render outbound IPs."
        : detail || extractErrorMessage({}, "Login failed");
    console.warn(`Qiko login failed: HTTP ${res.status} — ${msg}`);
    throw new Error(msg);
  }

  const data = (await res.json().catch(() => ({}))) as QikoLoginResponse;

  if (data?.success === false) {
    const msg = extractErrorMessage(data, "Invalid email or password");
    console.warn(`Qiko login failed: ${msg}`);
    throw new Error(msg);
  }

  const token =
    data?.data?.token ??
    (data?.data as { access_token?: string } | undefined)?.access_token;

  if (!token) {
    console.warn("Qiko login: success response but no token", JSON.stringify(data).slice(0, 200));
    throw new Error(data?.message || "Login succeeded but no token was returned");
  }

  if (!data.data) data.data = {};
  data.data.token = token;

  return data;
}

export interface QikoAgent {
  id: string;
  agent_unique_id?: string;
  agent_name?: string;
  user_name?: string;
  email?: string;
  status?: string;
}

export interface QikoChatPayload {
  agent_unique_id: string;
  user_name: string;
  message: string;
  email: string;
}

export async function fetchQikoAgents(token: string): Promise<QikoAgent[]> {
  const res = await fetch(`${getBaseUrl()}/get-agents`, {
    method: "GET",
    headers: qikoApiHeaders({ Authorization: `Bearer ${token}` }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractErrorMessage(data, "Failed to load workers"));
  }

  if (Array.isArray(data)) return data as QikoAgent[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: QikoAgent[] }).data)) {
    return (data as { data: QikoAgent[] }).data;
  }
  return [];
}

export async function chatWithQikoWorker(
  token: string,
  agentId: string,
  payload: QikoChatPayload
): Promise<string> {
  const res = await fetch(`${getBaseUrl()}/${encodeURIComponent(agentId)}/chat-with-history`, {
    method: "POST",
    headers: qikoApiHeaders({ Authorization: `Bearer ${token}` }),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractErrorMessage(data, "Worker did not respond"));
  }

  const replyFromArray =
    Array.isArray((data as { data?: unknown[] })?.data) &&
    (data as { data: { reply?: string }[] }).data[0]?.reply;
  const replyDirect = (data as { data?: { reply?: string } })?.data?.reply;
  const reply = replyFromArray || replyDirect;
  if (typeof reply === "string" && reply.trim()) return reply.trim();
  throw new Error("Worker returned an empty reply");
}

export async function fetchQikoProfile(token: string): Promise<QikoUser | null> {
  const res = await fetch(`${getBaseUrl()}/user/studio`, {
    method: "GET",
    headers: qikoApiHeaders({ Authorization: `Bearer ${token}` }),
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data && typeof data === "object") {
    return data as QikoUser;
  }
  return null;
}
