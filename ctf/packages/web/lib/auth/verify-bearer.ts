import { verifyToken } from '@clerk/backend';
import { getClerkSecretKey } from './clerk-env';

/**
 * Verified identity resolved from an external `Authorization: Bearer <token>`
 * request (e.g. the mobile app). This is the ONLY trusted source of identity for
 * a request that did not come through the web Clerk middleware — spoofable
 * `x-ctf-user-*` headers are never trusted on this path.
 */
export type VerifiedBearerIdentity = {
  userId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function claimString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Pulls the raw bearer token out of an `Authorization` header value.
 * Returns null for anything that is not a non-empty `Bearer <token>`.
 */
export function extractBearerToken(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Cryptographically verifies a raw Clerk session token with Clerk's server SDK
 * (`@clerk/backend`'s `verifyToken`). Verification is networkless: it checks the
 * JWT signature against Clerk's keys using the configured secret key
 * (`AUTH_SECRET_KEY`). Returns the verified identity, or null when the token is
 * missing/invalid/expired or no secret key is configured.
 *
 * Username/role come from the verified token claims (populated via the Clerk
 * dashboard's "Customize session token" the same way the web middleware reads
 * them) — never from request headers.
 */
export async function verifyClerkSessionToken(
  token: string | null | undefined,
): Promise<VerifiedBearerIdentity | null> {
  if (!token || token.trim().length === 0) return null;

  const secretKey = getClerkSecretKey();
  if (!secretKey) return null;

  let claims: Record<string, unknown>;
  try {
    claims = (await verifyToken(token.trim(), { secretKey })) as unknown as Record<string, unknown>;
  } catch {
    return null;
  }

  return buildBearerIdentity(claims);
}

// Read one claim, preferring the top-level value and falling back to the same key under metadata.
// Kept as a helper so each field costs the caller no branch complexity.
function pickClaim(claims: Record<string, unknown>, metadata: Record<string, unknown> | undefined, key: string): string | null {
  return claimString(claims[key]) ?? claimString(metadata?.[key]);
}

// Map verified token claims into the identity, or null when there is no subject. Username/role/name
// come from the verified claims (top-level or under metadata) — never from request headers.
function buildBearerIdentity(claims: Record<string, unknown>): VerifiedBearerIdentity | null {
  const userId = claimString(claims.sub);
  if (!userId) return null;

  const metadata = asRecord(claims.metadata) ?? asRecord(claims.public_metadata);

  return {
    userId,
    username: pickClaim(claims, metadata, 'username'),
    firstName: pickClaim(claims, metadata, 'first_name'),
    lastName: pickClaim(claims, metadata, 'last_name'),
    role: pickClaim(claims, metadata, 'role')?.toLowerCase() ?? null,
  };
}

/**
 * Verifies an `Authorization: Bearer <token>` header value. Thin wrapper over
 * {@link verifyClerkSessionToken} that first pulls the token out of the header.
 */
export async function verifyBearerIdentity(
  authorization: string | null | undefined,
): Promise<VerifiedBearerIdentity | null> {
  return verifyClerkSessionToken(extractBearerToken(authorization));
}
