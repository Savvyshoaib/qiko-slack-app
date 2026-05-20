import { config } from "./config.js";

/** Headers that match the Qiko web app so Cloudflare/WAF does not block server requests. */
export function qikoApiHeaders(extra?: Record<string, string>): Record<string, string> {
  const origin = config.qikoWebOrigin;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; QikoSlackApp/1.0)",
    Origin: origin,
    Referer: `${origin}/`,
    "X-Requested-With": "XMLHttpRequest",
    ...extra,
  };
}

export async function readQikoErrorBody(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return "";
  if (text.trimStart().startsWith("{")) {
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      const errors = data.errors;
      if (errors && typeof errors === "object") {
        const first = Object.values(errors as Record<string, unknown>)[0];
        if (Array.isArray(first) && typeof first[0] === "string") return first[0];
      }
      if (typeof data.message === "string" && data.message) return data.message;
    } catch {
      /* ignore */
    }
  }
  if (text.includes("cloudflare") || text.includes("Cloudflare")) {
    return "Qiko API blocked this request (Cloudflare). Backend team must allow Render server traffic.";
  }
  return text.slice(0, 120);
}
