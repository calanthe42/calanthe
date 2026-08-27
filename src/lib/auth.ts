/** Mock auth session (UI only — replaced by the backend phase). */

const AUTH_STORAGE_KEY = "calanthe-auth-v1";

export type AuthSession = { phone: string };

export function readAuth(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { phone?: unknown }).phone === "string"
    ) {
      return parsed as AuthSession;
    }
    return null;
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable (e.g. private browsing). */
export function writeAuth(session: AuthSession): boolean {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
