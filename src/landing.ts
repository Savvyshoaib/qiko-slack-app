import { config, installUrl, isOAuthMode, slackEventsUrl } from "./config.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STAGE_SITE = "https://stage.qiko.ai";

export function renderLandingHtml(): string {
  const installLink = esc(installUrl());
  const eventsUrl = esc(slackEventsUrl());
  const qikoApp = esc(config.qikoWebOrigin);
  const logoUrl = esc(`${config.appUrl}/qiko-logo.png`);
  const oauth = isOAuthMode();

  const installBlock = oauth
    ? `<a class="btn-primary" href="${installLink}">
        <span>Add to Slack</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
      <p class="install-note">Install via <code>/slack/install</code> only. Do not paste the OAuth redirect URL by itself.</p>`
    : `<div class="alert">OAuth is not configured on this server. Set <code>SLACK_CLIENT_ID</code> and <code>SLACK_CLIENT_SECRET</code> in Render env vars.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Install Qikobot in Slack — connect your Qiko workers and chat in channels and DMs." />
  <title>Qikobot for Slack</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #05070a;
      --bg-elevated: rgba(15, 23, 42, 0.55);
      --border: rgba(148, 163, 184, 0.12);
      --text: #f1f5f9;
      --muted: #94a3b8;
      --indigo: #6366f1;
      --violet: #8b5cf6;
      --cyan: #22d3ee;
      --gradient: linear-gradient(135deg, var(--indigo) 0%, var(--violet) 42%, var(--cyan) 100%);
      --glow: 0 0 48px rgba(34, 211, 238, 0.22), 0 0 80px rgba(99, 102, 241, 0.18);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .bg-mesh {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background:
        radial-gradient(ellipse 80% 50% at 15% -10%, rgba(99, 102, 241, 0.35), transparent 55%),
        radial-gradient(ellipse 60% 45% at 85% 5%, rgba(34, 211, 238, 0.2), transparent 50%),
        radial-gradient(ellipse 70% 60% at 50% 100%, rgba(139, 92, 246, 0.15), transparent 55%);
    }

    .bg-grid {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      opacity: 0.35;
      background-image:
        linear-gradient(rgba(34, 211, 238, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(34, 211, 238, 0.04) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 75%);
    }

    .wrap {
      position: relative;
      z-index: 1;
      max-width: 720px;
      margin: 0 auto;
      padding: 48px 24px 64px;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      margin-bottom: 40px;
      text-decoration: none;
      transition: opacity 0.15s ease;
    }

    .brand:hover { opacity: 0.88; }

    .brand-logo {
      height: 60px;
      width: auto;
      display: block;
      margin-left: -12px;
    }

    .hero h1 {
      font-size: clamp(2rem, 5vw, 2.75rem);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin-bottom: 16px;
    }

    .hero h1 .accent {
      background: var(--gradient);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .hero-lead {
      font-size: 1.1rem;
      color: var(--muted);
      max-width: 540px;
      margin-bottom: 28px;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 14px 28px;
      border-radius: 999px;
      background: var(--gradient);
      color: #05070a;
      font-weight: 700;
      font-size: 1rem;
      text-decoration: none;
      box-shadow: var(--glow);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 56px rgba(34, 211, 238, 0.35), 0 0 96px rgba(99, 102, 241, 0.25);
    }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-left: 12px;
      padding: 14px 22px;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--text);
      font-weight: 500;
      font-size: 0.95rem;
      text-decoration: none;
      background: rgba(15, 23, 42, 0.4);
      transition: border-color 0.15s, background 0.15s;
    }

    .btn-secondary:hover {
      border-color: rgba(34, 211, 238, 0.35);
      background: rgba(30, 41, 59, 0.5);
    }

    .cta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 0;
      margin-bottom: 12px;
    }

    .install-note {
      font-size: 0.85rem;
      color: var(--muted);
      margin-top: 14px;
      max-width: 520px;
    }

    .install-note code,
    .card code,
    .dev code {
      font-family: ui-monospace, "Cascadia Code", monospace;
      font-size: 0.88em;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid var(--border);
      padding: 2px 8px;
      border-radius: 6px;
      color: #e2e8f0;
    }

    .card {
      margin-top: 28px;
      padding: 24px 26px;
      border-radius: 16px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      backdrop-filter: blur(12px);
    }

    .card h2 {
      font-size: 1.05rem;
      font-weight: 600;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .card h2::before {
      content: "";
      width: 4px;
      height: 1.1em;
      border-radius: 2px;
      background: var(--gradient);
    }

    .steps {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .steps li {
      display: grid;
      grid-template-columns: 36px 1fr;
      gap: 14px;
      align-items: start;
    }

    .step-num {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--gradient);
      color: #05070a;
      font-weight: 700;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .step-body strong { color: var(--text); font-weight: 600; }
    .step-body p { color: var(--muted); font-size: 0.92rem; margin-top: 4px; }

    .cmd-grid {
      display: grid;
      gap: 10px;
    }

    @media (min-width: 520px) {
      .cmd-grid { grid-template-columns: 1fr 1fr; }
    }

    .cmd {
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid var(--border);
    }

    .cmd-name {
      font-family: ui-monospace, monospace;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--cyan);
      margin-bottom: 4px;
    }

    .cmd-desc {
      font-size: 0.82rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .mention-card {
      border-color: rgba(34, 211, 238, 0.28);
      background: linear-gradient(145deg, rgba(99, 102, 241, 0.12), rgba(15, 23, 42, 0.65));
    }

    .mention-examples {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 4px;
    }

    .mention-ex {
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid var(--border);
      font-family: ui-monospace, monospace;
      font-size: 0.88rem;
      color: #e2e8f0;
    }

    .mention-ex span {
      color: var(--cyan);
      font-weight: 600;
    }

    .tips {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tips li {
      font-size: 0.92rem;
      color: var(--muted);
      padding-left: 18px;
      position: relative;
    }

    .tips li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0.55em;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--gradient);
    }

    .alert {
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: #fecaca;
      font-size: 0.9rem;
    }

    .dev {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }

    .dev-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .dev-url {
      display: block;
      word-break: break-all;
      font-family: ui-monospace, monospace;
      font-size: 0.8rem;
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid var(--border);
      color: #cbd5e1;
    }

    footer {
      margin-top: 28px;
      text-align: center;
      font-size: 0.8rem;
      color: #64748b;
    }

    footer a {
      color: var(--cyan);
      text-decoration: none;
    }

    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="bg-mesh" aria-hidden="true"></div>
  <div class="bg-grid" aria-hidden="true"></div>

  <main class="wrap">
    <a class="brand" href="${STAGE_SITE}" target="_blank" rel="noopener noreferrer" aria-label="Qiko — opens stage.qiko.ai">
      <img class="brand-logo" src="${logoUrl}" alt="Qiko" width="120" height="60" />
    </a>

    <section class="hero">
      <h1><span class="accent">Qikobot</span> for Slack</h1>
      <p class="hero-lead">
        Connect your Slack workspace to Qiko. Sign in once, then mention
        <strong style="color: var(--text)">@Qikobot</strong> in any channel — tables, lists, and answers
        format cleanly in Slack. Same workers as
        <a href="${STAGE_SITE}" style="color: var(--cyan); text-decoration: none;">stage.qiko.ai</a>.
      </p>
      <div class="cta-row">
        ${installBlock}
        <a class="btn-secondary" href="${qikoApp}" target="_blank" rel="noopener">Open Qiko app ↗</a>
      </div>
    </section>

    <section class="card">
      <h2>Getting started</h2>
      <ol class="steps">
        <li>
          <span class="step-num">1</span>
          <div class="step-body">
            <strong>Install Qikobot</strong>
            <p>Click <em>Add to Slack</em> above and approve the app for your workspace.</p>
          </div>
        </li>
        <li>
          <span class="step-num">2</span>
          <div class="step-body">
            <strong>Open Qikobot in Slack</strong>
            <p>Apps sidebar → <strong>Qikobot</strong> → <strong>Messages</strong> tab (DM chat works after login).</p>
          </div>
        </li>
        <li>
          <span class="step-num">3</span>
          <div class="step-body">
            <strong>Sign in</strong>
            <p>Run <code>/qiko-login</code> and enter your Qiko email and password (same as the web app).</p>
          </div>
        </li>
        <li>
          <span class="step-num">4</span>
          <div class="step-body">
            <strong>Invite in channels</strong>
            <p>In <code>#your-channel</code>, run <code>/invite @Qikobot</code> so mentions work there.</p>
          </div>
        </li>
        <li>
          <span class="step-num">5</span>
          <div class="step-body">
            <strong>Talk to Qiko</strong>
            <p>Mention <code>@Qikobot</code> with your question. Use <code>@Qikobot workers</code> or <code>@Qikobot worker 1</code> to switch workers.</p>
          </div>
        </li>
      </ol>
    </section>

    <section class="card mention-card">
      <h2>@Qikobot in channels</h2>
      <p style="color: var(--muted); font-size: 0.92rem; margin-bottom: 16px;">
        No long slash commands needed after login. Mention the bot like a teammate — replies use Slack-friendly tables and formatting.
      </p>
      <div class="mention-examples">
        <div class="mention-ex"><span>@Qikobot</span> which expense is highest in February?</div>
        <div class="mention-ex"><span>@Qikobot</span> workers</div>
        <div class="mention-ex"><span>@Qikobot</span> worker Daniel Carter</div>
        <div class="mention-ex"><span>@Qikobot</span> hi</div>
      </div>
    </section>

    <section class="card">
      <h2>Slash commands (optional)</h2>
      <div class="cmd-grid">
        <div class="cmd">
          <div class="cmd-name">/qiko-login</div>
          <div class="cmd-desc">Sign in with your Qiko email and password (modal).</div>
        </div>
        <div class="cmd">
          <div class="cmd-name">/qiko-status</div>
          <div class="cmd-desc">See if you are connected and when you linked your account.</div>
        </div>
        <div class="cmd">
          <div class="cmd-name">/qiko-workers</div>
          <div class="cmd-desc">List your ready Qiko workers (names only).</div>
        </div>
        <div class="cmd">
          <div class="cmd-name">/qiko-worker &lt;name&gt;</div>
          <div class="cmd-desc">Set the active worker, e.g. <code>Daniel Carter</code>.</div>
        </div>
        <div class="cmd">
          <div class="cmd-name">/qiko-chat &lt;message&gt;</div>
          <div class="cmd-desc">Ask your active worker a question in the current channel.</div>
        </div>
        <div class="cmd">
          <div class="cmd-name">/qiko-logout</div>
          <div class="cmd-desc">Disconnect your Qiko session on this workspace.</div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Tips</h2>
      <ul class="tips">
        <li><strong>First time only:</strong> <code>/qiko-login</code> — then use <code>@Qikobot</code> everywhere.</li>
        <li>Tables and summaries from Qiko render as proper Slack tables (not raw markdown pipes).</li>
        <li>Create or manage workers in the <a href="${qikoApp}" style="color: var(--cyan);">Qiko web app</a>; Slack chats with ready workers only.</li>
        <li>DM the Qikobot <strong>Messages</strong> tab anytime without mentioning the bot.</li>
      </ul>
    </section>

    

    <footer>
      Powered by <a href="${STAGE_SITE}">Qiko</a>
    </footer>
  </main>
</body>
</html>`;
}

/** OAuth install success page — matches landing theme; auto-redirect to Slack. */
export function renderInstallSuccessHtml(redirectUrl: string): string {
  const safeHref = esc(redirectUrl);
  const safeUrlJs = JSON.stringify(redirectUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="5;url=${safeHref}" />
  <title>Qikobot installed</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: Inter, system-ui, sans-serif; background: #05070a; color: #f1f5f9; min-height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center; padding: 24px;
      background-image: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,.35), transparent 55%); }
    .box { max-width: 480px; padding: 32px; border-radius: 16px; border: 1px solid rgba(148,163,184,.12); background: rgba(15,23,42,.55); }
    h1 { font-size: 1.5rem; margin-bottom: 12px; background: linear-gradient(135deg, #6366f1, #22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; }
    p { color: #94a3b8; line-height: 1.6; margin: 0 0 12px; }
    code { background: rgba(30,41,59,.8); padding: 2px 8px; border-radius: 6px; font-size: 0.9em; color: #e2e8f0; }
    strong { color: #f1f5f9; }
    .redirect { margin-top: 20px; padding-top: 18px; border-top: 1px solid rgba(148,163,184,.12); }
    .countdown { color: #22d3ee; font-weight: 600; }
    .btn-open {
      display: inline-block; margin-top: 14px; padding: 12px 22px; border-radius: 999px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6 42%, #22d3ee);
      color: #05070a; font-weight: 700; text-decoration: none; font-size: 0.95rem;
    }
    .btn-open:hover { opacity: 0.92; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Qikobot installed</h1>
    <p>In Slack: <strong>Apps</strong> → <strong>Qikobot</strong> → <strong>Messages</strong> tab to chat.</p>
    <p>Run <code>/qiko-login</code> once, then mention <code>@Qikobot</code> in channels (<code>/invite @Qikobot</code> first).</p>
    <p style="font-size:0.85rem">Use the same password as the Qiko web app (check for typos).</p>
    <div class="redirect">
      <p>Opening Slack in <span class="countdown" id="countdown">5</span> seconds…</p>
      <a class="btn-open" href="${safeHref}">Open Slack now</a>
    </div>
  </div>
  <script>
    (function () {
      var url = ${safeUrlJs};
      var left = 5;
      var el = document.getElementById("countdown");
      var tick = setInterval(function () {
        left -= 1;
        if (el) el.textContent = String(left);
        if (left <= 0) {
          clearInterval(tick);
          window.location.replace(url);
        }
      }, 1000);
    })();
  </script>
</body>
</html>`;
}

export function renderInstallFailureHtml(): string {
  const install = esc(installUrl());
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Install failed</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    body { font-family: Inter, system-ui, sans-serif; background: #05070a; color: #f1f5f9; min-height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .box { max-width: 480px; padding: 32px; border-radius: 16px; border: 1px solid rgba(239,68,68,.25); background: rgba(15,23,42,.55); }
    h1 { color: #fecaca; font-size: 1.35rem; margin-bottom: 12px; }
    p { color: #94a3b8; line-height: 1.6; }
    a { color: #22d3ee; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Install failed</h1>
    <p>Try again from <a href="${install}">Add to Slack</a> (do not use the OAuth redirect URL alone).</p>
  </div>
</body>
</html>`;
}
