// One card in Today, the Android copy of the web's today-card.tsx: tapping the text opens it in
// place, the buttons open the item, and the ••• menu holds Copy link and Hide.

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { SE_MUTE_WORDS, type SeThemeTokens, type SeTodayCard } from '@ctf/shared';
import { SeAvatar } from '../../../components/shared/SeAvatar';
import { getApiBaseUrl } from '../../../auth/authedFetch';
import { SE_FONT } from '../fonts';

function absolute(href: string): string {
  return href.startsWith('http') ? href : `${getApiBaseUrl()}${href}`;
}

type Styles = ReturnType<typeof makeStyles>;

function CardMenu({ s, card, onHide, onMute }: { s: Styles; card: SeTodayCard; onHide: () => void; onMute?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={s.menu} accessibilityRole="menu">
      <TouchableOpacity
        accessibilityRole="menuitem"
        style={s.menuItem}
        onPress={() => {
          void Clipboard.setStringAsync(absolute(card.href)).then(() => setCopied(true));
        }}
      >
        <Text style={s.menuLabel}>{copied ? 'Link copied' : 'Copy link'}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="menuitem" style={s.menuItem} onPress={onHide}>
        <Text style={s.menuLabel}>Hide</Text>
      </TouchableOpacity>
      {onMute && card.author ? (
        <TouchableOpacity accessibilityRole="menuitem" style={s.menuItem} onPress={onMute}>
          <Text style={s.menuLabel}>{SE_MUTE_WORDS.mutePerson(card.author.handle)}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function TodayCard({
  t,
  card,
  read,
  onRead,
  onHide,
  onMute,
  onOpenLink,
}: {
  t: SeThemeTokens;
  card: SeTodayCard;
  read: boolean;
  onRead: () => void;
  onHide: () => void;
  onMute?: () => void;
  onOpenLink: (_href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const color = t.kind[card.kind];
  const s = makeStyles(t);

  return (
    <View style={s.card}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <View style={s.head}>
        {card.author ? <SeAvatar accountId={card.author.accountId} size={28} /> : null}
        {card.author ? <Text style={s.handle}>{card.author.handle}</Text> : null}
        <Text style={[s.label, { color }]}>{card.label}</Text>
        <View style={s.spacer} />
        {read ? (
          <View style={[s.check, { backgroundColor: color }]} accessibilityRole="image" accessibilityLabel="Read">
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M5 12l5 5 9-10" stroke={t.bg} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </View>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={onMute ? 'More: copy link, hide, mute' : 'More: copy link, hide'}
          accessibilityState={{ expanded: menu }}
          onPress={() => setMenu((value) => !value)}
          style={s.menuButton}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Circle cx={5} cy={12} r={1.8} fill={t.ink} />
            <Circle cx={12} cy={12} r={1.8} fill={t.ink} />
            <Circle cx={19} cy={12} r={1.8} fill={t.ink} />
          </Svg>
        </TouchableOpacity>
      </View>
      {menu ? <CardMenu s={s} card={card} onHide={onHide} onMute={onMute} /> : null}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((value) => !value);
          onRead();
        }}
        style={s.text}
      >
        <Text style={s.title}>{card.title}</Text>
        {card.body ? (
          <Text style={s.body} numberOfLines={open ? undefined : 3}>
            {card.body}
          </Text>
        ) : null}
      </TouchableOpacity>
      {card.actions.length > 0 ? (
        <View style={s.actions}>
          {card.actions.map((item) => (
            <TouchableOpacity
              key={item.kind + item.label}
              accessibilityRole="link"
              style={s.action}
              onPress={() => {
                onRead();
                onOpenLink(item.href);
              }}
            >
              <Text style={s.actionLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(t: SeThemeTokens) {
  return StyleSheet.create({
    card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.hair },
    dot: { position: 'absolute', left: -40, top: 12, width: 28, height: 28, borderRadius: 14 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    handle: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
    label: { fontSize: 12, fontFamily: SE_FONT.sansBold, flexShrink: 1 },
    spacer: { flex: 1 },
    check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    menuButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    menu: { alignSelf: 'flex-end', padding: 6, borderRadius: 14, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line, boxShadow: `0px 3px 0px ${t.line}` },
    menuItem: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
    menuLabel: { fontSize: 14, color: t.ink, fontFamily: SE_FONT.sans },
    text: { gap: 6 },
    title: { fontSize: 17, lineHeight: 22, color: t.ink, fontFamily: SE_FONT.sansBold },
    body: { fontSize: 14, lineHeight: 20, color: t.soft, fontFamily: SE_FONT.sans },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    action: {
      minHeight: 44,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: t.line,
      backgroundColor: t.card,
      boxShadow: `0px 2px 0px ${t.line}`,
    },
    actionLabel: { fontSize: 13, color: t.ink, fontFamily: SE_FONT.sansSemi },
  });
}
