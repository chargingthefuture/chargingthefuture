import { timingSafeEqual } from 'crypto';
import { extractBearerToken } from './verify-bearer';

/**
 * A machine caller, not a person.
 *
 * Every other identity in this app is a member: a Clerk user with an Unlock tier and an account
 * that can be restricted. A service consumer has none of those, which is why it cannot be fitted
 * into `evaluatePluginAccess` — that function's job is to answer questions about a person, and a
 * machine is not one.
 *
 * Exactly one consumer exists and the exclusivity is the owner's decision, not an accident of
 * this file: One Percent, the paid tier, reads the Skills Taxonomy so its peer graph speaks the
 * same vocabulary the app does, and reads claimed Directory profiles by id for the owner's desk. Both products are run and paid for
 * by one person, so this is one operator wiring two of their own things together rather than a
 * service offered to anybody. See the "One Percent reads the skills taxonomy, and nothing else"
 * section of the repository's CLAUDE.md before adding a second entry — that is an owner decision.
 *
 * It takes nothing away from anybody. Every approved member already has this data, free, at
 * /apps/skills-taxonomy. This is a machine-readable way to the same thing.
 */
/**
 * Which credential list a route checks. Each read has its own, so either can be revoked without
 * the other: `TAXONOMY_SERVICE_TOKENS` for the two Skills Taxonomy reads, and
 * `DIRECTORY_SERVICE_TOKENS` for the claimed-profile read (owner decision, 2026-10-02; see the
 * "One Percent is the paid tier" section of CLAUDE.md). A token from one list never opens the
 * other's route.
 */
export type ServiceTokenSetting = 'TAXONOMY_SERVICE_TOKENS' | 'DIRECTORY_SERVICE_TOKENS';

export type ServiceConsumer = {
  /** The consumer's name, which is also its audit actor. */
  name: string;
};

/**
 * The configured consumers, read from the named setting.
 *
 * One entry per consumer, `name:secret`, separated by commas. Empty or unset means no machine
 * may read anything, which is the correct state for an environment that has not been given a
 * credential — and the reason this setting is optional rather than required. A product that
 * cannot serve a page without it would be a product one integration can take down.
 *
 * The credential is this app's to issue and to revoke: removing an entry revokes it, and that
 * is a settings change the owner can make from a phone. Never copied from One Percent's own
 * secrets store, which is a separate Infisical project for exactly this reason.
 */
function configuredConsumers(setting: ServiceTokenSetting): Map<string, string> {
  const raw = process.env[setting]?.trim();
  const consumers = new Map<string, string>();
  if (!raw) return consumers;

  for (const entry of raw.split(',')) {
    const at = entry.indexOf(':');
    if (at <= 0) continue;
    const name = entry.slice(0, at).trim();
    const secret = entry.slice(at + 1).trim();
    if (name && secret) consumers.set(name, secret);
  }
  return consumers;
}

/** Constant time, so a wrong secret takes as long to reject as a nearly-right one. */
function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The consumer behind an `Authorization: Bearer <name>.<secret>` header, or null.
 *
 * The name travels inside the token rather than in a header of its own, so a valid secret
 * presented under the wrong name does not authenticate. That is what the access policy
 * contract's `approved_consumers_only` scope and its `unauthorized_consumer_binding` deny
 * condition mean: a credential is bound to one consumer, not merely valid.
 *
 * Null for anything that is not a service token at all, including a Clerk session token, so a
 * caller that fails here falls through to the member path untouched. The mobile app sends a
 * Clerk token on this same header and must keep working.
 */
export function resolveServiceConsumer(
  authorization: string | null | undefined,
  setting: ServiceTokenSetting = 'TAXONOMY_SERVICE_TOKENS',
): ServiceConsumer | null {
  const token = extractBearerToken(authorization);
  if (!token) return null;

  const at = token.indexOf('.');
  if (at <= 0) return null;
  const name = token.slice(0, at);
  const secret = token.slice(at + 1);
  if (!name || !secret) return null;

  const expected = configuredConsumers(setting).get(name);
  if (!expected) return null;

  return sameSecret(secret, expected) ? { name } : null;
}
