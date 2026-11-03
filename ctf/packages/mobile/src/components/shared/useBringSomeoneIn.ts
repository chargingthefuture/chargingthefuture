// "Bring someone in" opens the phone's share sheet with the signed-out Today, where anybody can
// listen without an account. Used on Today's room card and on the live room's bar, as on the web
// (web components/shared/use-bring-someone-in.ts).

import { useState } from 'react';
import { Share } from 'react-native';
import { SE_TODAY_ROOM_WORDS as W } from '@ctf/shared';
import { webPageUrl } from '../../navigation/openWebPage';
import { reportError } from '../../observability/report';

export function useBringSomeoneIn() {
  const [note, setNote] = useState<string | null>(null);
  const bring = async () => {
    try {
      await Share.share({ message: `${W.bringText} ${webPageUrl(W.bringPath)}` });
    } catch (error) {
      reportError(error, { area: 'today', op: 'bring_someone_in' });
      setNote(W.copyFailed);
    }
  };
  return { note, bring };
}
