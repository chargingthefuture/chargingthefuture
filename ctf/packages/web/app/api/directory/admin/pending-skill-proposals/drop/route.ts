import { NextResponse } from 'next/server';
import { ensureMutationCsrf, requireDirectoryAdminAccess } from '../../../_lib';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import {
  dropDirectoryPendingSkillProposal,
  isDirectoryPendingSkillSource,
  type DirectoryPendingSkillSource,
} from 'lib/directory/pending-skill-proposals';
import { recordDirectoryAdminAudit } from 'lib/directory/audit';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

const COMMAND = 'directory.admin.pending_skill_proposal.drop';

type DropBody = {
  profileId: string;
  skillLabel: string;
  source: DirectoryPendingSkillSource;
};

function readBody(raw: unknown): DropBody | string {
  if (typeof raw !== 'object' || raw === null) {
    return 'The body must be a JSON object with profileId, skillLabel and source.';
  }
  const body = raw as Record<string, unknown>;
  const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : '';
  const skillLabel = typeof body.skillLabel === 'string' ? body.skillLabel.trim() : '';
  const source = body.source;
  if (profileId.length === 0) {
    return 'profileId is required.';
  }
  if (skillLabel.length === 0) {
    return 'skillLabel is required.';
  }
  if (!isDirectoryPendingSkillSource(source)) {
    return "source must be 'skills-hunt' or 'directory'.";
  }
  return { profileId, skillLabel, source };
}

// Drop one pending free-text skill from one profile after the owner decided not to promote it. The
// chip disappears from the profile; the decision itself stays recorded in the audit trail, with the
// state the row was in before.
export async function POST(request: Request) {
  const gate = await requireDirectoryAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  const csrfDeny = ensureMutationCsrf(request);
  if (csrfDeny) {
    return csrfDeny;
  }

  let body: DropBody;
  try {
    const parsed = readBody(await request.json());
    if (typeof parsed === 'string') {
      return NextResponse.json(
        { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: parsed },
        { status: 400 },
      );
    }
    body = parsed;
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: DIRECTORY_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const targetId = `${body.profileId}:${body.source}:${body.skillLabel.toLowerCase()}`;

  try {
    const result = await dropDirectoryPendingSkillProposal(body);

    if (result.outcome === 'dropped') {
      await recordDirectoryAdminAudit({
        actorId: gate.auth.userId,
        command: COMMAND,
        status: 'allow',
        reason: 'not_promoted',
        targetType: 'pending_skill_proposal',
        targetId,
        result: 'success',
        errorCategory: null,
        metadata: {
          profileId: body.profileId,
          skillLabel: body.skillLabel,
          source: body.source,
          before: result.before,
          after: result.after,
        },
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await recordDirectoryAdminAudit({
      actorId: gate.auth.userId,
      command: COMMAND,
      status: 'deny',
      reason: 'not_found',
      targetType: 'pending_skill_proposal',
      targetId,
      result: 'failure',
      errorCategory: 'not_found',
      metadata: { profileId: body.profileId, skillLabel: body.skillLabel, source: body.source },
    });
    return NextResponse.json(
      {
        ok: false,
        code: DIRECTORY_ERROR_CODE.notFound,
        message: `No pending "${body.skillLabel}" proposal from ${body.source} is on that profile any more; it may already have been dropped or promoted.`,
      },
      { status: 404 },
    );
  } catch (error) {
    reportError(error, { area: 'directory', op: 'admin_pending_skill_proposal_drop' });
    return NextResponse.json(
      {
        ok: false,
        code: DIRECTORY_ERROR_CODE.persistenceUnavailable,
        message: `Unable to drop the proposal: ${failureReason(error)}`,
      },
      { status: 503 },
    );
  }
}
