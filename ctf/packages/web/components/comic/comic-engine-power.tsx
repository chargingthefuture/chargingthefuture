'use client';

import { useCallback, useEffect, useState } from 'react';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import styles from './comic-review-dashboard.module.css';

const ROUTE = '/api/comic/admin/engine-power';

type EnginePowerResponse =
  | { ok: true; available: false; reason: string }
  | { ok: true; available: true; endpointId: string; workersMax: number; on: boolean };

type PowerState = { state: EnginePowerResponse | null; error: string | null; busy: boolean; flip: (on: boolean) => Promise<void> };

// Reads the endpoint's state on mount and sends a switch. Failures land in `error` with the reason.
function useEnginePower(): PowerState {
  const [state, setState] = useState<EnginePowerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (init: RequestInit | undefined, fallback: string, op: string) => {
    try {
      const response = await fetch(ROUTE, init ?? { cache: 'no-store' });
      if (!response.ok) {
        setError(await responseFailureText(response, fallback));
        return;
      }
      setState((await response.json()) as EnginePowerResponse);
      setError(null);
    } catch (caught) {
      setError(failureText(caught, { area: 'comic', op, fallback }));
    }
  }, []);

  useEffect(() => {
    void request(undefined, 'Could not read whether the drafting endpoint is on', 'engine_power_get');
  }, [request]);

  const flip = async (on: boolean) => {
    setBusy(true);
    await request(
      { method: 'POST', headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' }, body: JSON.stringify({ on }) },
      `Could not turn the drafting endpoint ${on ? 'on' : 'off'}`,
      'engine_power_set',
    );
    setBusy(false);
  };

  return { state, error, busy, flip };
}

function workersText(workersMax: number): string {
  return `on · up to ${workersMax} worker${workersMax === 1 ? '' : 's'}`;
}

function buttonText(on: boolean, busy: boolean): string {
  if (busy) return on ? 'Turning off…' : 'Turning on…';
  return on ? 'Turn off' : 'Turn on';
}

function PowerLine({ state, busy, flip }: { state: EnginePowerResponse; busy: boolean; flip: (on: boolean) => Promise<void> }) {
  if (!state.available) {
    return <span className={styles.queueSub}>Drafting endpoint: {state.reason}</span>;
  }
  return (
    <>
      <span className={state.on ? styles.engineOn : styles.engineOff}>
        Drafting endpoint {state.on ? workersText(state.workersMax) : 'off · 0 max workers'}
      </span>
      <button type="button" className={styles.engineButton} disabled={busy} onClick={() => void flip(!state.on)}>
        {buttonText(state.on, busy)}
      </button>
    </>
  );
}

// The drafting endpoint's on/off switch in the review queue header. RunPod sets an endpoint with no
// requests for two weeks to 0 max workers, and drafts then time out; this turns it back on.
export function ComicEnginePower() {
  const { state, error, busy, flip } = useEnginePower();
  if (!state && !error) {
    return null;
  }
  return (
    <div className={styles.enginePower}>
      {state ? <PowerLine state={state} busy={busy} flip={flip} /> : null}
      {error ? <span className={styles.engineOff} role="status">{error}</span> : null}
    </div>
  );
}
