import { NextResponse } from 'next/server';
import { requireFeedAdminAccess, recordFeedAdminFailure, requireFeedAdminMutation } from '../../_lib';
import { FEED_ALLOWED_CHANNELS, FEED_ERROR_CODE } from 'lib/feed/constants';
import { getFeedConfig, updateFeedConfig, validateFeedConfigInput } from 'lib/feed/repository';
import { recordFeedAdminAudit } from 'lib/feed/audit';
import type { FeedConfigInput } from 'lib/feed/types';
import { reportError } from 'lib/observability/report';
import { failureReason } from 'lib/errors/failure';

type ConfigBody = Partial<FeedConfigInput>;

function parseBody(body: ConfigBody): FeedConfigInput {
  return {
    renderMode: body.renderMode === 'card_toast' ? 'card_toast' : 'card_only',
    maxTimelinePageSize: Number(body.maxTimelinePageSize ?? 50),
    enabledChannels: Array.isArray(body.enabledChannels)
      ? body.enabledChannels.filter(
        (channel): channel is 'announcements' | 'questions' | 'community' => typeof channel === 'string' && FEED_ALLOWED_CHANNELS.includes(channel as 'announcements' | 'questions' | 'community'),
      )
      : undefined,
  };
}

export async function GET() {
  const gate = await requireFeedAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }

  try {
    const config = await getFeedConfig();
    return NextResponse.json({ config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_config' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: `Unable to fetch feed config: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  const audit = { command: 'feed.admin.config.update', targetType: 'feed_config', targetId: 'singleton' };
  const gate = await requireFeedAdminMutation(request, audit);
  if (!gate.allowed) {
    return gate.response;
  }

  let body: ConfigBody;
  try {
    body = (await request.json()) as ConfigBody;
  } catch (error) {
    await recordFeedAdminFailure(gate.auth.userId, audit, { status: 'allow', reason: 'invalid_payload', errorCategory: 'invalid_payload' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: `Invalid JSON body: ${failureReason(error)}` },
      { status: 400 },
    );
  }

  const input = parseBody(body);
  if (!validateFeedConfigInput(input)) {
    await recordFeedAdminFailure(gate.auth.userId, audit, { status: 'allow', reason: 'invalid_payload', errorCategory: 'invalid_payload' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.invalidPayload, message: 'Invalid feed config payload.' },
      { status: 400 },
    );
  }

  try {
    const config = await updateFeedConfig(gate.auth.userId, input);
    await recordFeedAdminAudit({
      actorId: gate.auth.userId,
      pluginId: 'feed',
      command: 'feed.admin.config.update',
      status: 'allow',
      reason: 'admin_update_allowed',
      targetType: 'feed_config',
      targetId: 'singleton',
      result: 'success',
      errorCategory: null,
      metadata: {
        enabledChannels: config.enabledChannels,
      },
    });

    return NextResponse.json({ ok: true, config }, { status: 200 });
  } catch (error) {
    reportError(error, { area: 'feed', op: 'admin_config' });
    await recordFeedAdminFailure(gate.auth.userId, audit, { status: 'allow', reason: failureReason(error), errorCategory: 'persistence_error' });
    return NextResponse.json(
      { ok: false, code: FEED_ERROR_CODE.persistenceUnavailable, message: `Unable to update feed config: ${failureReason(error)}` },
      { status: 503 },
    );
  }
}
