import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { resolveServiceConsumer } from 'lib/auth/service-consumer';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';

// Who a taxonomy read was allowed for, so the route can audit it. A member read logs the member;
// a service read logs the consumer, because a machine is not a person and recording one as a user
// id would put a caller in the audit trail that no account matches.
export type TaxonomyReader =
  | { kind: 'member'; actorId: string; reason: 'approved_user_or_admin' }
  | { kind: 'service'; actorId: string; reason: 'approved_consumer' };

// The read gate. No `auth` on the service branch: there is no member behind a machine read, and
// a stand-in decision object would be a machine wearing somebody's account.
export type SkillsTaxonomyReadGate =
  | {
    allowed: true;
    reader: TaxonomyReader;
  }
  | {
    allowed: false;
    response: NextResponse;
  };

// A service read is for the two commands the access policy contract gives the `service` role, and
// a route only opts into it by handing this function the request. Everything else — the admin
// routes, every write — never sees the header and cannot be reached by a machine at all.
//
// Tried before the member path and falling through when it does not match, so the mobile app,
// which sends a Clerk session token on this same header, keeps working untouched.
export async function requireTaxonomyReadAccess(
  request?: Request,
): Promise<SkillsTaxonomyReadGate> {
  if (request) {
    const consumer = resolveServiceConsumer(request.headers.get('authorization'));
    if (consumer) {
      // A brake on the machine path too. The consumer caches a copy and refreshes it a few times
      // a month, so a rate this low is invisible to it and is the difference between a credential
      // that reads the taxonomy and one that can pull it in a loop.
      const limited = enforcePublicReadRateLimit(request, `skills-taxonomy-service:${consumer.name}`);
      if (limited) {
        return { allowed: false, response: limited };
      }
      return {
        allowed: true,
        reader: { kind: 'service', actorId: `service:${consumer.name}`, reason: 'approved_consumer' },
      };
    }
  }

  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return {
    allowed: true,
    reader: { kind: 'member', actorId: decision.userId, reason: 'approved_user_or_admin' },
  };
}
