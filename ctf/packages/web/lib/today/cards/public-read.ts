import { SE_GUEST_SHEET_SOURCES, type SeGuestConversation } from '@ctf/shared';
import { runWithForcedPool } from 'lib/db/postgres';
import { listCardThreadMessages } from 'lib/fireside/card-thread';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { listGuestMessagesInStore, type MessageRow } from './repository';
import { handleOf } from './shape';
import { storyPostFor } from './story';

// A card opened on signed-out Today (owner decision, 2026-11-10). A story shows its post's Fireside
// comments: those are public on the blog already, and only an approved author's are shown. The
// sample ask and offer cards show their conversation from the demo schema, marked as sample. Just
// us two is never read here. Any other card is not opened.

export function guestOpens(cardId: string): boolean {
  return SE_GUEST_SHEET_SOURCES.includes(cardId.slice(0, cardId.indexOf(':')));
}

async function shape(rows: MessageRow[], sample: boolean): Promise<SeGuestConversation> {
  const handles = sample ? new Map<string, string | null>() : await resolveUsernames(rows.map((row) => row.authorId));
  return {
    sample,
    messages: rows.map((row) => ({
      id: row.id,
      handle: handleOf(handles, row.authorId),
      body: row.body,
      createdAtIso: row.createdAt.toISOString(),
      editedAtIso: row.editedAt ? row.editedAt.toISOString() : null,
    })),
  };
}

export async function readGuestConversation(cardId: string): Promise<SeGuestConversation> {
  const story = await storyPostFor(cardId);
  if (story) {
    const messages = await listCardThreadMessages(story.post, null);
    return shape(messages.map((m) => ({ ...m, pairLow: null, pairHigh: null })), false);
  }
  return shape(await runWithForcedPool('demo', () => listGuestMessagesInStore(cardId)), true);
}
