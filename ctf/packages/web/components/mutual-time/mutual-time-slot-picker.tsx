'use client';

import { useMemo, useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { MUTUAL_TIME_MAX_PICKS } from 'lib/mutual-time/constants';
import type { MutualTimePublicEvent } from 'lib/mutual-time/types';
import {
  getMutualTimeTokens,
  formatSlotTime,
  formatSlotDate,
  formatSlotRange,
  localDateKey,
  localPeriod,
} from './mutual-time-shared';

type Tokens = ReturnType<typeof getMutualTimeTokens>;
type VotePeriod = { label: string; order: number; slots: string[] };

// The candidate-slot picker: the count row, the day chips, and the grid of one-hour windows for the
// chosen day. Lives in its own file because two surfaces render it — an approved member votes with it,
// and a signed-out visitor sees the same thing grayed out behind the sign-in prompt, so the link shows
// what they'd be picking from instead of only a locked box.
//
// `disabled` makes the whole picker inert: nothing responds to a tap, nothing takes keyboard focus, and
// screen readers skip it (the surface around it carries the real message). Everything is still laid out
// exactly as a voter sees it.

// Colors for one time button: picked, unavailable (already at the pick limit), or plain.
function slotColors(isSel: boolean, isDis: boolean, t: Tokens): React.CSSProperties {
  return {
    background: isSel ? `${t.ACCENT}22` : t.SURFACE,
    border: `1px solid ${isSel ? t.ACCENT : t.BORDER_SOLID}`,
    color: isSel ? t.ACCENT : isDis ? t.SUBTLE : t.TITLE,
    fontWeight: isSel ? 700 : 400,
  };
}

function SlotButton({ iso, isSel, isDis, dimmed, disabled, toggle, tz, t }: { iso: string; isSel: boolean; isDis: boolean; dimmed: boolean; disabled: boolean; toggle: (iso: string) => void; tz: string; t: Tokens }) {
  return (
    <button
      onClick={() => !isDis && toggle(iso)}
      disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      style={{ ...slotColors(isSel, isDis, t), padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: isDis ? 'not-allowed' : 'pointer', opacity: dimmed ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {isSel && <Check size={11} />}
      {formatSlotTime(iso, tz)}
    </button>
  );
}

function SlotGrid({ periods, picks, atMax, toggle, tz, disabled, t }: { periods: VotePeriod[]; picks: string[]; atMax: boolean; toggle: (iso: string) => void; tz: string; disabled: boolean; t: Tokens }) {
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${t.BORDER_SOLID}`, background: t.HEADER, marginBottom: 16, overflow: 'hidden' }}>
      {periods.length === 0 ? (
        <div style={{ padding: 14, color: t.SUBTLE, fontSize: 13 }}>No times on this day.</div>
      ) : (
        periods.map((period) => (
          <div key={period.order} style={{ padding: '10px 14px', borderBottom: `1px solid ${t.BORDER_SOLID}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.SUBTLE, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{period.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {period.slots.map((iso) => {
                const isSel = picks.includes(iso);
                const isDis = disabled || (!isSel && atMax);
                // The preview is already faded as a whole, so only fade a button here when it is a live
                // form and the member has used up their picks.
                return <SlotButton key={iso} iso={iso} isSel={isSel} isDis={isDis} dimmed={!disabled && isDis} disabled={disabled} toggle={toggle} tz={tz} t={t} />;
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function PicksSummary({ picks, tz, toggle, t }: { picks: string[]; tz: string; toggle: (iso: string) => void; t: Tokens }) {
  if (picks.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.SUBTLE, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your picks</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[...picks].sort().map((iso) => (
          <div key={iso} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}40`, fontSize: 13, color: t.TITLE }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={12} style={{ color: t.ACCENT }} /> {formatSlotDate(iso, tz)} · {formatSlotRange(iso, tz)}
            </span>
            <button onClick={() => toggle(iso)} style={{ background: 'transparent', border: 'none', color: t.SUBTLE, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SlotPicker({ event, tz, picks, toggle, disabled = false, t }: { event: MutualTimePublicEvent; tz: string; picks: string[]; toggle: (iso: string) => void; disabled?: boolean; t: Tokens }) {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const atMax = picks.length >= MUTUAL_TIME_MAX_PICKS;

  // Group candidate slots by the viewer's LOCAL date, then by local period. Recomputed when tz changes.
  const { dateKeys, dateLabels, slotsByDate } = useMemo(() => {
    const byDate = new Map<string, string[]>();
    const labels = new Map<string, string>();
    for (const iso of event.candidateSlots) {
      const key = localDateKey(iso, tz);
      if (!byDate.has(key)) {
        byDate.set(key, []);
        labels.set(key, formatSlotDate(iso, tz));
      }
      byDate.get(key)!.push(iso);
    }
    const keys = Array.from(byDate.keys()).sort();
    return { dateKeys: keys, dateLabels: labels, slotsByDate: byDate };
  }, [event.candidateSlots, tz]);

  const currentDate = activeDate && dateKeys.includes(activeDate) ? activeDate : dateKeys[0] ?? null;

  const periods = useMemo(() => {
    if (!currentDate) return [] as VotePeriod[];
    const groups = new Map<number, VotePeriod>();
    for (const iso of slotsByDate.get(currentDate) ?? []) {
      const p = localPeriod(iso, tz);
      if (!groups.has(p.order)) {
        groups.set(p.order, { label: p.label, order: p.order, slots: [] });
      }
      groups.get(p.order)!.slots.push(iso);
    }
    return Array.from(groups.values()).sort((a, b) => a.order - b.order);
  }, [currentDate, slotsByDate, tz]);

  const picksOnDate = (key: string) => picks.filter((p) => localDateKey(p, tz) === key).length;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.TITLE }}>Pick up to {MUTUAL_TIME_MAX_PICKS} one-hour windows you&apos;re free</span>
        {!disabled && <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: atMax ? t.ACCENT : t.SUBTLE }}>{picks.length} of {MUTUAL_TIME_MAX_PICKS} selected</span>}
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }}>
        {dateKeys.map((key) => {
          const isActive = key === currentDate;
          const count = picksOnDate(key);
          return (
            <button
              key={key}
              onClick={() => !disabled && setActiveDate(key)}
              disabled={disabled}
              tabIndex={disabled ? -1 : undefined}
              style={{ position: 'relative', flexShrink: 0, padding: '7px 12px', borderRadius: 6, background: isActive ? `${t.ACCENT}22` : t.SURFACE, border: `1px solid ${isActive ? t.ACCENT : t.BORDER_SOLID}`, color: isActive ? t.ACCENT : t.SUBTLE, fontSize: 12, fontWeight: isActive ? 700 : 400, cursor: disabled ? 'default' : 'pointer' }}
            >
              {dateLabels.get(key)}
              {count > 0 && <span style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: '50%', background: t.ACCENT, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>}
            </button>
          );
        })}
      </div>

      <SlotGrid periods={periods} picks={picks} atMax={atMax} toggle={toggle} tz={tz} disabled={disabled} t={t} />
    </>
  );
}
