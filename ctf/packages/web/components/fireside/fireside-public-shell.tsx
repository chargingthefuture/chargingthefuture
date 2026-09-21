'use client';

import { Flame, MessageSquare, BookOpenText, Archive, UserPlus, ArrowUpRight } from 'lucide-react';
import { PublicShellBackLink } from '@/components/plugins/public-shell-back-link';
import type { PublicVisitorShellProps } from '@/components/plugins/public-visitor-registry';
import { useTheme } from '@/hooks/useTheme';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from '@/lib/theme/theme-tokens';
import { FIRESIDE_BLOG_BASE } from '@/lib/fireside/constants';

const FONT_FAMILY = "'Inter', system-ui, sans-serif";

// Fireside is the one plugin whose main thing is already open to a visitor: the conversation
// renders under each blog post and reading it needs no account at all. The generic public shell
// told a visitor the opposite — that there is no public view yet and a sign-in is what opens it —
// which is both wrong and the least interesting thing that could be said about a conversation.
//
// So this shell sends a reader to the conversation first, and asks for an account only for the
// thing an account is actually needed for, which is writing in it.

type Point = {
  Icon: typeof Flame;
  title: string;
  body: string;
};

const POINTS: Point[] = [
  {
    Icon: BookOpenText,
    title: 'Read it without an account',
    body: 'Every comment sits under the post it belongs to, on the blog, in the open. Nothing to create, nothing to agree to.',
  },
  {
    Icon: MessageSquare,
    title: 'Nothing is ranked',
    body: 'Comments run oldest first and stay there. You can agree with one, and it still does not move — no counter decides what you get to read.',
  },
  {
    Icon: Archive,
    title: 'It is still there in a year',
    body: 'The posts and the conversation under them live on a site this project runs and the Internet Archive captures. Five of its accounts have been erased elsewhere; none of this went with them.',
  },
];

export function FiresidePublicShell({ signInUrl, verifyUrl }: PublicVisitorShellProps) {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('fireside', theme), theme);

  return (
    <div
      className="ctf-self-responsive"
      style={{
        width: '100%',
        minHeight: '100dvh',
        background: t.BG,
        fontFamily: FONT_FAMILY,
        color: t.TEXT,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          background: t.HEADER,
          borderBottom: `1px solid ${t.BORDER_SOLID}`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <PublicShellBackLink />
        <Flame size={17} color={t.ACCENT} />
        <span style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>Fireside</span>
        <a
          href={verifyUrl ?? signInUrl}
          style={{
            marginLeft: 'auto',
            padding: '6px 13px',
            borderRadius: 8,
            background: `${t.ACCENT}18`,
            border: `1px solid ${t.ACCENT}40`,
            color: t.ACCENT,
            fontSize: 12.5,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          {verifyUrl ? 'Finish verifying' : 'Sign in'}
        </a>
      </div>

      <div style={{ flex: 1, padding: '22px 16px 32px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 11px',
            borderRadius: 20,
            background: `${t.ACCENT}12`,
            border: `1px solid ${t.ACCENT}25`,
            fontSize: 11,
            fontWeight: 700,
            color: t.ACCENT,
          }}
        >
          <Flame size={12} /> Open to read, no account
        </span>

        <h1
          style={{
            margin: '14px 0 10px',
            fontSize: 26,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: t.TITLE,
          }}
        >
          Say it under the<br />
          <span style={{ color: t.ACCENT }}>post itself</span>.
        </h1>

        <p style={{ margin: 0, fontSize: 13.5, color: t.SUBTLE, lineHeight: 1.65 }}>
          Fireside is the conversation under every post on the blog — about trafficking, about
          being targeted, about the ordinary work of rebuilding. Read the entire thread with no
          account. Sign in when you want to answer somebody.
        </p>

        <a
          href={FIRESIDE_BLOG_BASE}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            width: '100%',
            boxSizing: 'border-box',
            marginTop: 20,
            padding: '13px',
            borderRadius: 11,
            background: t.ACCENT,
            border: 'none',
            color: '#1A0C05',
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Read the conversation <ArrowUpRight size={15} />
        </a>

        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          {POINTS.map(({ Icon, title, body }) => (
            <div
              key={title}
              style={{
                display: 'flex',
                gap: 11,
                padding: '14px',
                borderRadius: 13,
                background: t.SURFACE,
                border: `1px solid ${t.BORDER_SOLID}`,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: 9,
                  background: `${t.ACCENT}14`,
                  border: `1px solid ${t.ACCENT}28`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={16} color={t.ACCENT} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.TITLE, marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 12.5, color: t.MUTED, lineHeight: 1.55 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 22,
            padding: '18px',
            borderRadius: 14,
            background: `${t.ACCENT}0A`,
            border: `1px solid ${t.ACCENT}25`,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 6 }}>
            {verifyUrl ? 'You can write already' : 'To write, an account'}
          </div>
          <div style={{ fontSize: 12.5, color: t.MUTED, lineHeight: 1.6, marginBottom: 14 }}>
            {verifyUrl
              ? 'Signing in was enough — leave a comment whenever you want. What you write stays private until you are approved, and then everything you have written appears at once. You always see your own words in the meantime.'
              : 'Signing in is enough to write; it is free and takes a minute. What you write stays private until a person has read your account and approved it — then everything you have written appears at once. You can take anything of yours down yourself, with no admin involved.'}
          </div>
          <a
            href={verifyUrl ?? signInUrl}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px',
              borderRadius: 10,
              background: 'transparent',
              border: `1px solid ${t.ACCENT}55`,
              color: t.ACCENT,
              fontSize: 13.5,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            {verifyUrl ? 'Finish verifying' : <><UserPlus size={15} /> Create a free account</>}
          </a>
        </div>
      </div>
    </div>
  );
}
