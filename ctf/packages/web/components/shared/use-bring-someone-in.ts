'use client';

import { useState } from 'react';
import { SE_TODAY_ROOM_WORDS as W } from '@ctf/shared';

// "Bring someone in" shares the signed-out Today, where anybody can listen without an account: the
// phone's share sheet where there is one, the clipboard otherwise. Used on Today's room card and on
// the live room's bar.
export function useBringSomeoneIn() {
  const [note, setNote] = useState<string | null>(null);
  const bring = async () => {
    const url = `${window.location.origin}${W.bringPath}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: W.bringText, url });
        return;
      }
      await navigator.clipboard.writeText(`${W.bringText} ${url}`);
      setNote(W.copied);
    } catch (error) {
      // A share sheet closed without sharing is not a failure; anything else is said beside the button.
      if ((error as { name?: string } | null)?.name !== 'AbortError') setNote(W.copyFailed);
    }
  };
  return { note, bring };
}
