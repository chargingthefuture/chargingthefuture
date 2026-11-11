'use client';

import { useCallback, useEffect, useState } from 'react';
import { isSeMeView, type SeMeView } from '@ctf/shared';

// Which screen the Me tab shows (Me, Settings, Theme, Read, Hidden, or editing the profile lines),
// kept in the address (?tab=me&view=settings) so the back button returns to the screen before it.

function readView(): SeMeView {
  if (typeof window === 'undefined') return 'me';
  const view = new URLSearchParams(window.location.search).get('view');
  return isSeMeView(view) ? view : 'me';
}

export function useMeView(): { view: SeMeView; open: (_next: SeMeView) => void } {
  const [view, setView] = useState<SeMeView>('me');
  useEffect(() => {
    setView(readView());
    const onPop = () => setView(readView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const open = useCallback((next: SeMeView) => {
    setView(next);
    window.history.pushState(null, '', next === 'me' ? '/?tab=me' : `/?tab=me&view=${next}`);
    window.scrollTo(0, 0);
  }, []);
  return { view, open };
}
