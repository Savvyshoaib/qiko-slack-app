/** In-memory password while toggling visibility in the login modal (Slack has no password input type). */

type Draft = { email: string; password: string };

const drafts = new Map<string, Draft>();

function key(teamId: string, userId: string): string {
  return `${teamId}:${userId}`;
}

export function setLoginDraft(teamId: string, userId: string, draft: Draft): void {
  drafts.set(key(teamId, userId), draft);
}

export function getLoginDraft(teamId: string, userId: string): Draft | undefined {
  return drafts.get(key(teamId, userId));
}

export function clearLoginDraft(teamId: string, userId: string): void {
  drafts.delete(key(teamId, userId));
}
