import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { SKILLS_TAXONOMY_ERROR_CODE } from 'lib/skills-taxonomy/constants';
import { ensureTaxonomyAdmin } from 'lib/skills-taxonomy/policy';
import type { TaxonomyReader } from 'lib/skills-taxonomy/read-gate';
import { checkMutationOrigin } from 'lib/auth/csrf';

// The admin gate. Always a person, always an admin, and never reachable by a machine: these
// routes write the taxonomy, and nothing but the owner writes it.
export type SkillsTaxonomyApiGate =
  | {
    allowed: true;
    auth: AllowDecision;
    reader: TaxonomyReader;
  }
  | {
    allowed: false;
    response: NextResponse;
  };

// The read gate lives in lib/ so it can be tested: a machine reading the taxonomy is the only
// caller in this app that is not a person, and that branch is worth driving directly.
export { requireTaxonomyReadAccess } from 'lib/skills-taxonomy/read-gate';
export type { SkillsTaxonomyReadGate, TaxonomyReader } from 'lib/skills-taxonomy/read-gate';

export async function requireTaxonomyAdminAccess(): Promise<SkillsTaxonomyApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  const denyDecision = ensureTaxonomyAdmin(decision);
  if (denyDecision) {
    return {
      allowed: false,
      response: NextResponse.json(denyDecision, { status: denyDecision.status }),
    };
  }

  return {
    allowed: true,
    auth: decision,
    reader: { kind: 'member', actorId: decision.userId, reason: 'approved_user_or_admin' },
  };
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  const csrfHeader = request.headers.get('x-ctf-csrf');
  if (csrfHeader !== '1') {
    return NextResponse.json(
      {
        ok: false,
        code: SKILLS_TAXONOMY_ERROR_CODE.csrfDenied,
        message: 'Missing CSRF confirmation header.',
      },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      {
        ok: false,
        code: SKILLS_TAXONOMY_ERROR_CODE.csrfDenied,
        message: 'Invalid request origin metadata.',
      },
      { status: 403 },
    );
  }

  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      {
        ok: false,
        code: SKILLS_TAXONOMY_ERROR_CODE.csrfDenied,
        message: 'Cross-origin mutation denied by CSRF policy.',
      },
      { status: 403 },
    );
  }

  return null;
}
