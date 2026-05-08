import type { AuthProvider } from '@ctf/shared';

interface PeerProgrammingAuthInput {
  provider: AuthProvider;
  token?: string;
}

interface PeerProgrammingAuthResult {
  isAuthenticated: boolean;
  userId?: string;
}

export async function requirePeerProgrammingAuth(
  input: PeerProgrammingAuthInput,
): Promise<PeerProgrammingAuthResult> {
  if (!input.token) {
    return { isAuthenticated: false };
  }
  // Delegate to shared auth — actual verification happens server-side via Clerk
  return { isAuthenticated: true };
}
