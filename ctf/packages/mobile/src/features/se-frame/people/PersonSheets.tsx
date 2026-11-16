// Whichever sheet a People row opened on Android, the copy of the web's person-sheets.tsx. When the
// sheet closes, screen-reader focus goes back to the button that opened it.

import React, { useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, type View } from 'react-native';
import type { SeThemeTokens } from '@ctf/shared';
import type { OpenSheet, PersonSheet } from './PersonCard';
import { ProfileSheet } from './ProfileSheet';
import { QuoteSheet } from './QuoteSheet';

export function usePersonSheet(): { sheet: PersonSheet | null; open: OpenSheet; close: () => void; switchTo: (_next: PersonSheet) => void } {
  const [sheet, setSheet] = useState<PersonSheet | null>(null);
  const opener = useRef<View | null>(null);
  const open: OpenSheet = (next, from) => {
    opener.current = from;
    setSheet(next);
  };
  const close = () => {
    setSheet(null);
    const node = opener.current ? findNodeHandle(opener.current) : null;
    if (node) setTimeout(() => AccessibilityInfo.setAccessibilityFocus(node), 300);
  };
  return { sheet, open, close, switchTo: setSheet };
}

type Props = { t: SeThemeTokens; sheet: PersonSheet | null; viewerId: string | null; onClose: () => void; onSwitch: (_next: PersonSheet) => void };

export function PersonSheets({ t, sheet, viewerId, onClose, onSwitch }: Props) {
  if (!sheet) return null;
  const { person } = sheet;
  if (sheet.kind === 'quote') return <QuoteSheet t={t} profileId={person.id} name={person.name} onClose={onClose} />;
  return (
    <ProfileSheet
      t={t}
      profileId={person.id}
      name={person.name}
      viewerId={viewerId}
      canQuote={person.offering.length > 0}
      onQuote={() => onSwitch({ kind: 'quote', person })}
      onClose={onClose}
    />
  );
}
