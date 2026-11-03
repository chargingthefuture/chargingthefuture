'use client';

import { useEffect, useState } from 'react';
import { seSignedOutTheme } from '@ctf/shared';

// The theme of every signed-out screen: burgundy, light or dark as the device is set. It starts
// light, the setting of most phones, and follows the device from the first effect on.
export function useSignedOutTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return seSignedOutTheme(dark);
}
