'use client';

import type { ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { inviteAvatarGradient, inviteInitials } from 'lib/directory/invite-avatar';
import type { DirectoryTokens } from './shared';
import { formatInviteDate } from './directory-invite-format';
import styles from './directory-invite-card.module.css';

/** The class that gives a link on an invite card its keyboard focus ring. */
export const INVITE_LINK_CLASS = styles.link;

/**
 * Letters from the name on a gradient picked from the seed (lib/directory/invite-avatar.ts). Purely
 * decorative: hidden from screen readers, which read the name beside it. The comic theme carries no
 * gradients, so there it is the gradient's darker color, flat.
 */
export function InviteAvatar({ name, seed, size = 44 }: { name: string; seed: string; size?: number }) {
  const comic = useTheme().theme === 'comic';
  const { from, to, angle } = inviteAvatarGradient(seed);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        background: comic ? to : `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.4),
        fontWeight: 800,
        letterSpacing: 0.5,
        textShadow: comic ? 'none' : '0 1px 2px rgba(0,0,0,0.35)',
        userSelect: 'none',
      }}
    >
      {inviteInitials(name)}
    </span>
  );
}

type InviteCardViewProps = {
  name: string;
  opening: string;
  // The Quora handle where the card carries one, otherwise the name: it picks the avatar's colors.
  seed: string;
  date?: string;
  t: DirectoryTokens;
  headingLevel?: 2 | 3;
  highlighted?: boolean;
  // The card's links (read the invitation, the blog post), under the opening words.
  children?: ReactNode;
};

/**
 * One invitation as a card on the walls: the avatar, "An invitation to <name>", the date, the opening
 * words set as a pull quote, and an edge in the avatar's color. No picture: a picture shows only
 * inside the full invitation.
 */
export function InviteCardView({ name, opening, seed, date, t, headingLevel = 3, highlighted = false, children }: InviteCardViewProps) {
  const comic = useTheme().theme === 'comic';
  const { from } = inviteAvatarGradient(seed);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const edge = highlighted ? `${t.ACCENT}70` : t.BORDER_HI;
  return (
    <article
      style={{
        borderRadius: 14,
        borderStyle: 'solid',
        borderWidth: '1px 1px 1px 3px',
        borderColor: `${edge} ${edge} ${edge} ${comic ? t.ACCENT : `${from}B3`}`,
        background: t.SURFACE,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <InviteAvatar name={name} seed={seed} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <Heading style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.TITLE, overflowWrap: 'anywhere' }}>An invitation to {name}</Heading>
          {date ? <time dateTime={date} style={{ fontSize: 12, color: t.SUBTLE }}>{formatInviteDate(date)}</time> : null}
        </div>
      </div>
      <p style={{ margin: 0, position: 'relative', paddingLeft: 22, fontSize: 14, lineHeight: 1.6, fontStyle: 'italic', color: t.TEXT, overflowWrap: 'anywhere' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: -6, fontSize: 30, lineHeight: 1, fontStyle: 'normal', fontWeight: 800, color: comic ? t.ACCENT : from }}>&ldquo;</span>
        {opening}
      </p>
      {children ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>{children}</div> : null}
    </article>
  );
}
