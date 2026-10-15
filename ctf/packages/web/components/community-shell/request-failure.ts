// The sentence a failed Commons request shows. A route that explains itself sends `message`, and that
// wins. The access gates (lib/auth/deny-taxonomy.ts) send `{ code, reason }` with no `message`, so
// their reasons are turned into plain sentences here; before this, an expired session, a member not
// yet approved and a restricted account all read "Request failed." with nothing to act on. Anything
// else names the HTTP status, so an unmapped refusal still says what happened.

const DENY_REASON_TEXT: Record<string, string> = {
  no_active_session: 'You are signed out. Sign in again.',
  unlock_required: 'This needs Unlock approval first.',
  account_restricted: 'Your account is restricted, so this is not available.',
  missing_username: 'Choose a username in your account first.',
};

export function failedRequestText(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const body = payload as { message?: unknown; reason?: unknown };
    if (typeof body.message === 'string' && body.message.trim().length > 0) {
      return body.message;
    }
    if (typeof body.reason === 'string' && DENY_REASON_TEXT[body.reason]) {
      return DENY_REASON_TEXT[body.reason];
    }
  }
  return `Request failed (HTTP ${status}).`;
}
