'use client';

// The Reader tile. The reader itself runs on a separate server, so this page is where a member
// finds out what it is and what a place on it costs before they land on another address and a
// sign-in prompt. A tile that opened the other domain directly would tell them none of that.
import { Rss, ExternalLink } from 'lucide-react';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import { useTheme } from '@/hooks/useTheme';

const READER_URL = 'https://rss.chargingthefuture.com';
const FONT_FAMILY = "'Inter', system-ui, sans-serif";

type NoteProps = { title: string; children: React.ReactNode; tokens: ReturnType<typeof getPluginShellTokens> };

function Note({ title, children, tokens }: NoteProps) {
  return (
    <section
      style={{
        borderRadius: 14,
        border: `1px solid ${tokens.BORDER}`,
        background: tokens.SURFACE,
        padding: '16px 16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: tokens.TITLE }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: tokens.SUBTLE, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </section>
  );
}

export function ReaderShell() {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('reader', theme), theme);

  return (
    <>
      <MobileScreenHeader title="Reader" accent={t.ACCENT} icon={<Rss size={18} color={t.ACCENT} />} />
      <div
        style={{
          width: '100%',
          background: t.BG,
          color: t.TEXT,
          fontFamily: FONT_FAMILY,
          padding: '16px 16px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: t.SUBTLE }}>
          A feed reader collects what sites publish, in the order they published it. Nothing ranks it, nothing is
          inserted, and nothing records what you opened. This one runs on a server this project pays for, so you do not
          have to run anything yourself.
        </p>

        <a
          href={READER_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 14,
            borderRadius: 12,
            background: t.ACCENT,
            color: '#0B0B0B',
            fontSize: 15,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Open the reader
          <ExternalLink size={16} color="#0B0B0B" />
        </a>
        <p style={{ margin: 0, fontSize: 12, color: t.MUTED }}>
          Opens rss.chargingthefuture.com. Sign in there with this same account — there is no second password to set.
        </p>

        <Note title="What you get" tokens={t}>
          <p style={{ margin: 0 }}>
            The blog is already in a new account. Add anything else you read, and your list is yours: no shared list, no
            comments, and no way for one account to see another.
          </p>
        </Note>

        <Note title="What it cannot do" tokens={t}>
          <p style={{ margin: 0 }}>
            It cannot reach back before you start. A feed carries only its most recent items, so day one holds whatever
            is sitting in each feed that day and everything after that builds up.
          </p>
          <p style={{ margin: 0 }}>It does not notify you. You go and look.</p>
        </Note>

        <Note title="What a place on it costs" tokens={t}>
          <p style={{ margin: 0 }}>
            The server is paid for. A place on it is something you get by finishing the check on this app or by
            contributing to what it costs, and if the bill makes it necessary, places go to the people who did one of
            those.
          </p>
          <p style={{ margin: 0 }}>
            Losing a place is not a ban. Your account here is untouched, you keep everything this app gives you, and you
            can come back to the reader later. Not finishing the check never costs anybody their account.
          </p>
        </Note>
      </div>
    </>
  );
}
