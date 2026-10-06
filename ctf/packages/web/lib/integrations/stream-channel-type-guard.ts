import type { StreamChat } from 'stream-chat';
import { reportError } from 'lib/observability/report';

// Keeps a Stream channel-type setting that refuses every send turned off, through the Stream API.
//
// "Mark Messages Pending" on a channel type, on a Stream app without the pending-messages feature,
// makes Stream answer every send with "pending messages not enabled for this app" — the chat looks
// open and nothing posts (owner report, Beacon event chat). It is a setting on the Stream side, so
// the app reads it back before handing out chat credentials and turns it off when it finds it on,
// rather than relying on somebody to find the toggle in the Stream dashboard.

const BLOCKING_SETTING = 'mark_messages_pending';

// How long a clean read is trusted before the setting is read again. The read is one call per
// channel type per server process per hour, not one per member joining a chat.
const RECHECK_MS = 60 * 60 * 1000;

const lastCleanAt = new Map<string, number>();

type ChannelTypeClient = Pick<StreamChat, 'getChannelType' | 'updateChannelType'>;

// Turns the blocking setting off for `channelType` when it is on. Never throws: a failure is reported
// and the caller carries on, because a failed read must not be the reason chat credentials are not
// issued. Returns true when the setting is known to be off afterwards.
export async function ensureChannelTypeAcceptsSends(
  client: ChannelTypeClient,
  apiKey: string,
  channelType: string,
  now: number = Date.now(),
): Promise<boolean> {
  const cacheKey = `${apiKey}:${channelType}`;
  const cleanAt = lastCleanAt.get(cacheKey);
  if (cleanAt !== undefined && now - cleanAt < RECHECK_MS) {
    return true;
  }
  try {
    const config = (await client.getChannelType(channelType)) as unknown as Record<string, unknown>;
    if (config[BLOCKING_SETTING] === true) {
      await client.updateChannelType(channelType, { [BLOCKING_SETTING]: false });
      reportError(new Error(`Stream channel type "${channelType}" had ${BLOCKING_SETTING} on; turned it off.`), {
        area: 'stream',
        op: 'channel_type_pending_fixed',
        extra: { channelType },
      });
    }
    lastCleanAt.set(cacheKey, now);
    return true;
  } catch (error) {
    reportError(error, { area: 'stream', op: 'channel_type_pending_check', extra: { channelType } });
    return false;
  }
}

// Test-only: forget every clean read.
export function resetChannelTypeGuardForTests(): void {
  lastCleanAt.clear();
}
