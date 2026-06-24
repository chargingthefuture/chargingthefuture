import type { AuthProvider } from '@ctf/shared';
import { verifyClerkSessionToken } from 'lib/auth/verify-bearer';

interface PeerProgrammingAuthInput {
  provider: AuthProvider;
  token?: string;
}

interface PeerProgrammingAuthResult {
  isAuthenticated: boolean;
  userId?: string;
}

/**
 * Authenticate a PeerProgramming API request.
 *
 * For the Clerk provider, the bearer token is verified cryptographically with
 * Clerk's server SDK (see lib/auth/verify-bearer). A token that fails
 * verification — or any non-Clerk provider, which is not yet supported — is
 * rejected. This must NOT trust a token just because it is present.
 */
export async function requirePeerProgrammingAuth(
  input: PeerProgrammingAuthInput,
): Promise<PeerProgrammingAuthResult> {
  if (!input.token) {
    return { isAuthenticated: false };
  }
  if (input.provider !== 'clerk') {
    return { isAuthenticated: false };
  }
  const verified = await verifyClerkSessionToken(input.token);
  if (!verified) {
    return { isAuthenticated: false };
  }
  return { isAuthenticated: true, userId: verified.userId };
}
