import type { SeCardConversation } from '@ctf/shared';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { listAnswers, listPairMessages, listPairs, listPublicMessages } from './repository';
import { idsIn, shapeConversation } from './shape';

// Everything the sheet draws for one viewer on one card, read in one go.
export async function readConversation(viewerId: string, cardId: string): Promise<SeCardConversation> {
  const [answers, publicMessages, pairs, pairMessages] = await Promise.all([
    listAnswers(viewerId, cardId),
    listPublicMessages(viewerId, cardId),
    listPairs(viewerId, cardId),
    listPairMessages(viewerId, cardId),
  ]);
  const rows = { answers, publicMessages, pairs, pairMessages };
  const handles = await resolveUsernames(idsIn(rows));
  return shapeConversation(cardId, viewerId, rows, handles);
}
