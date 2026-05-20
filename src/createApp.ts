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
        qikoApi: config.qikoApiBaseUrl
          ? config.qikoApiBaseUrl.replace(/\/api\/avatar\/?$/, "…/api/avatar")
          : "not-set",
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
          // false: respond to Slack immediately after ack(); avoids operation_timeout on slow Qiko API
          processBeforeResponse: false,
          installerOptions: {
            directInstall: true,
            installPath: "/slack/install",
            redirectUriPath: "/slack/oauth_redirect",
            // Slack "Install App" without /slack/install skips state; PKCE still applies.
            stateVerification: false,
            callbackOptions: {
              success: (_installation, _opts, _req, res) => {
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(`<!DOCTYPE html><html><body style="font-family:system-ui;max-width:560px;margin:48px auto;padding:0 20px;line-height:1.5">
<h1>Qikobot installed</h1>
<p>In Slack: click <strong>Apps</strong> → <strong>Qikobot</strong> → <strong>Messages</strong> tab to chat.</p>
<p>Then run <code>/qiko-login</code> and sign in with your Qiko email and password.</p>
<p>In a channel: <code>/invite @Qiko</code> first if commands need the bot in that channel.</p>
<p class="muted" style="color:#64748b">Password tip: use the exact password from the Qiko web app (check for typos).</p>
</body></html>`);
              },
              failure: (error, _opts, _req, res) => {
                console.error("OAuth install failed:", error);
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.statusCode = 500;
                res.end(`<!DOCTYPE html><html><body style="font-family:system-ui;max-width:520px;margin:48px auto">
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
          processBeforeResponse: false,
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
