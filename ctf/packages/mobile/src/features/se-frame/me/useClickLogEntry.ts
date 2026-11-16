// The state behind the 3.1 "Log what happened" sheet on Android, the copy of the web's
// use-click-log-entry.ts: what the 3.0 ClickLog form holds, read and sent through the same routes
// (GET /api/click-log for whether "Not listed" is offered, GET /api/click-log/preferences for the
// sharing default, POST /api/click-log to log). Location comes from the phone through expo-location.

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import * as ExpoLocation from 'expo-location';
import { SE_CLICK_LOG_WORDS as W, clickLogCreateBody, type ClickLogLocation } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';

export type GeoStatus = 'idle' | 'locating' | 'error';

function reason(caught: unknown): string {
  return caught instanceof Error && caught.message ? caught.message : 'the connection failed';
}

async function errorText(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return typeof body.error === 'string' && body.error ? body.error : fallback;
}

function useClickLogSetup() {
  const [loading, setLoading] = useState(true);
  const [canSuggestScheme, setCanSuggestScheme] = useState(false);
  const [shareDefault, setShareDefault] = useState<boolean | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    const fail = (text: string) => live && setProblems((list) => [...list, text]);
    const access = authedFetch('/api/click-log')
      .then(async (res) => {
        if (!res.ok) return fail(W.loadFailed(await errorText(res, `HTTP ${res.status}`)));
        const data = (await res.json()) as { canSuggestScheme?: boolean };
        if (live) setCanSuggestScheme(data.canSuggestScheme === true);
      })
      .catch((caught: unknown) => fail(W.loadFailed(reason(caught))));
    const share = authedFetch('/api/click-log/preferences')
      .then(async (res) => {
        if (!res.ok) return fail(`${W.shareDefaultFailed} (${await errorText(res, `HTTP ${res.status}`)})`);
        const data = (await res.json()) as { shareWithOwner?: boolean };
        if (live && typeof data.shareWithOwner === 'boolean') setShareDefault(data.shareWithOwner);
      })
      .catch((caught: unknown) => fail(`${W.shareDefaultFailed} (${reason(caught)})`));
    void Promise.all([access, share]).then(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);
  return { loading, canSuggestScheme, shareDefault, problems };
}

const TIMED_OUT = 'timed-out';

// The phone's position, with the same 10 second limit as the web form.
async function readPosition(): Promise<ClickLogLocation> {
  const permission = await ExpoLocation.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw new Error(W.locationBlockedPhone);
  if (!(await ExpoLocation.hasServicesEnabledAsync())) throw new Error(W.noLocationPhone);
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(TIMED_OUT)), 10000));
  const pos = await Promise.race([ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced }), timeout]);
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

function locationError(caught: unknown): string {
  const text = caught instanceof Error ? caught.message : '';
  if (text === TIMED_OUT) return W.locationTimeout;
  if (text === W.locationBlockedPhone || text === W.noLocationPhone) return text;
  return W.locationUnavailable;
}

function useLocation() {
  const [location, setLocation] = useState<ClickLogLocation>({});
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    setStatus('locating');
    setError(null);
    readPosition()
      .then((found) => {
        setLocation(found);
        setStatus('idle');
      })
      .catch((caught: unknown) => {
        setLocation({});
        setError(locationError(caught));
        setStatus('error');
      });
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
      const res = await authedFetch('/api/click-log', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await errorText(res, W.logFailed));
      setSaved(true);
      AccessibilityInfo.announceForAccessibility(W.saved);
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : W.logFailed;
      setError(text);
      AccessibilityInfo.announceForAccessibility(text);
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
