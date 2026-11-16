// The conversation under a Today card, on the plugin's own page, the Android copy of the web's
// card-conversation-panel.tsx (owner decision, 2026-11-10): the same conversation the card's sheet
// shows on Today. The page is a 3.0 screen, so the panel is drawn in the 3.0 look with the plugin's
// own tokens, never the 3.1 look (owner decision, 2026-11-16).

import React from 'react';
import { View } from 'react-native';
import { SE_CARD_WORDS, seCardId } from '@ctf/shared';
import { CardConversationView } from './CardSheet';
import { cardTalkClassicInk, makeCardTalkClassicFrame, makeCardTalkClassicStyles } from './cardTalkClassicStyles';
import type { ClassicLook } from '../classicLook';
import { useCardConversation } from './useCardConversation';

export function CardConversationPanel({ source, sourceId, look }: { source: string; sourceId: string; look: ClassicLook }) {
  const talk = useCardConversation(seCardId(source, sourceId), null);
  const frame = makeCardTalkClassicFrame(look);
  return (
    <View accessibilityLabel={SE_CARD_WORDS.conversation} style={frame.panel}>
      <CardConversationView t={cardTalkClassicInk(look)} s={makeCardTalkClassicStyles(look)} talk={talk} />
    </View>
  );
}
