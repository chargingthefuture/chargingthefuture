// "Can't find your Quora profile URL?" — copied from the web's UnlockQuoraHelp
// (components/unlock/unlock-quora-help.tsx) as it shows on the Unlock screen: the note, the
// "Show me where to find it" steps with the picture, the optional hint box and the button.
//
// The web button records the request and opens the Commons with a full page load at "/". Here it
// records the request and calls `onGoHome`, which re-runs the Unlock check and takes the member to
// the app's home, the Android counterpart of "/".

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { HelpCircle, Loader2 } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { requestUnlockHelp } from './api';
import { openWebCommons } from './openWebCommons';
import { getUnlockTokens, type UnlockTokens } from './unlock-tokens';
import { QUORA_URL_HELP_IMAGE_ALT, QUORA_URL_HELP_ORDER, QUORA_URL_HELP_STEPS, QUORA_URL_HELP_SVG } from './quora-url-help';

const QUORA_HINT_MAX_LENGTH = 300;
const BODY =
  'You don’t have to work it out alone. Open the Commons and ask — real people are in there, and I’ll help you find your profile link. You can come back and finish this whenever you’re ready.';
const FAILED = 'Could not open the Commons just now. Try again.';

type Styles = ReturnType<typeof makeStyles>;

function HelpSteps({ s }: { s: Styles }) {
  const [open, setOpen] = useState(false);
  // The picture fills the note's width at the picture's own 640 by 400 shape, as the web's
  // width: 100%; height: auto does.
  const [imageWidth, setImageWidth] = useState(0);
  return (
    <View style={s.steps} onLayout={(e) => setImageWidth(e.nativeEvent.layout.width)}>
      <TouchableOpacity onPress={() => setOpen((prev) => !prev)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={s.stepsSummary}>{open ? '▾' : '▸'} Show me where to find it</Text>
      </TouchableOpacity>
      {open ? (
        <>
          <View accessible accessibilityLabel={QUORA_URL_HELP_IMAGE_ALT} style={[s.image, { width: imageWidth, height: imageWidth * 0.625 }]}>
            <SvgXml xml={QUORA_URL_HELP_SVG} width="100%" height="100%" />
          </View>
          {QUORA_URL_HELP_ORDER.map((key) => {
            const block = QUORA_URL_HELP_STEPS[key];
            return (
              <View key={key} style={s.block}>
                <Text style={s.blockHeading}>{block.heading}</Text>
                <View style={s.list}>
                  {block.steps.map((step, i) => (
                    <View key={step} style={s.listItem}>
                      <Text style={s.listMarker}>{i + 1}.</Text>
                      <Text style={s.listText}>{step}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

export function UnlockQuoraHelp({ alreadyVerified = false, onGoHome }: { alreadyVerified?: boolean; onGoHome: () => void }) {
  const { tokens } = useTheme();
  const tok = getUnlockTokens(tokens);
  const s = useMemo(() => makeStyles(tokens, tok), [tokens, tok]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState('');

  if (alreadyVerified) return null;

  async function askForHelp() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failure = await requestUnlockHelp(hint, FAILED);
    if (failure) {
      setError(failure);
      setBusy(false);
      return;
    }
    // The request is recorded; the member asks in the Commons, which is on the web (owner decision,
    // 2026-10-09). onGoHome then re-runs the Unlock check so the app behind the browser lets them in.
    await openWebCommons();
    setBusy(false);
    onGoHome();
  }

  return (
    <View accessibilityRole="summary" style={s.note}>
      <View style={s.titleRow}>
        <HelpCircle size={16} color={tok.ACCENT} />
        <Text style={s.title}>Can’t find your Quora profile URL?</Text>
      </View>
      <Text style={s.body}>{BODY}</Text>
      <HelpSteps s={s} />
      <Text style={s.hintLabel}>Anything that helps me find you on Quora (optional)</Text>
      <TextInput
        value={hint}
        onChangeText={setHint}
        maxLength={QUORA_HINT_MAX_LENGTH}
        placeholder="The name on your Quora account, or a link to anything you posted"
        placeholderTextColor={tok.MUTED}
        style={[s.hintInput, hint ? s.hintInputFilled : null]}
      />
      <Text style={s.hintHelp}>
        It doesn’t have to be a link. A name or an email is enough for me to look you up and approve you by hand.
      </Text>
      <TouchableOpacity onPress={() => void askForHelp()} disabled={busy} accessibilityRole="button" style={[s.button, busy ? s.buttonBusy : null]}>
        {busy ? <Loader2 size={14} color="#fff" /> : <HelpCircle size={14} color="#fff" />}
        <Text style={s.buttonText}>{busy ? 'Opening the Commons…' : 'Ask for help in the Commons'}</Text>
      </TouchableOpacity>
      {error ? (
        <Text style={s.error}>
          {error}{' '}
          <Text style={s.errorLink} onPress={() => void openWebCommons()} accessibilityRole="link">Try opening the Commons anyway</Text>
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(t: ThemeTokens, tok: UnlockTokens) {
  const r = (n: number) => (t.isComic ? 0 : n);
  return StyleSheet.create({
    note: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 16, borderRadius: r(12), backgroundColor: `${tok.ACCENT}14`, borderWidth: 1.5, borderColor: `${tok.ACCENT}66`, flexShrink: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    title: { flexShrink: 1, fontSize: 14, fontFamily: interFamily('800'), color: tok.TITLE },
    body: { fontSize: 13, lineHeight: 20.8, fontFamily: interFamily('400'), color: tok.MUTED, marginBottom: 10 },
    steps: { marginBottom: 12 },
    stepsSummary: { fontSize: 13, fontFamily: interFamily('700'), color: tok.ACCENT },
    image: { marginVertical: 10, borderRadius: r(10), overflow: 'hidden' },
    block: { marginBottom: 8 },
    blockHeading: { fontSize: 13, fontFamily: interFamily('700'), color: tok.TITLE },
    list: { marginTop: 4 },
    listItem: { flexDirection: 'row' },
    listMarker: { width: 20, fontSize: 13, lineHeight: 20.8, fontFamily: interFamily('400'), color: tok.MUTED },
    listText: { flex: 1, fontSize: 13, lineHeight: 20.8, fontFamily: interFamily('400'), color: tok.MUTED },
    hintLabel: { fontSize: 13, fontFamily: interFamily('700'), color: tok.TITLE, marginBottom: 6 },
    hintInput: { paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6, borderRadius: r(10), backgroundColor: tok.INPUT_BG, borderWidth: 1, borderColor: tok.BORDER_SOLID, color: tok.TITLE, fontSize: 14, fontFamily: interFamily('400') },
    hintInputFilled: { borderColor: `${tok.ACCENT}80` },
    hintHelp: { fontSize: 12, lineHeight: 19.2, fontFamily: interFamily('400'), color: tok.MUTED, marginBottom: 12 },
    button: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: r(10), backgroundColor: tok.ACCENT },
    buttonBusy: { opacity: 0.6 },
    buttonText: { fontSize: 14, fontFamily: interFamily('700'), color: '#fff' },
    error: { fontSize: 12, lineHeight: 19.2, fontFamily: interFamily('400'), color: '#F87171', marginTop: 8 },
    errorLink: { color: tok.ACCENT, fontFamily: interFamily('700'), textDecorationLine: 'underline' },
  });
}
