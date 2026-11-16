'use client';

import { useState } from 'react';
import { SE_CARD_WORDS, seCardId } from '@ctf/shared';
import type { PluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { classicLookVars } from '@/components/shared/classic-look-vars';
import { CardConversationView } from './card-sheet';
import { CardTalkStylesContext } from './card-talk-styles';
import { useCardConversation } from './use-card-conversation';
import styles from './card-conversation-classic.module.css';

// The conversation under a Today card, on the plugin's own page (owner decision, 2026-11-10): a ride
// on TrustTransport, a place on LightHouse, a goal on PeerProgramming. It is the same conversation the
// card's sheet shows on Today, read and written through the same routes. Those pages are 3.0 screens,
// so the panel is drawn in the 3.0 look with the plugin's own tokens: the two designs are never mixed
// on one screen (owner decision, 2026-11-16).

type PanelProps = { source: string; sourceId: string; look: PluginShellTokens };

export function CardConversationPanel({ source, sourceId, look }: PanelProps) {
  const talk = useCardConversation(seCardId(source, sourceId), null);
  return (
    <section aria-label={SE_CARD_WORDS.conversation} className={styles.panel} style={classicLookVars(look)}>
      <CardTalkStylesContext.Provider value={styles}>
        <CardConversationView talk={talk} />
      </CardTalkStylesContext.Provider>
    </section>
  );
}

// On a list card, the conversation opens on request, so a list does not load one per card.
export function CardConversationToggle({ source, sourceId, look }: PanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={styles.panelToggle} style={classicLookVars(look)}>
        {open ? SE_CARD_WORDS.hideConversation : SE_CARD_WORDS.conversation}
      </button>
      {open ? <CardConversationPanel source={source} sourceId={sourceId} look={look} /> : null}
    </div>
  );
}
