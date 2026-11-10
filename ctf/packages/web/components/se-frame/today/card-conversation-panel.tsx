'use client';

import { useState } from 'react';
import { SE_CARD_WORDS, seCardId } from '@ctf/shared';
import { useSeTheme } from '../use-se-theme';
import { seThemeVars } from '../se-theme-vars';
import { CardConversationView } from './card-sheet';
import { useCardConversation } from './use-card-conversation';
import styles from './card-sheet.module.css';

// The conversation under a Today card, on the plugin's own page (owner decision, 2026-11-10): a ride
// on TrustTransport, a place on LightHouse, a goal on PeerProgramming. It is the same conversation the
// card's sheet shows on Today, read and written through the same routes, so 3.0 and 3.1 show one
// conversation in their own screens. Drawn in the member's 3.1 colors, which the panel sets itself.
export function CardConversationPanel({ source, sourceId }: { source: string; sourceId: string }) {
  const { theme } = useSeTheme();
  const talk = useCardConversation(seCardId(source, sourceId), null);
  return (
    <section aria-label={SE_CARD_WORDS.conversation} className={styles.panel} style={seThemeVars(theme.color, theme.mode)}>
      <CardConversationView talk={talk} />
    </section>
  );
}

// On a list card, the conversation opens on request, so a list does not load one per card.
export function CardConversationToggle({ source, sourceId }: { source: string; sourceId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={styles.panelToggle}>
        {open ? SE_CARD_WORDS.hideConversation : SE_CARD_WORDS.conversation}
      </button>
      {open ? <CardConversationPanel source={source} sourceId={sourceId} /> : null}
    </div>
  );
}
