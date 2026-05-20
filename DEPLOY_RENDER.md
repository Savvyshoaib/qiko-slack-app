# Deploy Qiko Slack app on Render

Production URL (after deploy): **https://qiko-slack-app.onrender.com**

## 1. Render (dashboard or MCP)

1. Connect GitHub repo `Savvyshoaib/qiko-slack-app` on [Render Dashboard](https://dashboard.render.com/).
2. Use **Blueprint** from `render.yaml` or create:
   - **Web service** `qiko-slack-app` (Node, free)
   - **Postgres** `qiko-slack-db` (free) — OAuth installs persist here
3. Set environment variables (see below).
4. Deploy. Open **https://qiko-slack-app.onrender.com/health** — should show `"installStore":"postgres"`.

## 2. Environment variables (Render → qiko-slack-app → Environment)

| Variable | Value |
|----------|--------|
| `SLACK_SIGNING_SECRET` | Slack app → Basic Information |
| `SLACK_CLIENT_ID` | Slack app → Basic Information |
| `SLACK_CLIENT_SECRET` | Slack app → Basic Information |
| `SLACK_STATE_SECRET` | Long random string (e.g. 32+ chars) |
| `QIKO_API_BASE_URL` | `https://stage-backend.qiko.ai/api/avatar` |
| `DATABASE_URL` | Auto from Postgres `qiko-slack-db` (Blueprint links it) |

Do **not** set `SLACK_BOT_TOKEN` in production (OAuth multi-workspace).

`RENDER_EXTERNAL_URL` is set automatically by Render.

## 3. Slack app settings (api.slack.com)

Replace every Railway URL with:

| Setting | URL |
|---------|-----|
| **Install / landing** | https://qiko-slack-app.onrender.com/ |
| **OAuth redirect** | https://qiko-slack-app.onrender.com/slack/oauth_redirect |
| **Event Subscriptions** | https://qiko-slack-app.onrender.com/slack/events |
| **Interactivity** | https://qiko-slack-app.onrender.com/slack/events |
| **Each slash command** | https://qiko-slack-app.onrender.com/slack/events |

Or paste updated `slack-manifest.yaml` → **Create from manifest**.

## 4. After deploy

1. Open https://qiko-slack-app.onrender.com/ → **Add to Slack** (complete OAuth).
2. In Slack: Apps → **Qiko** → `/qiko-login`.
3. Free tier: service may sleep after 15 min idle; first slash command can take ~1 min to wake.

## 5. Remove Railway

Delete the Railway project **beneficial-happiness** / service **qiko-slack-app** in [Railway Dashboard](https://railway.app/) so old URLs stop billing.

## Cursor MCP

```json
"render": {
  "url": "https://mcp.render.com/mcp",
  "headers": { "Authorization": "Bearer YOUR_RENDER_API_KEY" }
}
```
