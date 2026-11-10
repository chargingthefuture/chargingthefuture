// The conversation under a Today card, on the plugin's own page, the Android copy of the web's
// card-conversation-panel.tsx (owner decision, 2026-11-10): the same conversation the card's sheet
// shows on Today, so 3.0 and 3.1 show one conversation in their own screens.

import React from 'react';
import { View } from 'react-native';
import { SE_CARD_WORDS, seCardId, seTheme } from '@ctf/shared';
import { useSeTheme } from '../useSeTheme';
import { CardConversationView } from './CardSheet';
import { makeCardSheetStyles } from './cardSheetStyles';
import { useCardConversation } from './useCardConversation';

export function CardConversationPanel({ source, sourceId }: { source: string; sourceId: string }) {
  const { theme } = useSeTheme();
  const t = seTheme(theme.color, theme.mode);
  const s = makeCardSheetStyles(t);
  const talk = useCardConversation(seCardId(source, sourceId), null);
  return (
    <View accessibilityLabel={SE_CARD_WORDS.conversation} style={{ gap: 14, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.bg }}>
      <CardConversationView t={t} s={s} talk={talk} />
    </View>
  );
}
