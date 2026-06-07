import * as SecureStore from 'expo-secure-store';

/**
 * Token cache for Clerk on native.
 *
 * Clerk stores the session token here so the user stays signed in across app
 * launches. `expo-secure-store` keeps it in the device keychain/keystore rather
 * than plain storage. This is the standard Clerk Expo token cache.
 */
export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore: a failed cache write only means the user re-authenticates later
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};
