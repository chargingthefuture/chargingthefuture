'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_SETTINGS_WORDS as W, type SeNotifyGroup, type SeQuietHours } from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';
import { ensureDeviceSubscribed } from '../../notifications/device-push';

// Settings → Notifications: the three rows and quiet hours, saved on the account
// (/api/notifications/preferences). Turning a row on also makes sure this browser can be pinged.

export type NotifyState = { replies: boolean; rooms: boolean; other: boolean; quiet: SeQuietHours | null };
type Answer = { preferences: { pushReplies: boolean; pushRooms: boolean; pushOther: boolean; quiet: SeQuietHours | null } };

const URL = '/api/notifications/preferences';
const FIELD: Record<SeNotifyGroup, string> = { replies: 'pushReplies', rooms: 'pushRooms', other: 'pushOther' };

function fromAnswer(body: Answer): NotifyState {
  const p = body.preferences;
  return { replies: p.pushReplies, rooms: p.pushRooms, other: p.pushOther, quiet: p.quiet };
}

export function useNotifyPrefs() {
  const [state, setState] = useState<NotifyState | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(URL, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await responseFailureText(res, W.readFailed, 'member'));
        if (active) setState(fromAnswer((await res.json()) as Answer));
      })
      .catch((error: unknown) => {
        if (active) setNote(error instanceof Error ? error.message : W.readFailed);
      });
    return () => {
      active = false;
    };
  }, []);

  const put = useCallback(async (body: Record<string, unknown>) => {
    try {
      const res = await fetch(URL, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' }, body: JSON.stringify(body) });
      if (!res.ok) return setNote(await responseFailureText(res, W.saveFailed, 'member'));
      setState(fromAnswer((await res.json()) as Answer));
    } catch (error) {
      setNote(failureText(error, { area: 'se-frame', op: 'notify_prefs_save', fallback: W.saveFailed, audience: 'member' }));
    }
  }, []);

  const toggle = useCallback(
    (group: SeNotifyGroup) => {
      if (!state) return;
      const on = !state[group];
      setNote(null);
      // Asked for first, while the tap still counts, so the browser shows its permission prompt.
      if (on) void ensureDeviceSubscribed(true).then((problem) => problem && setNote(problem));
      void put({ [FIELD[group]]: on });
    },
    [state, put],
  );

  const setQuiet = useCallback((quiet: SeQuietHours | null) => void put({ quiet }), [put]);

  return { state, note, toggle, setQuiet };
}
