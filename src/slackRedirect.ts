import type { Installation } from "@slack/bolt";
import { WebClient } from "@slack/web-api";

/** Slack web client URL for a workspace (optional channel / DM). */
export function slackClientUrl(teamId: string, channelId?: string): string {
  const team = encodeURIComponent(teamId);
  if (channelId) {
    return `https://app.slack.com/client/${team}/${encodeURIComponent(channelId)}`;
  }
  return `https://app.slack.com/client/${team}`;
}

/** Resolve redirect after OAuth — opens installer DM with Qikobot when possible. */
export async function resolvePostInstallRedirectUrl(
  installation: Installation
): Promise<string> {
  const teamId = installation.team?.id;
  if (!teamId) {
    return "https://slack.com/get-started";
  }

  const botToken = installation.bot?.token;
  const userId = installation.user?.id;

  if (botToken && userId) {
    try {
      const client = new WebClient(botToken);
      const opened = await client.conversations.open({ users: userId });
      const channelId = opened.channel?.id;
      if (channelId) {
        return slackClientUrl(teamId, channelId);
      }
    } catch (error) {
      console.warn("Post-install DM open failed, using workspace redirect:", error);
    }
  }

  return slackClientUrl(teamId);
}
