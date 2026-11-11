'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_ME_WORDS as W, type SeMeProfile, type SeMePrompts } from '@ctf/shared';
import { failureText, responseFailureText } from 'lib/errors/client-failure';

// The top of Me (GET /api/account/me): since when, badges, the three profile lines and whether the
// Quora census was answered; and saving the lines (PUT).

export type MeProfileState = { kind: 'loading' } | { kind: 'ready'; profile: SeMeProfile } | { kind: 'error'; message: string };

const URL = '/api/account/me';

export function useMeProfile() {
  const [state, setState] = useState<MeProfileState>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    fetch(URL, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const message = await responseFailureText(res, W.profileFailed, 'member');
          if (active) setState({ kind: 'error', message });
          return;
        }
        const body = (await res.json()) as { profile: SeMeProfile };
        if (active) setState({ kind: 'ready', profile: body.profile });
      })
      .catch((error: unknown) => {
        const message = failureText(error, { area: 'se-frame', op: 'me_profile', fallback: W.profileFailed, audience: 'member' });
        if (active) setState({ kind: 'error', message });
      });
    return () => {
      active = false;
    };
  }, []);

  // Resolves null when saved, or the reason it was not.
  const savePrompts = useCallback(async (prompts: SeMePrompts): Promise<string | null> => {
    try {
      const res = await fetch(URL, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
        body: JSON.stringify(prompts),
      });
      if (!res.ok) return await responseFailureText(res, W.promptsFailed, 'member');
      const body = (await res.json()) as { prompts: SeMePrompts };
      setState((prev) => (prev.kind === 'ready' ? { kind: 'ready', profile: { ...prev.profile, prompts: body.prompts } } : prev));
      return null;
    } catch (error) {
      return failureText(error, { area: 'se-frame', op: 'me_prompts_save', fallback: W.promptsFailed, audience: 'member' });
    }
  }, []);

  return { state, savePrompts };
}
