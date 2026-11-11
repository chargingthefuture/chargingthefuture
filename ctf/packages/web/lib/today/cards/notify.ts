import { hasMutedPost } from 'lib/mutes/repository';
import { notifySafe } from 'lib/notifications/repository';
import type { NotificationInput } from 'lib/notifications/types';
import { reportError } from 'lib/observability/report';

// Tell a member in Activity about something on a Today card's conversation (a Just us two request
// or message), unless they muted that card. Nobody is told that the notice was held back. Best
// effort like notifySafe: when the mute list cannot be read, the notice goes out rather than the
// message or request that was already saved failing.
async function mutedCard(userId: string, cardId: string): Promise<boolean> {
  try {
    return await hasMutedPost(userId, cardId);
  } catch (error) {
    reportError(error, { area: 'today-cards', op: 'read_post_mute' });
    return false;
  }
}

export async function notifyOnCard(cardId: string, input: NotificationInput): Promise<boolean> {
  if (await mutedCard(input.userId, cardId)) return false;
  await notifySafe(input);
  return true;
}
