import type { SeCardConversation } from '@ctf/shared';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { isCardAuthor, type CardViewer } from './author';
import { listAnswers, listPairMessages, listPairs, listPublicMessages } from './repository';
import { hasHelpedFromOthers, idsIn, shapeConversation } from './shape';

// Everything the sheet draws for one viewer on one card, read in one go. Whether the viewer wrote
// the card (so the sheet offers Confirm beside a "This helped me") is asked only when somebody else
// said it helped.
export async function readConversation(viewer: CardViewer, cardId: string): Promise<SeCardConversation> {
  const viewerId = viewer.userId;
  const [answers, publicMessages, pairs, pairMessages] = await Promise.all([
    listAnswers(viewerId, cardId),
    listPublicMessages(viewerId, cardId),
    listPairs(viewerId, cardId),
    listPairMessages(viewerId, cardId),
  ]);
  const rows = { answers, publicMessages, pairs, pairMessages };
  const [handles, author] = await Promise.all([
    resolveUsernames(idsIn(rows)),
    hasHelpedFromOthers(answers, viewerId) ? isCardAuthor(viewer, cardId) : Promise.resolve(false),
  ]);
  return shapeConversation(cardId, viewerId, rows, handles, author);
}
