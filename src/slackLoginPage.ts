function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderLoginPage(token: string, error?: string): string {
  const errBlock = error
    ? `<p class="error">${esc(error)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in — Qiko</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(160deg, #f3efff 0%, #ebe6ff 50%, #f8f6ff 100%);
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 400px;
      background: #fff;
      border-radius: 20px;
      padding: 36px 32px 32px;
      box-shadow: 0 8px 40px rgba(99, 102, 241, 0.12);
    }
    h1 {
      text-align: center;
      font-size: 1.35rem;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 28px;
    }
    label {
      display: block;
      font-size: 0.9rem;
      font-weight: 500;
      color: #334155;
      margin-bottom: 8px;
    }
    .field { margin-bottom: 20px; }
    input[type="email"],
    input[type="password"],
    input[type="text"] {
      width: 100%;
      padding: 14px 48px 14px 18px;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      font-size: 1rem;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input[type="email"] { padding-right: 18px; }
    input:focus {
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
    }
    .password-wrap { position: relative; }
    .toggle-eye {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      width: 36px;
      height: 36px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }
    .toggle-eye:hover { color: #6366f1; background: #f1f5f9; }
    .toggle-eye svg { width: 20px; height: 20px; }
    button[type="submit"] {
      width: 100%;
      margin-top: 8px;
      padding: 14px;
      border: none;
      border-radius: 999px;
      background: linear-gradient(135deg, #7c3aed, #6366f1);
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    button[type="submit"]:hover { opacity: 0.95; }
    .error {
      color: #dc2626;
      font-size: 0.88rem;
      margin-bottom: 16px;
      text-align: center;
    }
    .hint {
      margin-top: 16px;
      font-size: 0.8rem;
      color: #64748b;
      text-align: center;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in</h1>
    ${errBlock}
    <form method="post" action="/slack/login">
      <input type="hidden" name="token" value="${esc(token)}" />
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" placeholder="name@example.com" required />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <div class="password-wrap">
          <input id="password" name="password" type="password" autocomplete="current-password" placeholder="Your Qiko password" required />
          <button type="button" class="toggle-eye" id="toggle-eye" aria-label="Show password" title="Show password">
            <svg id="icon-eye" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <svg id="icon-eye-off" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="display:none">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          </button>
        </div>
      </div>
      <button type="submit">Sign in</button>
    </form>
    <p class="hint">Same credentials as the Qiko web app. You can close this tab after signing in.</p>
  </div>
  <script>
    (function () {
      var input = document.getElementById("password");
      var btn = document.getElementById("toggle-eye");
      var eye = document.getElementById("icon-eye");
      var eyeOff = document.getElementById("icon-eye-off");
      btn.addEventListener("click", function () {
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        eye.style.display = show ? "none" : "block";
        eyeOff.style.display = show ? "block" : "none";
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
        btn.setAttribute("title", show ? "Hide password" : "Show password");
      });
    })();
  </script>
</body>
</html>`;
}

export function renderLoginSuccessPage(displayName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Signed in — Qiko</title>
  <style>
    body { font-family: system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(160deg, #f3efff, #ebe6ff); padding: 24px; }
    .card { max-width: 400px; background: #fff; border-radius: 20px; padding: 32px; text-align: center; box-shadow: 0 8px 40px rgba(99,102,241,.12); }
    h1 { color: #6366f1; font-size: 1.25rem; margin-bottom: 12px; }
    p { color: #475569; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Signed in</h1>
    <p>Connected as <strong>${esc(displayName)}</strong>.</p>
    <p style="margin-top:12px">Return to Slack and open <strong>Qikobot</strong> to continue.</p>
  </div>
</body>
</html>`;
}
