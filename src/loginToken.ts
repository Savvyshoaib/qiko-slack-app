import crypto from "node:crypto";
import { config } from "./config.js";

const MAX_AGE_MS = 15 * 60 * 1000;

export function createLoginToken(teamId: string, userId: string): string {
  const issued = Date.now().toString();
  const payload = `${teamId}:${userId}:${issued}`;
  const sig = crypto
    .createHmac("sha256", config.stateSecret)
    .update(payload)
    .digest("base64url");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyLoginToken(
  token: string
): { teamId: string; userId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon < 0) return null;

    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const parts = payload.split(":");
    if (parts.length < 3) return null;

    const issued = Number(parts[parts.length - 1]);
    const userId = parts[parts.length - 2];
    const teamId = parts.slice(0, -2).join(":");

    const expected = crypto
      .createHmac("sha256", config.stateSecret)
      .update(payload)
      .digest("base64url");

    if (sig !== expected || !teamId || !userId) return null;
    if (Date.now() - issued > MAX_AGE_MS) return null;

    return { teamId, userId };
  } catch {
    return null;
  }
}

export function slackLoginUrl(teamId: string, userId: string): string {
  const token = createLoginToken(teamId, userId);
  return `${config.appUrl}/slack/login?token=${encodeURIComponent(token)}`;
}
