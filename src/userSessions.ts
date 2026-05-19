import fs from "node:fs";
import path from "node:path";
import type { QikoUser } from "./qikoClient.js";

export interface ActiveWorker {
  agentId: string;
  name: string;
  userName?: string;
}

export interface QikoSession {
  token: string;
  user: QikoUser | null;
  email: string;
  linkedAt: string;
  activeWorker?: ActiveWorker | null;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const SESSIONS_FILE = path.join(DATA_DIR, "qiko-sessions.json");

type SessionMap = Record<string, QikoSession>;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAll(): SessionMap {
  ensureDataDir();
  if (!fs.existsSync(SESSIONS_FILE)) return {};
  try {
    const raw = fs.readFileSync(SESSIONS_FILE, "utf8");
    const parsed = JSON.parse(raw) as SessionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(sessions: SessionMap): void {
  ensureDataDir();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf8");
}

/** Unique per Slack workspace + user (multi-workspace safe). */
export function sessionKey(teamId: string, userId: string): string {
  return `${teamId}:${userId}`;
}

export function getSession(teamId: string, userId: string): QikoSession | null {
  return readAll()[sessionKey(teamId, userId)] ?? null;
}

export function setSession(
  teamId: string,
  userId: string,
  session: Omit<QikoSession, "linkedAt"> & { linkedAt?: string }
): QikoSession {
  const all = readAll();
  const key = sessionKey(teamId, userId);
  const record: QikoSession = {
    ...session,
    linkedAt: session.linkedAt ?? new Date().toISOString(),
  };
  all[key] = record;
  writeAll(all);
  return record;
}

export function clearSession(teamId: string, userId: string): boolean {
  const all = readAll();
  const key = sessionKey(teamId, userId);
  if (!all[key]) return false;
  delete all[key];
  writeAll(all);
  return true;
}

export function setActiveWorker(
  teamId: string,
  userId: string,
  worker: ActiveWorker | null
): QikoSession | null {
  const all = readAll();
  const key = sessionKey(teamId, userId);
  const session = all[key];
  if (!session) return null;
  session.activeWorker = worker;
  all[key] = session;
  writeAll(all);
  return session;
}
