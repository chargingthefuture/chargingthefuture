'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import type { getPluginShellTokens } from '@/components/shared/plugin-shell-theme';
import type { ExchangeActivityReading } from 'lib/engagement/exchange-activity';

type Tokens = ReturnType<typeof getPluginShellTokens>;

// The steps on the way to 384, so progress shows long before the goal does. Each step reads a figure
// the daily exchange reading already carries: the first against the best day on record, the rest
// against the typical day (the middle day of the last thirty). A day's count near zero for months
// says nothing; a step reached says something.
type Step = { label: string; threshold: number; measure: 'best' | 'typical' };

const STEPS: Step[] = [
  { label: 'The first day with 10 exchanges', threshold: 10, measure: 'best' },
  { label: 'A typical day of 10', threshold: 10, measure: 'typical' },
  { label: 'A typical day of 38', threshold: 38, measure: 'typical' },
  { label: 'A typical day of 384', threshold: 384, measure: 'typical' },
];

function stepValue(step: Step, reading: ExchangeActivityReading): number {
  return step.measure === 'best' ? (reading.bestDay?.members ?? 0) : reading.typicalDay;
}

function stepNow(step: Step, reading: ExchangeActivityReading): string {
  if (step.measure === 'typical') {
    return `Typical day ${reading.typicalDay}`;
  }
  return reading.bestDay ? `Best day ${reading.bestDay.members}, on ${reading.bestDay.day}` : 'No day on record yet';
}

function stepStatus(reached: boolean, isNext: boolean, now: string): string {
  if (reached) {
    return `Reached · ${now}`;
  }
  return isNext ? `Next step · ${now}` : 'Not yet';
}

function StepRow({
  step,
  index,
  isNext,
  reading,
  tokens: t,
}: {
  step: Step;
  index: number;
  isNext: boolean;
  reading: ExchangeActivityReading;
  tokens: Tokens;
}) {
  const reached = stepValue(step, reading) >= step.threshold;
  const lit = reached || isNext;
  const Icon = reached ? CheckCircle2 : Circle;
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 0',
        borderTop: index === 0 ? 'none' : `1px solid ${t.BORDER}`,
      }}
    >
      <Icon size={18} color={lit ? t.ACCENT : t.SUBTLE} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: isNext ? 700 : 500, color: lit ? t.TITLE : t.SUBTLE }}>
          {index + 1}. {step.label}
        </div>
        <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 2 }}>
          {stepStatus(reached, isNext, stepNow(step, reading))}
        </div>
      </div>
    </li>
  );
}

export function AdoptionSteps({
  reading,
  failed,
  tokens: t,
}: {
  reading: ExchangeActivityReading | null;
  failed: boolean;
  tokens: Tokens;
}) {
  const nextIndex = reading ? STEPS.findIndex((step) => stepValue(step, reading) < step.threshold) : -1;

  return (
    <section
      style={{
        borderRadius: 12,
        background: t.SURFACE,
        border: `1px solid ${t.BORDER}`,
        padding: 14,
        marginBottom: 24,
      }}
    >
      <h2 style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, margin: '0 0 6px' }}>Steps toward 384</h2>
      <p style={{ fontSize: 12, color: t.SUBTLE, margin: '0 0 12px', lineHeight: 1.5 }}>
        384 counts members who delivered something to each other on a day. If an active member trades
        about once a week, a typical day of 384 takes roughly 2,700 active, approved members. Typical
        day is the middle day of the last thirty.
      </p>

      {!reading && (
        <p style={{ fontSize: 13, color: t.SUBTLE, margin: 0 }}>
          {failed ? 'The reading did not load; the reason is shown under Daily exchange below.' : 'Reading the days…'}
        </p>
      )}

      {reading && (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {STEPS.map((step, index) => (
            <StepRow key={step.label} step={step} index={index} isNext={index === nextIndex} reading={reading} tokens={t} />
          ))}
        </ol>
      )}
    </section>
  );
}
