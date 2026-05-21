/** Short-lived login form state (password when field is hidden in modal). */

type Draft = { email?: string; password: string };

const drafts = new Map<string, string>();

function key(teamId: string, userId: string): string {
  return `${teamId}:${userId}`;
}

export function getLoginDraft(teamId: string, userId: string): Draft | null {
  const raw = drafts.get(key(teamId, userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

export function setLoginDraft(teamId: string, userId: string, draft: Draft): void {
  drafts.set(key(teamId, userId), JSON.stringify(draft));
}

export function clearLoginDraft(teamId: string, userId: string): void {
  drafts.delete(key(teamId, userId));
}
