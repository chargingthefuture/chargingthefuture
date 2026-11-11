// A notice in Needs you with its answer in place, the copy of the web (components/se-frame/activity/
// need-card.tsx): a Just us two request shows the asker's picture and Agree / Not now; a Recurring
// Activity invite shows Confirm / That's not right; the day-14 notice shows its one-tap keep-up.

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SeActivityButtonLook, SeActivityNeed, SeThemeTokens } from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { SE_FONT } from '../fonts';
import { useActivityAnswer } from './useActivity';

export function NeedCard({ t, need, onRead }: { t: SeThemeTokens; need: SeActivityNeed; onRead: (_id: string, _keepShown: boolean) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { status, answer } = useActivityAnswer((keepShown) => onRead(need.item.id, keepShown));
  const busy = status.kind === 'busy';
  return (
    <View accessibilityLabel={need.item.summary} style={[s.need, need.partnerId ? s.needStrong : null]}>
      <View style={s.head}>
        {need.partnerId ? (
          <View style={s.avatar}>
            <SeAvatar accountId={need.partnerId} size={36} />
          </View>
        ) : null}
        <Text style={s.text}>{need.item.summary}</Text>
      </View>
      {status.kind === 'done' ? (
        <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={s.note}>
          {status.text}
        </Text>
      ) : (
        <View style={s.buttons}>
          {need.buttons.map((button) => (
            <TouchableOpacity
              key={button.label}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => void answer(button)}
              style={[s.button, s[button.look], busy ? s.disabled : null]}
            >
              <Text style={labelStyle(s, button.look)}>{busy && status.label === button.label ? button.busy : button.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {status.kind === 'error' ? (
        <Text accessibilityRole="alert" style={s.note}>
          {status.text}
        </Text>
      ) : null}
    </View>
  );
}

function labelStyle(s: ReturnType<typeof makeStyles>, look: SeActivityButtonLook) {
  if (look === 'primary') return s.primaryLabel;
  return look === 'raised' ? s.raisedLabel : s.quietLabel;
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    need: { gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: t.hair, backgroundColor: t.card },
    needStrong: { borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    avatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
    text: { flex: 1, fontSize: 14, lineHeight: 20, color: t.ink, fontFamily: SE_FONT.sans },
    buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5 },
    primary: { borderColor: t.line, backgroundColor: t.btn },
    raised: { borderColor: t.line, backgroundColor: t.card, boxShadow: `0px 2px 0px ${t.line}` },
    quiet: { borderColor: t.hair, backgroundColor: 'transparent' },
    disabled: { opacity: 0.6 },
    primaryLabel: { fontSize: 13, color: t.onBtn, fontFamily: SE_FONT.sansBold },
    raisedLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansBold },
    quietLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    note: { fontSize: 13, lineHeight: 18, color: t.soft, fontFamily: SE_FONT.sans },
  });
}
