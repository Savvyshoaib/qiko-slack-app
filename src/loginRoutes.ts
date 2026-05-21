import type { ExpressReceiver } from "@slack/bolt";
import express from "express";
import { loginToQiko } from "./qikoClient.js";
import { verifyLoginToken } from "./loginToken.js";
import { renderLoginPage, renderLoginSuccessPage } from "./slackLoginPage.js";
import { setSession } from "./userSessions.js";

export function attachLoginRoutes(receiver: ExpressReceiver): void {
  const urlencoded = express.urlencoded({ extended: true });

  receiver.router.get("/slack/login", (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token || !verifyLoginToken(token)) {
      res.status(400).send("Invalid or expired sign-in link. Run `/qiko-login` again in Slack.");
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(renderLoginPage(token));
  });

  receiver.router.post("/slack/login", urlencoded, async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const identity = verifyLoginToken(token);
    if (!identity) {
      res.status(400).send("Session expired. Run `/qiko-login` in Slack again.");
      return;
    }

    if (!email || !password) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderLoginPage(token, "Email and password are required."));
      return;
    }

    try {
      const result = await loginToQiko({ email, password });
      const qikoToken = result.data!.token!;
      const user = result.data?.user ?? null;

      setSession(identity.teamId, identity.userId, {
        token: qikoToken,
        user,
        email: user?.email ?? email,
      });

      const displayName = user?.user_name || user?.name || user?.email || email;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderLoginSuccessPage(displayName));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderLoginPage(token, message));
    }
  });
}
