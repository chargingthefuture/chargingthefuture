import { randomUUID } from 'node:crypto';
import { StreamClient } from '@stream-io/node-sdk';
import { NextResponse } from 'next/server';
import { reportError } from 'lib/observability/report';
import { resolveStreamCredentials } from './stream-credentials';

// Stream AI moderation on public posts (3.1.0 plan, Personal controls and safety). The words of a
// post are sent to Stream's moderation check with the config key se:posts, whose rules are set by
// .github/workflows/stream-moderation-setup.yml: harm Stream rates critical is refused, high is
// flagged in Stream's review queue and still published. Pictures are not sent: they are stored in
// the app's database and need a sign-in to read, so Stream cannot fetch them.
//
// A post is refused only when Stream answers remove. When Stream is not set up, refuses the call or
// cannot be reached, the post goes through and the failure is reported, because a member's post
// must not depend on an outside service being up.

export const STREAM_POSTS_CONFIG_KEY = 'se:posts';

export type ContentCheckInput = {
  // What is being posted, for Stream's review queue: 'socket-relay-ask', 'commons-post', ...
  entityType: string;
  creatorAccountId: string;
  texts: string[];
};

export async function isRefusedByStream(input: ContentCheckInput): Promise<boolean> {
  const texts = input.texts.map((text) => text.trim()).filter((text) => text.length > 0);
  if (texts.length === 0) return false;
  const credentials = await resolveStreamCredentials();
  if (!credentials) return false;
  try {
    const client = new StreamClient(credentials.apiKey, credentials.apiSecret);
    const res = await client.moderation.check({
      entity_type: input.entityType,
      entity_id: randomUUID(),
      entity_creator_id: input.creatorAccountId,
      config_key: STREAM_POSTS_CONFIG_KEY,
      moderation_payload: { texts },
    });
    return res.recommended_action === 'remove';
  } catch (error) {
    reportError(error, { area: 'moderation', op: 'stream_content_check', extra: { entityType: input.entityType } });
    return false;
  }
}

export const CONTENT_REFUSED_MESSAGE =
  'This was not posted: the automatic check found something harmful in it. Reword it and try again, or report a mistake through bug reporting.';

// The answer a route gives when Stream refuses a post.
export function contentRefusedResponse(): NextResponse {
  return NextResponse.json({ ok: false, code: 'content_refused', message: CONTENT_REFUSED_MESSAGE }, { status: 422 });
}
