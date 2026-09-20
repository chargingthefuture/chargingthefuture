'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Radio, ArrowUpRight, Globe } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { BackChevronButton, useSmartBack } from '@/lib/nav/back-history';
import {
  TI_RADIO_MAX_SLOTS_PER_DAY,
  TI_RADIO_MEETING_ROUTE,
  TI_RADIO_ROLLING_WINDOW_HOURS,
  TI_RADIO_SLOT_MINUTES,
} from 'lib/ti-radio/constants';
import { HOSTING_NOT_ENDORSEMENT } from '@ctf/shared';
import type { TiRadioGuide, TiRadioGuideSlot } from 'lib/ti-radio/types';
import { TiRadioHostForm } from './ti-radio-host-form';
import { TiRadioSlotRow } from './ti-radio-slot-row';
import { detectTimeZone, getTiRadioTokens, groupByLocalDay, requestJson, timeZoneLabel } from './ti-radio-shared';

type Props = {
  initialGuide: TiRadioGuide;
  signInUrl: string;
  verifyUrl: string;
};

// The guide. A week of 90-minute slots, some booked and some empty, printed in the reader's own
// timezone.
//
// It renders for a signed-out visitor exactly as it does for a member, minus the controls: that is
// the whole idea of a broadcast guide, and this one is written for people arriving from the Quora
// space who have not joined yet. The only thing an account changes is whether an empty row is a
// button.
export function TiRadioGuideView({ initialGuide, signInUrl, verifyUrl }: Props) {
  const { theme } = useTheme();
  const t = getTiRadioTokens(theme);

  const [guide, setGuide] = useState(initialGuide);
  const [tz, setTz] = useState('UTC');
  const [hosting, setHosting] = useState<TiRadioGuideSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hostFormRef = useRef<HTMLDivElement | null>(null);

  // Detected on mount so the server render stays deterministic.
  useEffect(() => {
    setTz(detectTimeZone());
  }, []);

  // The form opens at the top of the guide, above every day. Press an open row on Thursday and the
  // form is a screen or two above where you are looking, so nothing appears to happen and the row
  // reads as broken. Bring the form to the middle of the screen when it opens. The form focuses its
  // own first field without scrolling, so a keyboard or screen-reader user lands in the same place.
  useEffect(() => {
    if (!hosting) {
      return;
    }
    const node = hostFormRef.current;
    if (!node?.scrollIntoView) {
      return;
    }
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }, [hosting]);

  const refresh = useCallback(async () => {
    const payload = await requestJson<{ guide: TiRadioGuide }>('/api/ti-radio/guide');
    setGuide(payload.guide);
  }, []);

  const runCommand = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await refresh();
        setHosting(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'That did not work.');
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const onBook = useCallback(
    (values: { title: string; description: string }) => {
      const slot = hosting;
      if (!slot) {
        return;
      }
      void runCommand(() =>
        requestJson('/api/ti-radio/slots', {
          method: 'POST',
          body: JSON.stringify({ slotStart: slot.slotStartIso, title: values.title, description: values.description }),
        }),
      );
    },
    [hosting, runCommand],
  );

  const onRelease = useCallback(
    (slot: TiRadioGuideSlot) => {
      if (!slot.booking || !window.confirm('Give this slot back? It goes back on the guide as open.')) {
        return;
      }
      void runCommand(() => requestJson(`/api/ti-radio/slots/${slot.booking?.id}`, { method: 'DELETE' }));
    },
    [runCommand],
  );

  const onRemove = useCallback(
    (slot: TiRadioGuideSlot) => {
      if (!slot.booking) {
        return;
      }
      const reason = window.prompt('Why is this slot being removed? The reason is kept with the record.');
      if (reason === null) {
        return;
      }
      void runCommand(() =>
        requestJson(`/api/ti-radio/slots/${slot.booking?.id}/remove`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }),
      );
    },
    [runCommand],
  );

  const days = useMemo(() => groupByLocalDay(guide.slots, tz), [guide.slots, tz]);
  const { isSignedIn, canHost, isAdmin } = guide.viewer;

  return (
    <div style={{ background: t.BG, minHeight: '100vh', color: t.TEXT }}>
      {isSignedIn && <MobileScreenHeader title="TI Radio" accent={t.ACCENT} icon={<Radio size={18} color={t.ACCENT} />} />}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: isSignedIn ? '20px 20px 40px' : '32px 20px 40px' }}>
        <GuideHeader t={t} isSignedIn={isSignedIn} tz={tz} />
        <GuideIntro t={t} isSignedIn={isSignedIn} canHost={canHost} signInUrl={signInUrl} verifyUrl={verifyUrl} />

        {hosting && (
          <div ref={hostFormRef}>
            <TiRadioHostForm
              slotStartIso={hosting.slotStartIso}
              slotEndIso={hosting.slotEndIso}
              tz={tz}
              t={t}
              busy={busy}
              error={error}
              onCancel={() => {
                setHosting(null);
                setError(null);
              }}
              onSubmit={onBook}
            />
          </div>
        )}

        {error && !hosting && (
          <p role="alert" style={{ fontSize: 12, color: '#F87171', margin: '0 0 12px' }}>
            {error}
          </p>
        )}

        {days.map((day) => (
          <section key={day.key} style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: t.SUBTLE, textTransform: 'uppercase', letterSpacing: 0.7, margin: '0 0 8px' }}>
              {day.label}
            </h2>
            {day.slots.map((slot) => (
              <TiRadioSlotRow
                key={slot.slotStartIso}
                slot={slot}
                tz={tz}
                t={t}
                canHost={canHost}
                isSignedIn={isSignedIn}
                isAdmin={isAdmin}
                busy={busy}
                onHost={() => {
                  setError(null);
                  setHosting(slot);
                }}
                onRelease={onRelease}
                onRemove={onRemove}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

// The page's own header. The back chevron shows only for a signed-out visitor with somewhere in-app
// behind them — a member already has the standard top bar, and a visitor who arrived from a link
// pasted elsewhere has nothing in-app to go back to.
function GuideHeader({ t, isSignedIn, tz }: { t: ReturnType<typeof getTiRadioTokens>; isSignedIn: boolean; tz: string }) {
  const { hasHistory } = useSmartBack();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!isSignedIn && hasHistory && <BackChevronButton accent={t.ACCENT} size={34} />}
        <Radio size={22} style={{ color: t.ACCENT }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: t.TITLE }}>TI Radio</h1>
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 11, color: t.FAINT }}>
        <Globe size={12} /> Times shown in {timeZoneLabel(tz)}
      </div>
    </div>
  );
}

// What this page is, said once at the top, and the one action a reader who cannot host yet can take.
function GuideIntro({
  t,
  isSignedIn,
  canHost,
  signInUrl,
  verifyUrl,
}: {
  t: ReturnType<typeof getTiRadioTokens>;
  isSignedIn: boolean;
  canHost: boolean;
  signInUrl: string;
  verifyUrl: string;
}) {
  return (
    <div style={{ borderRadius: 14, background: t.SURFACE, border: `1px solid ${t.BORDER_SOLID}`, padding: 16, marginBottom: 18 }}>
      <p style={{ fontSize: 13, color: t.TEXT, margin: 0, lineHeight: 1.55 }}>
        A week of live discussions, {TI_RADIO_SLOT_MINUTES} minutes each. Anyone can read this page.
        Members take an empty slot, say what it is about, and everyone meets in Chyme at that time.
      </p>
      <p style={{ fontSize: 12, color: t.SUBTLE, margin: '10px 0 0', lineHeight: 1.55 }}>
        First come, first served. You can hold {TI_RADIO_MAX_SLOTS_PER_DAY} slots in any{' '}
        {TI_RADIO_ROLLING_WINDOW_HOURS} hours, and you can give a slot back any time before it starts.
      </p>
      {/* A page that lists who is hosting reads as a line-up somebody picked. Nobody picked it, and
          saying so here is cheaper than correcting the impression after somebody acts on it. */}
      <p
        style={{
          fontSize: 12,
          color: t.SUBTLE,
          margin: '10px 0 0',
          lineHeight: 1.55,
          paddingTop: 10,
          borderTop: `1px solid ${t.BORDER_SOLID}`,
        }}
      >
        {HOSTING_NOT_ENDORSEMENT}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <a href={TI_RADIO_MEETING_ROUTE} style={linkButton(t)}>
          Open Chyme <ArrowUpRight size={12} />
        </a>
        {!isSignedIn && (
          <a href={signInUrl} style={linkButton(t)}>
            Sign in to host <ArrowUpRight size={12} />
          </a>
        )}
        {isSignedIn && !canHost && (
          <a href={verifyUrl} style={linkButton(t)}>
            Finish verifying to host <ArrowUpRight size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

function linkButton(t: ReturnType<typeof getTiRadioTokens>) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '7px 12px',
    borderRadius: 10,
    background: `${t.ACCENT}1A`,
    border: `1px solid ${t.ACCENT}55`,
    color: t.ACCENT,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
  } as const;
}
