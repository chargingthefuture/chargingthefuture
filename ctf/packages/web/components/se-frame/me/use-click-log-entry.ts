'use client';

import { useEffect, useState } from 'react';
import { SE_CLICK_LOG_WORDS as W, clickLogCreateBody, type ClickLogLocation } from '@ctf/shared';
import { reasonText } from 'lib/errors/client-failure';

// The state behind the 3.1 "Log what happened" sheet: what the 3.0 ClickLog form holds, read and
// sent through the same routes (GET /api/click-log for whether "Not listed" is offered, GET
// /api/click-log/preferences for the sharing default, POST /api/click-log to log).

export type GeoStatus = 'idle' | 'locating' | 'error';

async function errorText(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return typeof body.error === 'string' && body.error ? body.error : fallback;
}

function geoErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return W.locationBlockedWeb;
  if (err.code === err.TIMEOUT) return W.locationTimeout;
  return W.locationUnavailable;
}

// Whether "Not listed" is offered and the member's sharing default. Either failing is named; the
// form still works without them.
function useClickLogSetup() {
  const [loading, setLoading] = useState(true);
  const [canSuggestScheme, setCanSuggestScheme] = useState(false);
  const [shareDefault, setShareDefault] = useState<boolean | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    const fail = (text: string) => live && setProblems((list) => [...list, text]);
    const access = fetch('/api/click-log')
      .then(async (res) => {
        if (!res.ok) return fail(W.loadFailed(await errorText(res, `HTTP ${res.status}`)));
        const data = (await res.json()) as { canSuggestScheme?: boolean };
        if (live) setCanSuggestScheme(data.canSuggestScheme === true);
      })
      .catch((caught: unknown) => fail(W.loadFailed(reasonText(caught))));
    const share = fetch('/api/click-log/preferences')
      .then(async (res) => {
        if (!res.ok) return fail(`${W.shareDefaultFailed} (${await errorText(res, `HTTP ${res.status}`)})`);
        const data = (await res.json()) as { shareWithOwner?: boolean };
        if (live && typeof data.shareWithOwner === 'boolean') setShareDefault(data.shareWithOwner);
      })
      .catch((caught: unknown) => fail(`${W.shareDefaultFailed} (${reasonText(caught)})`));
    void Promise.all([access, share]).then(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);
  return { loading, canSuggestScheme, shareDefault, problems };
}

function useLocation() {
  const [location, setLocation] = useState<ClickLogLocation>({});
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(W.noLocationWeb);
      return setStatus('error');
    }
    setStatus('locating');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setStatus('idle');
      },
      (err) => {
        setLocation({});
        setError(geoErrorMessage(err));
        setStatus('error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };
  const reset = () => {
    setLocation({});
    setStatus('idle');
    setError(null);
  };
  return { location, status, error, added: typeof location.latitude === 'number', add, reset };
}

export function useClickLogEntry() {
  const setup = useClickLogSetup();
  const geo = useLocation();
  const [note, setNote] = useState('');
  const [problemTags, setProblemTags] = useState<string[]>([]);
  const [schemeTags, setSchemeTags] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState('');
  const [quoraUrl, setQuoraUrl] = useState('');
  const [shareChoice, setShareChoice] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const share = shareChoice ?? setup.shareDefault ?? false;

  const reset = () => {
    setNote('');
    setProblemTags([]);
    setSchemeTags([]);
    setSuggestion('');
    setQuoraUrl('');
    setShareChoice(null);
    setError(null);
    setSaved(false);
    geo.reset();
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const body = clickLogCreateBody({ location: geo.location, note, sharedWithOwner: share, problemTags, schemeTags, schemeSuggestion: suggestion, schemeQuoraUrl: quoraUrl });
    try {
      const res = await fetch('/api/click-log', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await errorText(res, W.logFailed));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : W.logFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    setup,
    geo,
    fields: { note, problemTags, schemeTags, suggestion, quoraUrl, share },
    set: { note: setNote, problemTags: setProblemTags, schemeTags: setSchemeTags, suggestion: setSuggestion, quoraUrl: setQuoraUrl, share: setShareChoice },
    submitting,
    error,
    saved,
    submit,
    reset,
  };
}

export type ClickLogEntry = ReturnType<typeof useClickLogEntry>;
