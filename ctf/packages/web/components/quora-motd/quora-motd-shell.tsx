'use client';

import { useCallback, useState } from 'react';
import { ClipboardCopy, Megaphone, CalendarDays } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import { getAppAccent } from 'lib/theme/theme-tokens';
import {
  QUORA_MOTD_ACTION_LABEL,
  QUORA_MOTD_SPACE_URL,
  type QuoraMotdMessage,
} from 'lib/quora-motd/types';

// One message a day, ready to paste into the Skills Economy space. This screen exists to be used
// from a phone with no keyboard in reach: everything worth pasting has its own copy control, and
// nothing has to be selected by hand.

export type QuoraMotdDay = {
  date: string;
  /** Monday 22 September, for a reader who is not counting days from an epoch. */
  label: string;
  message: QuoraMotdMessage;
};

type Props = {
  today: QuoraMotdDay;
  upcoming: QuoraMotdDay[];
  poolSize: number;
};

function CopyButton({
  text,
  label,
  accent,
  wide,
}: {
  text: string;
  label: string;
  accent: string;
  wide?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setFailed(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (caught) {
      setFailed(caught instanceof Error ? `Copy failed: ${caught.message}` : 'Copy failed.');
    }
  }, [text]);

  return (
    <>
      <button
        type="button"
        onClick={() => void onCopy()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          width: wide ? '100%' : undefined,
          boxSizing: 'border-box',
          background: accent,
          color: '#0B0B0F',
          border: 'none',
          borderRadius: 10,
          padding: wide ? '12px 14px' : '7px 11px',
          fontSize: wide ? 14 : 12.5,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <ClipboardCopy size={wide ? 15 : 13} />
        {copied ? 'Copied' : label}
      </button>
      {failed && (
        <p role="alert" style={{ fontSize: 12, color: '#F87171', margin: '6px 0 0' }}>
          {failed}
        </p>
      )}
    </>
  );
}

export function QuoraMotdShell({ today, upcoming, poolSize }: Props) {
  const { theme } = useTheme();
  const t = getPluginShellTokens(getAppAccent('fireside', theme), theme);
  const [showUpcoming, setShowUpcoming] = useState(false);

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      <MobileScreenHeader
        title="Message of the day"
        accent={t.ACCENT}
        icon={<Megaphone size={18} color={t.ACCENT} />}
      />
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 20px 40px' }}>
        <p style={{ fontSize: 13, color: t.SUBTLE, margin: '0 0 6px', lineHeight: 1.55 }}>
          One post a day for the Skills Economy space, so a short-lived account still says one
          complete thing. Post it within minutes of creating the account — the record shows handles
          banned inside the minute they were opened.
        </p>
        <p style={{ fontSize: 12.5, color: t.MUTED, margin: '0 0 16px', lineHeight: 1.55 }}>
          The ask rotates between the three Peace Battle 2 actions, and nothing repeats until all{' '}
          {poolSize} have run.{' '}
          <a href={QUORA_MOTD_SPACE_URL} style={{ color: t.ACCENT }}>
            {QUORA_MOTD_SPACE_URL}
          </a>
        </p>

        <article
          style={{
            borderRadius: 16,
            background: t.SURFACE,
            border: `1px solid ${t.ACCENT}35`,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, color: t.ACCENT, fontWeight: 700, marginBottom: 2 }}>
            {today.label}
          </div>
          <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 12 }}>
            Ask: {QUORA_MOTD_ACTION_LABEL[today.message.action]}
          </div>

          <div style={{ fontSize: 11.5, color: t.MUTED, marginBottom: 5 }}>Title</div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: t.TITLE,
              lineHeight: 1.4,
              marginBottom: 10,
            }}
          >
            {today.message.title}
          </div>
          <CopyButton text={today.message.title} label="Copy the title" accent={t.ACCENT} />

          <div style={{ fontSize: 11.5, color: t.MUTED, margin: '18px 0 5px' }}>Post</div>
          <pre
            style={{
              fontSize: 13.5,
              color: t.TEXT,
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit',
              margin: '0 0 12px',
              padding: 12,
              borderRadius: 11,
              background: t.INPUT_BG,
              border: `1px solid ${t.BORDER_SOLID}`,
            }}
          >
            {today.message.body}
          </pre>
          <CopyButton text={today.message.body} label="Copy the post" accent={t.ACCENT} wide />
        </article>

        <button
          type="button"
          onClick={() => setShowUpcoming((open) => !open)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            marginTop: 20,
            background: 'transparent',
            border: `1px solid ${t.BORDER_SOLID}`,
            borderRadius: 10,
            padding: '9px 13px',
            color: t.TEXT,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <CalendarDays size={14} color={t.ACCENT} />
          {showUpcoming ? 'Hide what is coming' : `What is coming (${upcoming.length} days)`}
        </button>

        {showUpcoming && (
          <div style={{ marginTop: 12 }}>
            {upcoming.map((day) => (
              <div
                key={day.date}
                style={{
                  borderRadius: 12,
                  background: t.SURFACE,
                  border: `1px solid ${t.BORDER_SOLID}`,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 11.5, color: t.MUTED, marginBottom: 3 }}>
                  {day.label} · {QUORA_MOTD_ACTION_LABEL[day.message.action]}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: t.TITLE, lineHeight: 1.4 }}>
                  {day.message.title}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
