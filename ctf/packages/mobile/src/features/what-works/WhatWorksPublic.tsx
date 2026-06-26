import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Linking, Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fetchPublicList, type WhatWorksProblem } from './api';
import { WW } from './theme';

// Public/unauthenticated state — mirrors the web `WhatWorksPublic` flow. The shared list is
// readable by anyone, so a signed-out visitor sees the same teaser slice the web shows
// (from /api/what-works/public, no bearer token) plus a sign-in/sign-up gate to see the full
// list and to suggest. Closes the parity gap with web (issue #935).

const TRUST: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }[] = [
  { icon: 'shield-checkmark-outline', title: 'Survivor-verified', detail: 'Used by a real member who said it helped.' },
  { icon: 'ban-outline', title: 'No ads or affiliates', detail: 'Nothing here is sponsored.' },
  { icon: 'lock-closed-outline', title: 'Anonymous', detail: 'Suggesting never reveals who you are.' },
];

async function openLink(url: string): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Could not open this link.');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open this link.');
  }
}

export function WhatWorksPublic({ onSignIn }: { onSignIn?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [problems, setProblems] = useState<WhatWorksProblem[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await fetchPublicList();
      setProblems(data.problems ?? []);
    } catch {
      // The teaser is best-effort; a fetch failure just leaves the empty/sign-in gate.
      setProblems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Ionicons name="list" size={17} color={WW.brand} />
        <Text style={styles.headerTitle}>What Works</Text>
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle-outline" size={11} color={WW.brand} />
          <Text style={styles.verifiedBadgeText}>Verified</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.h1}>The tools that actually work.</Text>
        <Text style={styles.lede}>
          Pick a problem you&apos;re facing. Underneath it is a list of specific products a survivor here
          bought, used, and said helped — each with a direct link to get it. No ads. No affiliates.
        </Text>

        <Pressable style={styles.joinBtn} onPress={onSignIn}>
          <Ionicons name="person-add-outline" size={15} color={WW.brandInk} />
          <Text style={styles.joinText}>Join to suggest items</Text>
        </Pressable>

        <View style={styles.trustCard}>
          <Text style={styles.trustHeading}>Why trust this list?</Text>
          {TRUST.map((item) => (
            <React.Fragment key={item.title}>
              <View style={styles.trustRow}>
                <Ionicons name={item.icon} size={15} color={WW.brand} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trustTitle}>{item.title}</Text>
                  <Text style={styles.trustDetail}>{item.detail}</Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={styles.listHead}>
          <Text style={styles.listHeadTitle}>A look at the list</Text>
          <Text style={styles.listHeadNote}>publicly readable — no account needed to browse</Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={WW.brand} /></View>
        ) : problems.length === 0 ? (
          <Text style={styles.empty}>The list is just getting started. Be the first to add what worked for you.</Text>
        ) : (
          problems.map((problem) => (
            <React.Fragment key={problem.id}>
              <View style={{ marginTop: 18 }}>
                <View style={styles.problemHead}>
                  <View style={styles.problemEmoji}><Text style={styles.emoji}>{problem.emoji || '🧰'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.problemTitle}>{problem.title}</Text>
                    {problem.context ? <Text style={styles.problemContext}>{problem.context}</Text> : null}
                  </View>
                </View>
                {problem.products.map((product) => (
                  <React.Fragment key={product.id}>
                    <View style={styles.card}>
                      <View style={styles.cardTop}>
                        <View style={styles.emojiBox}><Text style={styles.emoji}>{product.emoji || '🧰'}</Text></View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.productName}>{product.name}</Text>
                          {product.kind ? <Text style={styles.kind}>{product.kind}</Text> : null}
                        </View>
                      </View>
                      {product.note ? <Text style={styles.note}>{`“${product.note}”`}</Text> : null}
                      <View style={styles.cardRow}>
                        <View style={styles.verifiedWrap}>
                          <Ionicons name="shield-checkmark-outline" size={13} color={WW.brand} />
                          <Text style={styles.verifiedText}>{product.verifiedCount} verified</Text>
                        </View>
                        <Pressable onPress={() => { void openLink(product.purchaseUrl); }} style={styles.viewBtn}>
                          <Text style={styles.viewText}>View</Text>
                          <Ionicons name="open-outline" size={12} color={WW.brand} />
                        </Pressable>
                      </View>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </React.Fragment>
          ))
        )}

        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>See every problem — and add what worked for you</Text>
          <Text style={styles.ctaDetail}>Create a free, verified account to view the full list and suggest the tools that helped you.</Text>
          <Pressable style={styles.ctaBtn} onPress={onSignIn}>
            <Text style={styles.ctaBtnText}>Get started</Text>
            <Ionicons name="chevron-forward" size={14} color={WW.brandInk} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WW.bg },
  center: { paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D0F14', borderBottomWidth: 1, borderBottomColor: WW.border },
  headerTitle: { fontSize: 16, fontWeight: '700', color: WW.text },
  verifiedBadge: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, backgroundColor: 'rgba(132,204,22,0.12)', borderWidth: 1, borderColor: 'rgba(132,204,22,0.3)' },
  verifiedBadgeText: { fontSize: 10.5, fontWeight: '700', color: WW.brand },
  h1: { fontSize: 21, fontWeight: '800', color: WW.text, marginBottom: 6 },
  lede: { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 10, backgroundColor: WW.brand, marginTop: 14 },
  joinText: { fontSize: 14, fontWeight: '700', color: WW.brandInk },
  trustCard: { marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: WW.surface, borderWidth: 1, borderColor: WW.border },
  trustHeading: { fontSize: 13, fontWeight: '700', color: WW.brand, marginBottom: 12 },
  trustRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  trustTitle: { fontSize: 12.5, fontWeight: '600', color: WW.text, marginBottom: 2 },
  trustDetail: { fontSize: 11.5, color: WW.subtle, lineHeight: 17 },
  listHead: { marginTop: 22, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  listHeadTitle: { fontSize: 13, fontWeight: '700', color: WW.text },
  listHeadNote: { fontSize: 11.5, color: WW.subtle },
  empty: { color: WW.subtle, marginTop: 16, fontSize: 13, lineHeight: 20 },
  problemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 11 },
  problemEmoji: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(132,204,22,0.12)', borderWidth: 1, borderColor: 'rgba(132,204,22,0.25)', alignItems: 'center', justifyContent: 'center' },
  problemTitle: { fontSize: 14.5, fontWeight: '700', color: WW.text },
  problemContext: { fontSize: 11.5, color: WW.subtle, lineHeight: 17, marginTop: 2 },
  card: { padding: 13, borderRadius: 13, backgroundColor: WW.surface, borderWidth: 1, borderColor: WW.border, marginBottom: 10 },
  cardTop: { flexDirection: 'row', gap: 11 },
  emojiBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: WW.border, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
  productName: { fontSize: 13.5, fontWeight: '700', color: WW.text },
  kind: { fontSize: 11, color: WW.subtle },
  note: { fontSize: 12, color: WW.quote, lineHeight: 18, marginTop: 9, fontStyle: 'italic' },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 },
  verifiedWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifiedText: { fontSize: 11, color: WW.brand, fontWeight: '600' },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(132,204,22,0.18)', borderWidth: 1, borderColor: 'rgba(132,204,22,0.4)' },
  viewText: { fontSize: 11.5, fontWeight: '700', color: WW.brand },
  ctaCard: { marginTop: 24, padding: 18, borderRadius: 14, backgroundColor: 'rgba(132,204,22,0.06)', borderWidth: 1, borderColor: 'rgba(132,204,22,0.25)' },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: WW.text, marginBottom: 4 },
  ctaDetail: { fontSize: 12.5, color: WW.subtle, lineHeight: 18 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: WW.brand, marginTop: 14 },
  ctaBtnText: { fontSize: 13.5, fontWeight: '700', color: WW.brandInk },
});

export default WhatWorksPublic;
