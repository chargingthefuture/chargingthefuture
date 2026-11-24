'use client';

// The Reader tile. The reader itself is a free page on another address with no sign-in, so this
// page is where a member finds out what it is, and that their list lives in their own browser,
// before they land there. A tile that opened the other address directly would tell them none of that.
import { Rss, ExternalLink } from 'lucide-react';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import { useTheme } from '@/hooks/useTheme';

const READER_URL = 'https://chargingthefuture.github.io/rss-feeds/read/';
const FONT_FAMILY = "'Figtree Variable', system-ui, sans-serif";

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
      {/* ctf-self-responsive: without it the app viewport's un-row fallback forces this column to
          display:block, which drops the gap and leaves the cards touching. */}
      <div
        className="ctf-self-responsive"
        style={{
          width: '100%',
          background: t.BG,
          color: t.TEXT,
          fontFamily: FONT_FAMILY,
          padding: '16px 16px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: t.SUBTLE }}>
          A feed reader collects what sites publish, in the order they published it. Nothing ranks it, nothing is
          inserted, and nothing records what you opened. This one is a free page that runs in your browser, so there is
          nothing to install and nobody pays for it.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            Opens chargingthefuture.github.io/rss-feeds/read. There is no sign-in: what you add and mark stays in that
            browser, so download a backup there to keep it.
          </p>
        </div>

        <Note title="What you get" tokens={t}>
          <p style={{ margin: 0 }}>
            The blog, the demo-video channel and the recorded broadcasts are there to start with. Add anything else you
            read by its address, and remove anything you do not want, those three included. Your list is kept in your
            browser and nobody else sees it.
          </p>
        </Note>

        <Note title="What it cannot do" tokens={t}>
          <p style={{ margin: 0 }}>
            It cannot reach back before you start. A feed carries only its most recent items, so day one holds whatever
            is sitting in each feed that day and everything after that builds up.
          </p>
          <p style={{ margin: 0 }}>It does not notify you. You go and look.</p>
          <p style={{ margin: 0 }}>
            Some sites do not let other web pages read their feed. Those cannot be added there; a feed reader app can
            still read them.
          </p>
        </Note>

        <Note title="A YouTube channel" tokens={t}>
          <p style={{ margin: 0 }}>
            YouTube does not let other pages read its channels. To read one there, ask for it from + New with the
            channel&apos;s address and, if you want one, the date to stop at. It is collected and cut at that date, and you
            get an address to add.
          </p>
        </Note>
      </div>
    </>
  );
}
