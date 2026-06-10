// Server-only reader for the owner's Signal contact URL.
//
// CONTRIBUTIONS_OWNER_SIGNAL_URL holds the owner's Signal contact (a signal.me URL or phone
// number) shown to signed-in members on the contribution confirmation screen so they know where
// to send a gift-card code. It is managed in Infisical, is server-only (deliberately NOT prefixed
// NEXT_PUBLIC_, so it never enters the client bundle), and must never be logged.
//
// When unset or empty this returns null; the confirmation surface then falls back to the
// admin-editable signal_instructions copy, so the screen never breaks.
export function getOwnerSignalUrl(): string | null {
  const value = process.env.CONTRIBUTIONS_OWNER_SIGNAL_URL;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
