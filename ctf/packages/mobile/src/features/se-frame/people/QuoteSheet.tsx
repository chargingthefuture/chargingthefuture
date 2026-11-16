// Request a quote on Android, the copy of the web's quote-sheet.tsx: the Foundation flow in the 3.1
// look, with every state the Foundation profile has.

import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SE_PERSON_SHEET_WORDS as W, type SeQuoteProvider, type SeThemeTokens } from '@ctf/shared';
import { PersonSheetFrame, SheetStatus } from './PersonSheetFrame';
import { makePersonSheetStyles, type PersonSheetStyles } from './personSheetStyles';
import { sendQuoteRequest, useQuoteProvider } from './usePersonSheets';

type Send = { kind: 'idle' } | { kind: 'sending' } | { kind: 'failed'; message: string } | { kind: 'sent' };

function Details({ s, provider }: { s: PersonSheetStyles; provider: SeQuoteProvider }) {
  return (
    <>
      <View style={s.who}>
        <Text accessibilityRole="header" style={s.name}>
          {provider.displayName}
        </Text>
        {provider.headline ? <Text style={s.headline}>{provider.headline}</Text> : null}
      </View>
      {provider.shortDescription ? <Text style={s.bio}>{provider.shortDescription}</Text> : null}
      {provider.offeredSkills.length > 0 ? (
        <View style={s.section}>
          <Text accessibilityRole="header" style={s.label}>
            {W.offers}
          </Text>
          <View style={s.chips}>
            {provider.offeredSkills.map((skill) => (
              <Text key={skill} style={s.offer}>
                {skill}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      {provider.bio ? (
        <View style={s.section}>
          <Text accessibilityRole="header" style={s.label}>
            {W.about}
          </Text>
          <Text style={s.bio}>{provider.bio}</Text>
        </View>
      ) : null}
      <View style={s.note}>
        <Text style={s.noteText}>
          <Text style={s.strong}>{W.goodToKnow}</Text> {W.goodToKnowText}
        </Text>
      </View>
    </>
  );
}

function Offer({ s, provider, viewerUserId }: { s: PersonSheetStyles; provider: SeQuoteProvider; viewerUserId: string | null }) {
  const [send, setSend] = useState<Send>({ kind: 'idle' });
  const own = viewerUserId !== null && viewerUserId === provider.providerUserId;
  const disabled = own || send.kind === 'sending' || send.kind === 'sent';
  const submit = () => {
    setSend({ kind: 'sending' });
    sendQuoteRequest(provider)
      .then(() => setSend({ kind: 'sent' }))
      .catch((error: unknown) => setSend({ kind: 'failed', message: error instanceof Error ? error.message : W.requestFailed }));
  };
  return (
    <>
      <Details s={s} provider={provider} />
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled, busy: send.kind === 'sending' }} disabled={disabled} onPress={submit} style={[s.primary, disabled ? s.disabled : null]}>
        <Text style={s.primaryLabel}>{send.kind === 'sending' ? W.requesting : W.request}</Text>
      </TouchableOpacity>
      {own ? <Text style={s.soft}>{W.ownProfile}</Text> : null}
      {send.kind === 'failed' ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.done}>
          {send.message}
        </Text>
      ) : null}
      {send.kind === 'sent' ? (
        <Text accessibilityLiveRegion="polite" style={s.done}>
          {W.requested(provider.displayName)}
        </Text>
      ) : null}
    </>
  );
}

export function QuoteSheet({ t, profileId, name, onClose }: { t: SeThemeTokens; profileId: string; name: string; onClose: () => void }) {
  const s = useMemo(() => makePersonSheetStyles(t), [t]);
  const [attempt, setAttempt] = useState(0);
  const read = useQuoteProvider(profileId, attempt);
  return (
    <PersonSheetFrame t={t} s={s} title={W.quoteTitle} label={W.openQuote(name)} onClose={onClose}>
      <SheetStatus
        s={s}
        loading={read.kind === 'loading' ? W.loadingProvider : null}
        failed={read.kind === 'failed' ? read.message : null}
        onRetry={() => setAttempt((n) => n + 1)}
      />
      {read.kind === 'ready' ? <Offer s={s} provider={read.value.provider} viewerUserId={read.value.viewerUserId} /> : null}
    </PersonSheetFrame>
  );
}
