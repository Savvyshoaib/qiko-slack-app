import { App, ExpressReceiver } from "@slack/bolt";
import {
  config,
  installUrl,
  isOAuthMode,
  isSocketMode,
  oauthRedirectUrl,
  slackEventsUrl,
} from "./config.js";
import { postgresInstallationStore } from "./postgresInstallationStore.js";
import { resolveInstallationStore, usePostgresInstallStore } from "./resolveInstallationStore.js";
import { renderLandingHtml } from "./landing.js";
import { registerHandlers } from "./registerHandlers.js";

function attachPublicRoutes(receiver: ExpressReceiver, oauth: boolean): void {
  receiver.router.get("/", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(renderLandingHtml());
  });

  receiver.router.get("/health", async (_req, res) => {
    let installations = 0;
    if (usePostgresInstallStore()) {
      try {
        installations = await postgresInstallationStore.countInstallations();
      } catch {
        installations = -1;
      }
    }
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        mode: oauth ? "oauth" : "single-workspace",
        appUrl: config.appUrl,
        installStore: usePostgresInstallStore() ? "postgres" : "file",
        installations,
      })
    );
  });
}

export function createApp(): App {
  const socketMode = isSocketMode();
  const oauth = isOAuthMode();

  let receiver: ExpressReceiver | undefined;

  if (!socketMode) {
    receiver = oauth
      ? new ExpressReceiver({
          signingSecret: config.signingSecret,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          stateSecret: config.stateSecret,
          scopes: [...config.botScopes],
          installationStore: resolveInstallationStore(),
          endpoints: "/slack/events",
          processBeforeResponse: true,
          installerOptions: {
            directInstall: true,
            installPath: "/slack/install",
            redirectUriPath: "/slack/oauth_redirect",
            // Slack "Install App" without /slack/install skips state; PKCE still applies.
            stateVerification: false,
            callbackOptions: {
              success: (_installation, _opts, _req, res) => {
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(`<!DOCTYPE html><html><body style="font-family:system-ui;max-width:520px;margin:48px auto;padding:0 20px">
<h1>Qiko installed</h1>
<p>Return to Slack, open <strong>Apps → Qiko</strong>, then run <code>/qiko-login</code>.</p>
<p>In a channel, invite the bot first: <code>/invite @Qiko</code></p>
</body></html>`);
              },
              failure: (error, _opts, _req, res) => {
                console.error("OAuth install failed:", error);
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.status(500).end(`<!DOCTYPE html><html><body style="font-family:system-ui;max-width:520px;margin:48px auto">
<h1>Install failed</h1>
<p>Try again from <a href="/slack/install">/slack/install</a> (not the Slack dashboard redirect URL alone).</p>
</body></html>`);
              },
            },
          },
        })
      : new ExpressReceiver({
          signingSecret: config.signingSecret,
          endpoints: "/slack/events",
          processBeforeResponse: true,
        });

    attachPublicRoutes(receiver, oauth);
  }

  // OAuth must live on ExpressReceiver (custom receiver ignores App-level clientId/secret).
  const app = oauth
    ? new App({ receiver })
    : new App({
        token: config.botToken,
        signingSecret: config.signingSecret,
        socketMode,
        receiver,
        ...(socketMode ? { appToken: config.appToken } : {}),
      });

  registerHandlers(app);
  return app;
}

export function logStartup(): void {
  const oauth = isOAuthMode();
  const socketMode = isSocketMode();

  console.log(`Qiko Slack app — ${config.appUrl}`);
  if (socketMode) {
    console.log("Transport: Socket Mode");
  } else {
    console.log(`Listening on port ${config.port}`);
    console.log(`Install: ${installUrl()}`);
    console.log(`Slack events: ${slackEventsUrl()}`);
    console.log(`OAuth redirect: ${oauthRedirectUrl()}`);
  }
  console.log(`Mode: ${oauth ? "OAuth (multi-workspace)" : "single-workspace dev token"}`);
}
