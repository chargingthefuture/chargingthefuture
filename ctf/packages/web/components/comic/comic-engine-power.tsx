'use client';

import { useCallback, useEffect, useState } from 'react';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import styles from './comic-review-dashboard.module.css';

const ROUTE = '/api/comic/admin/engine-power';

type EnginePowerResponse =
  | { ok: true; available: false; reason: string }
  | { ok: true; available: true; endpointId: string; workersMax: number; on: boolean };

// The drafting endpoint's on/off switch in the review queue header. RunPod sets an endpoint with no
// requests for two weeks to 0 max workers, and drafts then time out; this turns it back on.
export function ComicEnginePower() {
  const [state, setState] = useState<EnginePowerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(ROUTE, { cache: 'no-store' });
      if (!response.ok) {
        setError(await responseFailureText(response, 'Could not read whether the drafting endpoint is on'));
        return;
      }
      setState((await response.json()) as EnginePowerResponse);
      setError(null);
    } catch (caught) {
      setError(failureText(caught, { area: 'comic', op: 'engine_power_get', fallback: 'Could not read whether the drafting endpoint is on' }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flip = async (on: boolean) => {
    setBusy(true);
    try {
      const response = await fetch(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify({ on }),
      });
      if (!response.ok) {
        setError(await responseFailureText(response, `Could not turn the drafting endpoint ${on ? 'on' : 'off'}`));
        return;
      }
      setState((await response.json()) as EnginePowerResponse);
      setError(null);
    } catch (caught) {
      setError(failureText(caught, { area: 'comic', op: 'engine_power_set', fallback: `Could not turn the drafting endpoint ${on ? 'on' : 'off'}` }));
    } finally {
      setBusy(false);
    }
  };

  if (!state && !error) {
    return null;
  }

  return (
    <div className={styles.enginePower}>
      {state && !state.available ? (
        <span className={styles.queueSub}>Drafting endpoint: {state.reason}</span>
      ) : null}
      {state && state.available ? (
        <>
          <span className={state.on ? styles.engineOn : styles.engineOff}>
            Drafting endpoint {state.on ? `on · up to ${state.workersMax} worker${state.workersMax === 1 ? '' : 's'}` : 'off · 0 max workers'}
          </span>
          <button type="button" className={styles.engineButton} disabled={busy} onClick={() => void flip(!state.on)}>
            {busy ? (state.on ? 'Turning off…' : 'Turning on…') : state.on ? 'Turn off' : 'Turn on'}
          </button>
        </>
      ) : null}
      {error ? (
        <span className={styles.engineOff} role="status">{error}</span>
      ) : null}
    </div>
  );
}
