'use client';

import { useEffect, useRef } from 'react';

// For a 3.1 sheet drawn as a dialog: focus moves into the sheet when it opens and back to whatever
// opened it when it closes, and Escape closes it. Put the returned ref on the dialog, with
// tabIndex={-1}.
export function useSheetFocus(onClose: () => void) {
  const sheet = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheet.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, []);
  return sheet;
}
