import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { ensureSkillsHuntAdmin, ensureSkillsHuntModeratorOrAdmin } from 'lib/skills-hunt/policy';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';

export type SkillsHuntApiGate =
  | {
    allowed: true;
    auth: AllowDecision;
  }
  | {
    allowed: false;
    response: NextResponse;
  };

export async function requireSkillsHuntReadAccess(): Promise<SkillsHuntApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return {
    allowed: true,
    auth: decision,
  };
}

export async function requireSkillsHuntSubmitAccess(): Promise<SkillsHuntApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: true });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  return {
    allowed: true,
    auth: decision,
  };
}

export async function requireSkillsHuntModeratorAccess(): Promise<SkillsHuntApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  const deny = ensureSkillsHuntModeratorOrAdmin(decision);
  if (deny) {
    return {
      allowed: false,
      response: NextResponse.json(deny, { status: deny.status }),
    };
  }

  return {
    allowed: true,
    auth: decision,
  };
}

export async function requireSkillsHuntAdminAccess(): Promise<SkillsHuntApiGate> {
  const decision = await evaluatePluginAccess({ requireUsername: false });
  if (!decision.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(decision, { status: decision.status }),
    };
  }

  const deny = ensureSkillsHuntAdmin(decision);
  if (deny) {
    return {
      allowed: false,
      response: NextResponse.json(deny, { status: deny.status }),
    };
  }

  return {
    allowed: true,
    auth: decision,
  };
}

export function ensureMutationCsrf(request: Request): NextResponse | null {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  if (request.headers.get('x-ctf-csrf') !== '1') {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.csrfDenied, message: 'Missing CSRF confirmation header.' },
      { status: 403 },
    );
  }

  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.csrfDenied, message: 'Invalid request origin metadata.' },
      { status: 403 },
    );
  }

  if (originCheck === 'cross_origin') {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.csrfDenied, message: 'Cross-origin mutation denied by CSRF policy.' },
      { status: 403 },
    );
  }

  return null;
}
