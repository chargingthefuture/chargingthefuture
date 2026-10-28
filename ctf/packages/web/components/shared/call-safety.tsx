'use client';

import { useState, type ReactNode } from 'react';
import { BackgroundFiltersProvider, useBackgroundFilters } from '@stream-io/video-react-sdk';
import { reportError } from 'lib/observability/report';

// The 3.1 call controls (owner-approved plan, Personal controls and safety): background blur,
// picture in picture, and one-tap block and report. Shared so every video call carries the same ones.
//
// The blur model and its WebAssembly are served by this app from /video-filters, copied out of the
// installed @stream-io/video-filters-web package at build time (scripts/copy-video-filters.mjs), so
// a call never fetches code from a third-party server.

export const VIDEO_FILTERS_BASE_PATH = '/video-filters';

export function CallFiltersProvider({ area, children }: { area: string; children: ReactNode }) {
  return (
    <BackgroundFiltersProvider
      basePath={VIDEO_FILTERS_BASE_PATH}
      backgroundBlurLevel="high"
      onError={(error: unknown) => reportError(error, { area, op: 'background_blur' })}
    >
      {children}
    </BackgroundFiltersProvider>
  );
}

type PillProps = { label: string; pressed?: boolean; onClick: () => void; disabled?: boolean; color: string; border: string };

function Pill({ label, pressed, onClick, disabled, color, border }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      style={{ minHeight: 40, padding: '6px 14px', borderRadius: 999, border: `1px solid ${border}`, background: pressed ? `${color}22` : 'transparent', color, fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}
    >
      {label}
    </button>
  );
}

// Blurs what is behind the member on their own camera. Shows nothing on a browser that cannot run it.
export function BlurBackgroundToggle({ color, border }: { color: string; border: string }) {
  const { isSupported, isReady, applyBackgroundBlurFilter, disableBackgroundFilter } = useBackgroundFilters();
  const [on, setOn] = useState(false);
  if (!isSupported) return null;
  return (
    <Pill
      label={on ? 'Blur on' : isReady ? 'Blur background' : 'Blur loading…'}
      pressed={on}
      disabled={!isReady}
      color={color}
      border={border}
      onClick={() => {
        if (on) disableBackgroundFilter();
        else applyBackgroundBlurFilter('high');
        setOn(!on);
      }}
    />
  );
}

// Puts one video into its own small window that stays on top while the member uses other apps.
export async function openPictureInPicture(container: HTMLElement | null): Promise<string | null> {
  const video = container?.querySelector('video');
  if (!video || !document.pictureInPictureEnabled) return 'This browser cannot show the call in its own window.';
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await video.requestPictureInPicture();
    return null;
  } catch (error) {
    return `The call could not open in its own window: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Block the other person and send a safety report in one step, then leave. The block hides each
// from the other across the app; the report goes to the System Architect's safety queue.
export function BlockAndReportButton({
  accountId,
  name,
  onDone,
  color,
}: {
  accountId: string;
  name: string;
  onDone: () => void;
  color: string;
}) {
  const [state, setState] = useState<'idle' | 'confirm' | 'sending'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/account/blocks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ blockedUserId: accountId, safetyConcern: true, safetyDetail: 'Reported from a video call.' }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(`${body?.message ?? 'The server returned an error'} (HTTP ${res.status})`);
      }
      onDone();
    } catch (e) {
      setError(`Could not block and report: ${e instanceof Error ? e.message : String(e)}`);
      setState('confirm');
    }
  }

  if (state === 'idle') {
    return <Pill label="Block and report" color={color} border={`${color}55`} onClick={() => setState('confirm')} />;
  }
  return (
    <div role="group" aria-label={`Block and report ${name}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color }}>Block {name}, report them and leave the call?</span>
      <Pill label={state === 'sending' ? 'Sending…' : 'Yes'} disabled={state === 'sending'} color={color} border={`${color}55`} onClick={() => void send()} />
      <Pill label="Cancel" disabled={state === 'sending'} color={color} border={`${color}55`} onClick={() => setState('idle')} />
      {error ? <span role="alert" style={{ fontSize: 12, color }}>{error}</span> : null}
    </div>
  );
}
