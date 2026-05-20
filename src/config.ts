const port = Number(process.env.PORT) || 3001;

function resolveAppUrl(): string {
  const explicit = process.env.SLACK_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const render = process.env.RENDER_EXTERNAL_URL?.trim();
  if (render) return render.replace(/\/$/, "");

  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;

  return `http://localhost:${port}`;
}

export const config = {
  port,
  appUrl: resolveAppUrl(),
  signingSecret: process.env.SLACK_SIGNING_SECRET?.trim() || "",
  clientId: process.env.SLACK_CLIENT_ID?.trim() || "",
  clientSecret: process.env.SLACK_CLIENT_SECRET?.trim() || "",
  stateSecret:
    process.env.SLACK_STATE_SECRET?.trim() || "change-me-to-a-long-random-string",
  botToken: process.env.SLACK_BOT_TOKEN?.trim() || "",
  appToken: process.env.SLACK_APP_TOKEN?.trim() || "",
  qikoApiBaseUrl: process.env.QIKO_API_BASE_URL?.trim() || "",
  botScopes: ["chat:write", "commands", "users:read", "im:write"] as const,
};

/** Production / public install: OAuth per workspace. Local dev: optional single bot token. */
export function isOAuthMode(): boolean {
  return Boolean(config.clientId && config.clientSecret);
}

export function isSocketMode(): boolean {
  return Boolean(config.appToken);
}

export function validateConfig(): void {
  if (!config.signingSecret) {
    throw new Error("SLACK_SIGNING_SECRET is required");
  }
  if (!isOAuthMode() && !config.botToken) {
    throw new Error(
      "Set SLACK_CLIENT_ID + SLACK_CLIENT_SECRET (production) or SLACK_BOT_TOKEN (local dev)"
    );
  }
  if (isOAuthMode()) {
    console.log(
      `OAuth mode: clientId=${config.clientId.slice(0, 8)}… appUrl=${config.appUrl}`
    );
  }
  if (!config.qikoApiBaseUrl) {
    console.warn("Warning: QIKO_API_BASE_URL is not set — Qiko login will fail");
  }
}

export function slackEventsUrl(): string {
  return `${config.appUrl}/slack/events`;
}

export function installUrl(): string {
  return `${config.appUrl}/slack/install`;
}

export function oauthRedirectUrl(): string {
  return `${config.appUrl}/slack/oauth_redirect`;
}
