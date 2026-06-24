import { StreamChat } from 'stream-chat';
import { resolveStreamCredentials } from 'lib/integrations/stream-credentials';

// Live video session credentials for a PeerProgramming cohort. The cohort room is
// async-first text; the Session tab adds an optional live video call for the same
// cohort, using the shared GetStream (Stream) account like Chyme and Lighthouse.
//
// One call per cohort: the call id is derived from the cohort id so every member of a
// cohort joins the same call, and members of other cohorts cannot. A Stream token is
// minted server-side with the Stream secret and works for both chat and video, so the
// browser/app never sees the secret.
export type PeerProgrammingVideoCredentials = {
  streamApiKey: string;
  streamCallId: string;
  streamUserId: string;
  streamToken: string;
};

// Stream call ids accept [0-9a-zA-Z_-]; cohort ids are UUIDs, so they are already safe,
// but coerce defensively so an unexpected value can never produce an invalid id.
function toCallId(cohortId: string): string {
  const cleaned = `pp-${cohortId}`.replace(/[^0-9a-zA-Z_-]/g, '-');
  return cleaned.length > 0 ? cleaned : 'pp-cohort';
}

function toStreamUserId(userId: string): string {
  return `pp-${userId}`;
}

export async function createPeerProgrammingVideoCredentials(input: {
  userId: string;
  name: string;
  cohortId: string;
}): Promise<PeerProgrammingVideoCredentials | null> {
  const streamConfig = await resolveStreamCredentials();
  if (!streamConfig) {
    return null;
  }

  const streamClient = new StreamChat(streamConfig.apiKey, streamConfig.apiSecret);
  try {
    const streamUserId = toStreamUserId(input.userId);
    await streamClient.upsertUser({ id: streamUserId, name: input.name });

    return {
      streamApiKey: streamConfig.apiKey,
      streamCallId: toCallId(input.cohortId),
      streamUserId,
      streamToken: streamClient.createToken(streamUserId),
    };
  } finally {
    await streamClient.disconnectUser();
  }
}
