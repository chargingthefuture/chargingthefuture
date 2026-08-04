import * as SecureStore from 'expo-secure-store';

/**
 * Encrypted, on-device storage for the signed-in session.
 *
 * After the OAuth sign-in completes we keep the Clerk-signed OpenID Connect
 * id_token (the bearer token), an optional refresh token, and the token's expiry
 * here so the user stays signed in across app launches. `expo-secure-store` keeps
 * the value in the device keychain/keystore rather than plain storage.
 */

const SESSION_KEY = 'ctf.auth.session.v1';

export type StoredSession = {
  /** Clerk-signed OpenID Connect id_token sent as `Authorization: Bearer`. */
  idToken: string;
  /** OAuth refresh token, when the provider issues one; null otherwise. */
  refreshToken: string | null;
  /** Epoch milliseconds when the id_token expires, or null when unknown. */
  expiresAt: number | null;
};

export async function loadStoredSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.idToken !== 'string' || parsed.idToken.length === 0) {
      return null;
    }
    return {
      idToken: parsed.idToken,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null,
    };
  } catch {
    return null;
  }
}

export async function saveStoredSession(session: StoredSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } catch {
    // no-trace: a failed write only means the member signs in again next launch
  }
}

export async function clearStoredSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // no-trace: clearing a session that is already gone is the same outcome
  }
}
