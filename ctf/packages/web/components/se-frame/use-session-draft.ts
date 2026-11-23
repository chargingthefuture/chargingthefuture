'use client';

import { useCallback, useEffect, useState } from 'react';
import { SESSION_DRAFT_PREFIX, readSessionPlace, writeSessionPlace } from 'lib/shared/session-place-store';

// Unsent text that survives the page reloading. iOS unloads a background tab to free memory and the
// browser builds the page again when the member comes back, which used to empty whatever they were
// typing. The draft sits in sessionStorage under `key` while they type and is read back when the
// text box appears; setting it to '' (after sending) removes it. sessionStorage ends with the tab,
// and signing out clears every draft (lib/auth/client-context.tsx), so a draft never outlives the
// tab or the member who wrote it.

export function useSessionDraft(key: string): [string, (value: string) => void] {
  const [value, setValue] = useState('');
  // Read after mount, so the server's empty render and the first browser render agree.
  useEffect(() => {
    setValue(readSessionPlace(SESSION_DRAFT_PREFIX + key) ?? '');
  }, [key]);
  const set = useCallback(
    (next: string) => {
      setValue(next);
      writeSessionPlace(SESSION_DRAFT_PREFIX + key, next);
    },
    [key],
  );
  return [value, set];
}
