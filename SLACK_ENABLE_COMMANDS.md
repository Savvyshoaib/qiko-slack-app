# Slack — sab commands ek saath enable karo

Yeh steps `/qiko-worker`, `/qiko-chat`, aur baqi sab slash commands Slack mein register karte hain.

**Composer typing indicator:** [api.slack.com](https://api.slack.com/apps) → app → **Agents & AI Apps** → **ON** → workspace mein dubara **Install**. Iske bina sirf chat messages dikhengi, neeche wala “Qiko is thinking…” nahi.

## Pehle check karo

1. `pnpm dev` chal raha ho (`slack-app` folder)
2. `ngrok http 3001` chal raha ho
3. Ngrok URL note karo (agar alag ho to `slack-manifest.yaml` mein replace karo)

Current URL (example):

```text
https://icing-cylinder-password.ngrok-free.dev/slack/events
```

---

## Option A — App Manifest (sabse tez, 2 min)

1. Kholo: https://api.slack.com/apps → apni **Qiko** app
2. Left sidebar → **App Manifest**
3. Poora content `slack-app/slack-manifest.yaml` se copy karo
4. Agar ngrok URL badli ho, file mein **har** `icing-cylinder-password.ngrok-free.dev` ko apni nayi host se replace karo
5. **Save Changes**
6. Slack prompts follow karo → **Reinstall to Workspace**
7. Permissions allow karo

---

## Option B — Har command manually

**Slash Commands** → **Create New Command** — teen naye (agar pehle nahi banaye):

| Command       | Request URL                                              | Usage hint              |
|---------------|----------------------------------------------------------|-------------------------|
| `/qiko-worker`| `https://YOUR-NGROK.ngrok-free.dev/slack/events`         | `[worker name or id]`   |
| `/qiko-chat`  | same URL                                                 | `[your message]`        |
| `/qiko-workers` | same URL (agar missing ho)                             | —                       |

**Interactivity** → ON → same Request URL

**Install App** → Reinstall

---

## Test (Qiko bot DM ya #channel)

```text
/qiko-login
/qiko-workers
/qiko-worker YOUR-WORKER-ID
/qiko-chat Hello, summarize my week
```

Type `/qiko` — autocomplete mein 6 commands dikhni chahiye.

---

## Agar command "not valid" aaye

- Manifest save + **Reinstall** kiya?
- Ngrok + `pnpm dev` dono chal rahe hain?
- Self-DM ("message yourself") use mat karo → **Apps → Qiko** bot DM
