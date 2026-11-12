import { seCardId } from '@ctf/shared';
import { agreePairRequest, findPair, insertPairRequest } from 'lib/today/cards/repository';

// The card a SocketRelay request is in Today, and so the conversation its helper and the person who
// asked share: the request id under the `socket-relay` source.
export function socketRelayCardId(requestId: string): string {
  return seCardId('socket-relay', requestId);
}

// An offer to help asks the person who asked to talk just you two on the request's card. It opens
// once they agree, as every Just us two does. If they had already asked the helper, the offer
// agrees to that.
export async function openFulfillmentJustUsTwo(requestId: string, helperId: string, requesterId: string): Promise<void> {
  const cardId = socketRelayCardId(requestId);
  const existing = await findPair(cardId, helperId, requesterId);
  if (existing) {
    if (!existing.agreedAt && existing.requesterId === requesterId) await agreePairRequest(cardId, helperId, requesterId);
    return;
  }
  await insertPairRequest(cardId, helperId, requesterId);
}
