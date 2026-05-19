# Qiko Slack App — Railway deploy (har workspace ke liye)

Yeh guide ngrok hata kar **Railway** par deploy karti hai taake **koi bhi Slack workspace** install link se app add kar sake.

---

## 1. Code changes (already in repo)

| Feature | Detail |
|--------|--------|
| **OAuth** | `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET` — har workspace ka apna bot token |
| **Install page** | `https://YOUR-DOMAIN/` → **Add to Slack** |
| **Events** | `https://YOUR-DOMAIN/slack/events` |
| **OAuth callback** | `https://YOUR-DOMAIN/slack/oauth_redirect` |
| **Sessions** | `teamId:userId` — multi-workspace safe |

Production par **`SLACK_BOT_TOKEN` mat rakho** (sirf local dev ke liye).

---

## 2. Railway par deploy

### A. GitHub repo connect

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Repo select karo; **Root Directory** = `slack-app` (agar monorepo hai)
3. Ya sirf `slack-app` folder wali repo connect karo

### B. Environment variables

Railway → service → **Variables**:

| Variable | Value |
|----------|--------|
| `SLACK_SIGNING_SECRET` | api.slack.com → app → Basic Information |
| `SLACK_CLIENT_ID` | Basic Information → Client ID |
| `SLACK_CLIENT_SECRET` | Basic Information → Client Secret |
| `SLACK_STATE_SECRET` | koi lambi random string (32+ chars) |
| `QIKO_API_BASE_URL` | `https://stage-backend.qiko.ai/api/avatar` (ya production API) |

**Optional** (Railway khud domain deta hai):

| Variable | Value |
|----------|--------|
| `SLACK_APP_URL` | `https://qiko-slack-production.up.railway.app` (apna Railway URL) |

Agar `SLACK_APP_URL` na do to app `https://${RAILWAY_PUBLIC_DOMAIN}` use karegi.

**Mat lagao production par:** `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, ngrok URLs.

### C. Domain

1. Railway → **Settings** → **Networking** → **Generate Domain**
2. URL copy karo, e.g. `https://qiko-slack-production.up.railway.app`
3. `SLACK_APP_URL` variable mein wahi paste karo (trailing slash ke bina)

### D. Deploy

Railway automatically `pnpm install` + `pnpm start` chalayega (`railway.toml`).

Health check: `https://YOUR-DOMAIN/health` → `{"ok":true,"mode":"oauth"}`

---

## 3. Slack app configure (api.slack.com)

`YOUR_RAILWAY_DOMAIN` = Railway domain (bina `https://`)

### OAuth & Permissions → Redirect URLs

```
https://YOUR_RAILWAY_DOMAIN/slack/oauth_redirect
```

### Interactivity & Shortcuts

- **ON**
- Request URL: `https://YOUR_RAILWAY_DOMAIN/slack/events`

### Slash Commands (har command)

Request URL: `https://YOUR_RAILWAY_DOMAIN/slack/events`

Ya **App Manifest** paste karo (`slack-manifest.yaml` se `YOUR_RAILWAY_DOMAIN` replace karke) → **Save** → **Reinstall to Workspace** (dev workspace).

### Socket Mode

**OFF** (production HTTP events)

### Agents & AI Apps (optional)

**ON** — composer par “Qiko is thinking…” ke liye

### Manage Distribution

Checklist complete → **Activate Public Distribution**

---

## 4. Install link share karo

Deploy + Slack URLs set hone ke baad:

**Option A — Landing page**

```
https://YOUR_RAILWAY_DOMAIN/
```

**Option B — Direct OAuth**

```
https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID&scope=chat:write,commands,users:read,im:write
```

Har nayi team **Add to Slack** → allow → phir `/qiko-login`.

---

## 5. Verify

1. `curl https://YOUR_RAILWAY_DOMAIN/health`
2. Browser: landing page + **Add to Slack**
3. Slack: `/qiko-login` → login → `/qiko-workers`
4. Doosre workspace se same install link try karo

---

## 6. Important notes

### Data on Railway

`data/` (installations + Qiko sessions) **ephemeral disk** par hai — redeploy par reset ho sakta hai. Baad mein Postgres / Redis add karna behtar hai.

### Secrets

`.env` git mein commit mat karo. Railway Variables use karo.

### Local dev

`.env` mein `SLACK_BOT_TOKEN` rakho (OAuth optional). `pnpm dev` — ngrok sirf tab jab HTTP events test karna ho bina Railway ke.

---

## Quick checklist

- [ ] Railway deploy green
- [ ] `SLACK_APP_URL` = Railway HTTPS URL
- [ ] Slack: redirect + events + slash URLs updated (no ngrok)
- [ ] `SLACK_BOT_TOKEN` removed from Railway
- [ ] Public distribution activated
- [ ] Install link tested on 2nd workspace
