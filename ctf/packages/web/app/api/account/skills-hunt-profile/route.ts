import { NextResponse } from 'next/server';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { withDbTransaction } from 'lib/db/postgres';
import { softDeleteUserSubmissions } from 'lib/skills-hunt/moderation';
import { logSkillsHuntAudit } from 'lib/skills-hunt/audit';
import { SKILLS_HUNT_ERROR_CODE } from 'lib/skills-hunt/constants';

// GDPR soft-delete entry point for Skills Hunt.
//
// Marks every submission authored by the caller as deleted. Audit log rows
// are intentionally preserved for regulatory retention. Directory profiles
// auto-generated from accepted submissions are NOT touched here — the
// Directory plugin owns its own deletion path, and the skills_hunt_directory
// _profiles link table has ON DELETE SET NULL where appropriate.
export async function DELETE() {
  const decision = await evaluatePluginAccess({
    requireUsername: false,
    requireApprovedUserOrAdmin: false,
    allowUnlockSupportOnly: true,
  });
  if (!decision.allowed) {
    return NextResponse.json(decision, { status: decision.status });
  }

  try {
    const result = await withDbTransaction((client) => softDeleteUserSubmissions(client, decision.userId));

    logSkillsHuntAudit({
      actorId: decision.userId,
      command: 'skills-hunt.profile.delete',
      status: 'allow',
      reason: 'gdpr_self_delete',
      targetType: 'profile',
      targetId: decision.userId,
      result: 'success',
      errorCategory: null,
      metadata: { softDeletedSubmissions: result.deleted },
    });

    return NextResponse.json({ ok: true, deleted: result.deleted }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, code: SKILLS_HUNT_ERROR_CODE.persistenceUnavailable, message: 'Unable to delete profile.' },
      { status: 503 },
    );
  }
}
