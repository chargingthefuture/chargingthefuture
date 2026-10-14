import { createClerkClient, verifyToken } from '@clerk/backend';
import { getClerkSecretKey } from './clerk-env';
import { reportError } from 'lib/observability/report';

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

  const identity = buildBearerIdentity(claims);
  if (!identity || (identity.username && identity.role)) return identity;
  return fillFromClerkAccount(identity, secretKey);
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
    // `preferred_username`, `given_name` and `family_name` are the names the Android app's sign-in
    // token (Clerk's OAuth id_token) uses; the web session token uses the customized names.
    username: pickClaim(claims, metadata, 'username') ?? claimString(claims.preferred_username),
    firstName: pickClaim(claims, metadata, 'first_name') ?? claimString(claims.given_name),
    lastName: pickClaim(claims, metadata, 'last_name') ?? claimString(claims.family_name),
    role: pickClaim(claims, metadata, 'role')?.toLowerCase() ?? null,
  };
}

type AccountFields = Pick<VerifiedBearerIdentity, 'username' | 'firstName' | 'lastName' | 'role'>;

// How long one account's Clerk record is reused, so a screen's burst of requests costs one lookup.
// A role change reaches the Android app within this window.
const ACCOUNT_CACHE_MS = 5 * 60 * 1000;
const accountCache = new Map<string, { fields: AccountFields; expiresAt: number }>();

async function readClerkAccount(userId: string, secretKey: string): Promise<AccountFields | null> {
  const cached = accountCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.fields;
  try {
    const user = await createClerkClient({ secretKey }).users.getUser(userId);
    const metadata = asRecord(user.publicMetadata);
    const fields: AccountFields = {
      username: claimString(user.username),
      firstName: claimString(user.firstName),
      lastName: claimString(user.lastName),
      role: claimString(metadata?.role)?.toLowerCase() ?? null,
    };
    accountCache.set(userId, { fields, expiresAt: Date.now() + ACCOUNT_CACHE_MS });
    return fields;
  } catch (caught) {
    // The token is already verified, so the request goes on with what the token carried. A failed
    // lookup is not cached: remembering it would treat an admin as a member for the next five minutes.
    reportError(caught, { area: 'auth', op: 'bearer_account_lookup' });
    return null;
  }
}

// The Android app signs in through Clerk's OAuth flow, and that id_token carries neither the role nor
// the username the web session token is customized to carry. Without them an admin is treated as a
// member and every handle falls back to a short id, so the verified subject's own Clerk account
// supplies whatever the token left out. Only the subject's own record is read, and token values win.
async function fillFromClerkAccount(identity: VerifiedBearerIdentity, secretKey: string): Promise<VerifiedBearerIdentity> {
  const account = await readClerkAccount(identity.userId, secretKey);
  if (!account) return identity;
  return {
    userId: identity.userId,
    username: identity.username ?? account.username,
    firstName: identity.firstName ?? account.firstName,
    lastName: identity.lastName ?? account.lastName,
    role: identity.role ?? account.role,
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
