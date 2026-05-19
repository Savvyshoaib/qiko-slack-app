import { installUrl, isOAuthMode, slackEventsUrl } from "./config.js";

export function renderLandingHtml(): string {
  const installLink = installUrl();
  const eventsUrl = slackEventsUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Qiko for Slack</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 48px auto; padding: 0 20px; background: #050810; color: #e2e8f0; line-height: 1.6; }
    h1 { color: #22d3ee; }
    a.btn { display: inline-block; margin: 16px 0; padding: 12px 20px; background: #22d3ee; color: #050810; text-decoration: none; border-radius: 8px; font-weight: 600; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    ol { padding-left: 1.2rem; }
    .muted { color: #94a3b8; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Qiko for Slack</h1>
  <p>Install Qiko in your Slack workspace. Each person signs in with their own Qiko account.</p>
  ${
    isOAuthMode()
      ? `<a class="btn" href="${installLink}">Add to Slack</a>`
      : `<p class="muted">OAuth not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET on the server.</p>`
  }
  <h2>After install</h2>
  <ol>
    <li>Open the <strong>Qiko</strong> app in Slack (Apps sidebar)</li>
    <li><code>/qiko-login</code> — your Qiko email &amp; password</li>
    <li><code>/qiko-workers</code> — list workers</li>
    <li><code>/qiko-worker &lt;name&gt;</code> — pick a worker</li>
    <li><code>/qiko-chat &lt;message&gt;</code> — chat with your worker</li>
  </ol>
  <p class="muted">Events URL (Slack app settings): <code>${eventsUrl}</code></p>
</body>
</html>`;
}
