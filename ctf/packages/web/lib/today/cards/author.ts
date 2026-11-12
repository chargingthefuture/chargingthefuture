import { seHelpedConfirmedByAdmin } from '@ctf/shared';
import { readTodayItem } from '../items';

// Who wrote a card, for confirming a "This helped me" (3.1.0 plan, Measures). A blog story, an
// announcement or What Works is the System Architect's, so an admin confirms there; on any other
// card, the member who posted the item, read where it lives. A card whose item cannot be read has
// nobody to confirm.

export type CardViewer = { userId: string; isAdmin: boolean };

export async function isCardAuthor(viewer: CardViewer, cardId: string): Promise<boolean> {
  if (seHelpedConfirmedByAdmin(cardId)) return viewer.isAdmin;
  const item = await readTodayItem(cardId, viewer.userId);
  return item?.ownerUserId === viewer.userId;
}
