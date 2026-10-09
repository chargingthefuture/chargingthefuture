// Two notes from the web Unlock screen, copied as they render there:
//   - UnlockBanPolicy   web components/unlock/unlock-ban-policy.tsx — closed by default, "Read" opens it.
//   - SurveyInviteNote  web components/shared/survey-invite-note.tsx ('card') — the invitation to the
//     Quora account-removal survey. The survey is a web page with no Android screen, so its button
//     opens that page in the browser.

import React, { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArchiveX, ShieldAlert } from 'lucide-react-native';
import { useTheme, type ThemeTokens } from '../../theme';
import { interFamily } from '../../components/ui';
import { getApiBaseUrl } from '../../auth/authedFetch';
import { reportError } from '../../observability/report';
import { getUnlockTokens, type UnlockTokens } from './unlock-tokens';

const QUORA_SURVEY_PUBLIC_PATH = '/survey/quora-account-deletions';

export function UnlockBanPolicy() {
  const { tokens } = useTheme();
  const tok = getUnlockTokens(tokens);
  const s = useMemo(() => makeStyles(tokens, tok), [tokens, tok]);
  const [open, setOpen] = useState(false);
  return (
    <View style={s.ban}>
      <TouchableOpacity onPress={() => setOpen((prev) => !prev)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={s.banToggle}>
        <ShieldAlert size={14} color={tok.MUTED} />
        <Text style={s.banTitle}>What gets an account banned</Text>
        <Text style={s.banAction}>{open ? 'Hide' : 'Read'}</Text>
      </TouchableOpacity>
      {open ? (
        <View style={s.banBody}>
          <Text style={[s.banPara, s.banGap]}>
            Signing up to harass people here gets the account banned. That includes the address it is signed up with — an address chosen to mock somebody is the harassment, not a preamble to it.
          </Text>
          <Text style={[s.banPara, s.banGap]}>
            Running a second account when you already have one gets the second one banned. Your first is untouched.
          </Text>
          <Text style={[s.banPara, s.banGap, { color: tok.TITLE }]}>
            Not finishing this step is not one of them. An account that never sends a profile address stays where it is, with the access that carries, for as long as it takes. Nobody is removed for being slow, for not finding their profile address, or for asking for help instead.
          </Text>
          <Text style={s.banPara}>
            A ban closes the account rather than this app alone, so anything else you sign into with it closes too. It is not a deletion and it can be lifted.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

async function openSurvey(): Promise<void> {
  try {
    await Linking.openURL(`${getApiBaseUrl()}${QUORA_SURVEY_PUBLIC_PATH}`);
  } catch (caught) {
    reportError(caught, { area: 'unlock', op: 'open_survey' });
    Alert.alert('Unable to open', 'We could not open the survey in your browser.');
  }
}

export function SurveyInviteNote({ accent, muted, title }: { accent: string; muted: string; title: string }) {
  const { tokens } = useTheme();
  const r = (n: number) => (tokens.isComic ? 0 : n);
  return (
    <View
      accessibilityRole="summary"
      style={{ marginTop: 16, paddingVertical: 14, paddingHorizontal: 16, borderRadius: r(12), backgroundColor: `${accent}0D`, borderWidth: 1, borderColor: `${accent}33`, flexShrink: 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <ArchiveX size={16} color={accent} />
        <Text style={{ flexShrink: 1, fontSize: 14, fontFamily: interFamily('800'), color: title }}>Have your Quora accounts been removed?</Text>
      </View>
      <Text style={{ fontSize: 13, lineHeight: 20.8, fontFamily: interFamily('400'), color: muted, marginBottom: 10 }}>
        People writing about being targeted keep losing their accounts. If that happened to you, the survey records which ones and when — one place where the removals are written down instead of forgotten.
      </Text>
      <TouchableOpacity
        onPress={() => void openSurvey()}
        accessibilityRole="link"
        style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 14, borderRadius: r(10), borderWidth: 1, borderColor: `${accent}55` }}
      >
        <Text style={{ fontSize: 13, fontFamily: interFamily('700'), color: accent }}>Tell us which accounts</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(t: ThemeTokens, tok: UnlockTokens) {
  return StyleSheet.create({
    ban: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: t.isComic ? 0 : 10, backgroundColor: tok.SURFACE, borderWidth: 1, borderColor: tok.BORDER_SOLID },
    banToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    banTitle: { flex: 1, fontSize: 13, fontFamily: interFamily('700'), color: tok.TITLE },
    banAction: { fontSize: 12, fontFamily: interFamily('400'), color: tok.MUTED },
    banBody: { marginTop: 10 },
    banPara: { fontSize: 12, lineHeight: 20.4, fontFamily: interFamily('400'), color: tok.MUTED },
    banGap: { marginBottom: 8 },
  });
}
