// "Can't find it?" on Android, the copy of the web's unlock-help.tsx: the steps and picture of the
// 3.0 screen, the box for anything that helps find the member on Quora, and the help request
// (POST /api/unlock/help-request), which stops the count. The member stays on this screen.

import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { SE_UNLOCK_SCREEN_WORDS as W, type SeThemeTokens } from '@ctf/shared';
import { QUORA_URL_HELP_IMAGE_ALT, QUORA_URL_HELP_ORDER, QUORA_URL_HELP_STEPS, QUORA_URL_HELP_SVG } from '../../unlock/quora-url-help';
import type { UnlockStyles } from './unlockStyles';
import { seUnlockPost } from './useUnlockScreen';

// The hint's longest length, as the web reads it from lib/unlock/quora-hint.ts.
const HINT_MAX_LENGTH = 300;

function Steps({ s }: { s: UnlockStyles }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={s.toggle}>
        <Text style={s.toggleLabel}>{open ? W.hideSteps : W.showSteps}</Text>
      </TouchableOpacity>
      {open ? (
        <View style={{ gap: 10 }}>
          <View style={s.picture} accessible accessibilityRole="image" accessibilityLabel={QUORA_URL_HELP_IMAGE_ALT}>
            <SvgXml xml={QUORA_URL_HELP_SVG} width="100%" height="100%" />
          </View>
          {QUORA_URL_HELP_ORDER.map((key) => (
            <View key={key} style={{ gap: 4 }}>
              <Text accessibilityRole="header" style={s.stepHeading}>
                {QUORA_URL_HELP_STEPS[key].heading}
              </Text>
              {QUORA_URL_HELP_STEPS[key].steps.map((step, index) => (
                <View key={step} style={s.item}>
                  <Text style={s.text}>{`${index + 1}.`}</Text>
                  <Text style={[s.text, { flex: 1 }]}>{step}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

export function UnlockHelp({ s, t, onAsked }: { s: UnlockStyles; t: SeThemeTokens; onAsked: () => void }) {
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    const failed = await seUnlockPost('/api/unlock/help-request', { quoraHint: hint.trim() }, W.askFailed);
    setBusy(false);
    setError(failed);
    setSent(!failed);
    if (!failed) onAsked();
  }

  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.sectionTitle}>
        {W.helpTitle}
      </Text>
      <Text style={s.text}>{W.helpText}</Text>
      <Steps s={s} />
      <Text style={s.label}>{W.hintLabel}</Text>
      <TextInput
        accessibilityLabel={W.hintLabel}
        style={s.field}
        value={hint}
        maxLength={HINT_MAX_LENGTH}
        placeholder={W.hintPlaceholder}
        placeholderTextColor={t.soft}
        onChangeText={setHint}
        autoCapitalize="none"
      />
      <Text style={s.small}>{W.hintNote}</Text>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void ask()} style={[s.primary, busy ? s.busy : null]}>
        <Text style={s.addLabel}>{busy ? W.asking : W.ask}</Text>
      </TouchableOpacity>
      {sent ? <Text style={s.note}>{W.asked}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
