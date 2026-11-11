// Activity on Android, the copy of the web (web components/se-frame/activity/, approved board
// "Activity"): what needs the member, answered in place, then what happened today and earlier,
// each with its icon and full date and time. Opening an item marks it read and follows its link.

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  SE_ACTIVITY_ICON_PATHS,
  SE_ACTIVITY_WORDS as W,
  seActivityIcon,
  seActivityTint,
  seActivityView,
  seActivityWhen,
  type SeActivityItem,
  type SeThemeTokens,
} from '@ctf/shared';
import type { FeatureKey } from '../../../navigation/screens';
import { openTodayLink } from '../today/openTodayLink';
import { SE_FONT } from '../fonts';
import { NeedCard } from './NeedCard';
import { useActivity } from './useActivity';

type Styles = ReturnType<typeof makeStyles>;

function Row({ s, t, item, onOpen }: { s: Styles; t: SeThemeTokens; item: SeActivityItem; onOpen: (_item: SeActivityItem) => void }) {
  const icon = seActivityIcon(item.notificationType);
  return (
    <TouchableOpacity accessibilityRole={item.linkPath ? 'link' : 'button'} onPress={() => onOpen(item)} style={s.row}>
      <View style={[s.icon, { backgroundColor: seActivityTint(t, icon) }]}>
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d={SE_ACTIVITY_ICON_PATHS[icon]} />
        </Svg>
      </View>
      <View style={s.rowText}>
        <Text style={s.summary}>{item.summary}</Text>
        <Text style={s.when}>{seActivityWhen(item.createdAtIso)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function Group({ s, t, title, items, onOpen }: { s: Styles; t: SeThemeTokens; title: string; items: SeActivityItem[]; onOpen: (_item: SeActivityItem) => void }) {
  if (items.length === 0) return null;
  return (
    <View accessibilityLabel={title}>
      <Text accessibilityRole="header" style={s.groupTitle}>
        {title}
      </Text>
      {items.map((item) => (
        <Row key={item.id} s={s} t={t} item={item} onOpen={onOpen} />
      ))}
    </View>
  );
}

export function ActivityScreen({ t, onOpen }: { t: SeThemeTokens; onOpen: (_key: FeatureKey) => void }) {
  const s = useMemo(() => makeStyles(t), [t]);
  const { state, reload, markRead } = useActivity();
  if (state.kind === 'loading') return <Text style={s.text}>{W.loading}</Text>;
  if (state.kind === 'error') {
    return (
      <Text accessibilityRole="alert" style={s.text}>
        {W.failed} {state.message}{' '}
        <Text accessibilityRole="button" onPress={() => void reload()} style={s.link}>
          {W.tryAgain}
        </Text>
      </Text>
    );
  }
  if (state.items.length === 0) return <Text style={s.text}>{W.empty}</Text>;
  const view = seActivityView(state.items);
  const open = (item: SeActivityItem) => {
    markRead(item.id);
    if (item.linkPath) openTodayLink(item.linkPath, onOpen);
  };
  return (
    <>
      {view.needs.length > 0 ? (
        <View accessibilityLabel={W.needs} style={s.needs}>
          {view.needs.map((need) => (
            <NeedCard key={need.item.id} t={t} need={need} onRead={markRead} />
          ))}
        </View>
      ) : null}
      <Group s={s} t={t} title={W.today} items={view.today} onOpen={open} />
      <Group s={s} t={t} title={W.earlier} items={view.earlier} onOpen={open} />
      <Text style={s.end}>{W.end}</Text>
    </>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    needs: { gap: 14 },
    groupTitle: { marginTop: 4, fontSize: 13, color: t.soft, fontFamily: SE_FONT.sansBold },
    row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44, paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: t.hair },
    icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1, gap: 2 },
    summary: { fontSize: 14, lineHeight: 20, color: t.ink, fontFamily: SE_FONT.sans },
    when: { fontSize: 12, color: t.soft, fontFamily: SE_FONT.sans },
    text: { fontSize: 15, lineHeight: 21, color: t.soft, fontFamily: SE_FONT.sans },
    end: { paddingTop: 4, fontSize: 13, lineHeight: 18, textAlign: 'center', color: t.soft, fontFamily: SE_FONT.sans },
    link: { color: t.ink, textDecorationLine: 'underline', fontFamily: SE_FONT.sansBold },
  });
}
