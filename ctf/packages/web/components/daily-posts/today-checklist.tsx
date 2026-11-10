'use client';

import { useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { DAILY_PLATFORMS, type DailyPlatformKind } from 'lib/daily-posts/platforms';
import { CopyRow } from './copy-row';
import type { DailyBlurbItem, DailyLiveItem, ShellTokens, TickMap } from './types';

// The day's checklist at the top of Daily Posts: today's live topic, one blurb from each line,
// and a tick for every platform. Copying a blurb or the topic ticks that item; a platform is
// ticked by hand once something has gone up there.

type Props = {
  t: ShellTokens;
  today: string;
  ticks: TickMap;
  live: DailyLiveItem | null;
  blurbs: DailyBlurbItem[];
  contentError: string | null;
  onTick: (itemKey: string, done: boolean) => Promise<string | null>;
};

const GROUPS: Array<{ kind: DailyPlatformKind; title: string }> = [
  { kind: 'post', title: 'Full posts' },
  { kind: 'blurb', title: 'Blurbs' },
  { kind: 'live', title: 'Lives and videos' },
];

function SubHeading({ t, text }: { t: ShellTokens; text: string }) {
  return <h3 style={{ fontSize: 13, fontWeight: 700, color: t.SUBTLE, margin: '12px 0 6px' }}>{text}</h3>;
}

function PlatformRow({ t, label, takes, done, onTick }: { t: ShellTokens; label: string; takes: string; done: boolean; onTick: (done: boolean) => Promise<string | null> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    const failure = await onTick(!done);
    setBusy(false);
    setMessage(failure ? `The tick was not saved: ${failure}` : null);
  }

  return (
    <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 10, padding: '8px 10px' }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        aria-pressed={done}
        aria-label={done ? `${label}: done today. Tap to take the tick back.` : `${label}: tap when posted today.`}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: t.TEXT }}
      >
        {done ? <Check size={20} strokeWidth={3} color="#4ADE80" /> : <Circle size={20} color={t.MUTED} />}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: t.TITLE }}>{label}</span>
          <span style={{ display: 'block', fontSize: 12, color: t.MUTED }}>{takes}</span>
        </span>
      </button>
      {message && (
        <p role="alert" style={{ fontSize: 12, color: '#F87171', margin: '6px 0 0' }}>
          {message}
        </p>
      )}
    </div>
  );
}

export function TodayChecklist({ t, today, ticks, live, blurbs, contentError, onTick }: Props) {
  const doneOf = (key: string) => (ticks[key] ?? [])[0] === today;
  const platformsDone = DAILY_PLATFORMS.filter((platform) => doneOf(`platform:${platform.id}`)).length;

  return (
    <div>
      {contentError && (
        <p role="alert" style={{ fontSize: 12.5, color: '#F87171', margin: '0 0 10px' }}>
          {contentError}
        </p>
      )}

      {live && (
        <>
          <SubHeading t={t} text={`Live topic · ${live.lineLabel}`} />
          <CopyRow t={t} label={live.title} text={live.pasteText} doneToday={doneOf(`live:${live.id}`)} onTick={(done) => onTick(`live:${live.id}`, done)}>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: t.TEXT, lineHeight: 1.5 }}>
              {live.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </CopyRow>
        </>
      )}

      {blurbs.length > 0 && (
        <>
          <SubHeading t={t} text="Blurbs" />
          <div style={{ display: 'grid', gap: 6 }}>
            {blurbs.map((blurb) => (
              <CopyRow key={blurb.id} t={t} label={blurb.lineLabel} text={blurb.pasteText} doneToday={doneOf(`blurb:${blurb.id}`)} onTick={(done) => onTick(`blurb:${blurb.id}`, done)}>
                <p style={{ fontSize: 13, color: t.TEXT, margin: '6px 0 0', lineHeight: 1.5 }}>{blurb.text}</p>
              </CopyRow>
            ))}
          </div>
        </>
      )}

      <SubHeading t={t} text={`Platforms · ${platformsDone} of ${DAILY_PLATFORMS.length} done`} />
      {GROUPS.map((group) => (
        <div key={group.kind} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: t.MUTED, margin: '0 0 4px' }}>{group.title}</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {DAILY_PLATFORMS.filter((platform) => platform.kind === group.kind).map((platform) => (
              <PlatformRow
                key={platform.id}
                t={t}
                label={platform.label}
                takes={platform.takes}
                done={doneOf(`platform:${platform.id}`)}
                onTick={(done) => onTick(`platform:${platform.id}`, done)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
