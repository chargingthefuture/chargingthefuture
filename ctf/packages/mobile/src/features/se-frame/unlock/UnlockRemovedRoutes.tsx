// The two other ways to finish Unlock on Android, the copy of the web's unlock-removed-routes.tsx:
// finish with a removed account reported in the Quora census, or bring Quora writing into the
// Knowledge Library. The census and the Knowledge Library open on their 3.0 web pages: the census by
// owner decision (each member fills it in once), the Knowledge Library because 3.1 has no screen yet.

import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_UNLOCK_SCREEN_WORDS as W, seRemovedAccounts, type SeRemovedAccountsBody } from '@ctf/shared';
import { authedFetch } from '../../../auth/authedFetch';
import { openWebPage } from '../../../navigation/openWebPage';
import type { UnlockStyles } from './unlockStyles';
import { seUnlockPost } from './useUnlockScreen';

async function readRemoved(): Promise<{ handles: string[]; readError: string | null }> {
  const res = await authedFetch('/api/quora-deletion-survey/verification', { cache: 'no-store' }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as SeRemovedAccountsBody;
  return seRemovedAccounts(res?.ok === true, body);
}

function useRemovedHandles(): { handles: string[] | null; readError: string | null } {
  const [read, setRead] = useState<{ handles: string[] | null; readError: string | null }>({ handles: null, readError: null });
  useEffect(() => {
    let canceled = false;
    void readRemoved().then((next) => {
      if (!canceled) setRead(next);
    });
    return () => {
      canceled = true;
    };
  }, []);
  return read;
}

export function UnlockRemovedRoutes({ s, onFinished }: { s: UnlockStyles; onFinished: () => void }) {
  const { handles, readError } = useRemovedHandles();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function finishWith(handle: string) {
    setBusy(handle);
    const failed = await seUnlockPost('/api/quora-deletion-survey/verification', { removedHandle: handle }, W.finishFailed);
    setBusy(null);
    setError(failed);
    if (!failed) onFinished();
  }

  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.sectionTitle}>
        {W.removedTitle}
      </Text>
      <Text style={s.text}>{W.removedText}</Text>
      {handles === null ? <Text style={s.note}>{W.removedLoading}</Text> : null}
      {handles && handles.length > 0 ? (
        <View style={s.chips}>
          {handles.map((handle) => (
            <TouchableOpacity key={handle} accessibilityRole="button" disabled={busy !== null} onPress={() => void finishWith(handle)} style={[s.secondary, busy !== null ? s.busy : null]}>
              <Text style={s.secondaryLabel}>{busy === handle ? W.sending : W.finishWith(handle)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {handles && handles.length === 0 ? (
        <Text style={s.text}>
          {W.censusLead}{' '}
          <Text accessibilityRole="link" style={s.link} onPress={() => void openWebPage(W.censusHref, 'unlock')}>
            {W.census}
          </Text>
          {W.censusTail}
        </Text>
      ) : null}
      <Text style={s.text}>
        {W.knowledgeLead}{' '}
        <Text accessibilityRole="link" style={s.link} onPress={() => void openWebPage(W.knowledgeHref, 'unlock')}>
          {W.knowledge}
        </Text>
        {W.knowledgeTail}
      </Text>
      {[readError, error].filter(Boolean).map((message) => (
        <Text key={message} accessibilityRole="alert" style={s.error}>
          {message}
        </Text>
      ))}
    </View>
  );
}
