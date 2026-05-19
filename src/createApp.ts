import { App, ExpressReceiver } from "@slack/bolt";
import {
  config,
  installUrl,
  isOAuthMode,
  isSocketMode,
  slackEventsUrl,
} from "./config.js";
import { fileInstallationStore } from "./installationStore.js";
import { renderLandingHtml } from "./landing.js";
import { registerHandlers } from "./registerHandlers.js";

export function createApp(): App {
  const socketMode = isSocketMode();
  const oauth = isOAuthMode();

  let receiver: ExpressReceiver | undefined;

  if (!socketMode) {
    receiver = new ExpressReceiver({
      signingSecret: config.signingSecret,
      endpoints: "/slack/events",
      processBeforeResponse: true,
    });

    receiver.router.get("/", (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderLandingHtml());
    });

    receiver.router.get("/health", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          mode: oauth ? "oauth" : "single-workspace",
          appUrl: config.appUrl,
        })
      );
    });
  }

  const app = oauth
    ? new App({
        signingSecret: config.signingSecret,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        stateSecret: config.stateSecret,
        scopes: [...config.botScopes],
        installationStore: fileInstallationStore,
        installerOptions: {
          directInstall: true,
          installPath: "/slack/install",
          redirectUriPath: "/slack/oauth_redirect",
        },
        socketMode,
        receiver,
        ...(socketMode ? { appToken: config.appToken } : {}),
      })
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
