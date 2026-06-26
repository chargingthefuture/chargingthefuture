import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Linking, Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fetchList, toggleEndorsement, type WhatWorksProblem, type WhatWorksProduct, type WhatWorksStats } from './api';
import { WW } from './theme';

type NavLike = { navigate: (_screen: string) => void };

const EMPTY_STATS: WhatWorksStats = { problems: 0, verifiedTools: 0, survivorsHelped: 0 };

// purchaseUrl comes from survivor-submitted suggestions; guard against unsupported or malformed
// schemes so openURL can't produce an unhandled promise rejection.
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

function ToolCard({ product, busy, onToggle }: { product: WhatWorksProduct; busy: boolean; onToggle: (_product: WhatWorksProduct) => void }) {
  return (
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
          <Text style={styles.verifiedText}>{product.verifiedCount} survivors verified</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable disabled={busy} onPress={() => onToggle(product)} style={styles.helpful}>
            <Ionicons name={product.viewerHasEndorsed ? 'thumbs-up' : 'thumbs-up-outline'} size={13} color={product.viewerHasEndorsed ? WW.brand : WW.subtle} />
            <Text style={[styles.helpfulText, { color: product.viewerHasEndorsed ? WW.brand : WW.subtle }]}>{product.viewerHasEndorsed ? 'Helped me' : 'Helpful'}</Text>
          </Pressable>
          <Pressable onPress={() => { void openLink(product.purchaseUrl); }} style={styles.viewBtn}>
            <Text style={styles.viewText}>View</Text>
            <Ionicons name="open-outline" size={12} color={WW.brand} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function WhatWorksList({ navigation }: { navigation?: NavLike }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<WhatWorksProblem[]>([]);
  const [stats, setStats] = useState<WhatWorksStats>(EMPTY_STATS);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchList();
      setProblems(data.problems ?? []);
      setStats(data.stats ?? EMPTY_STATS);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = async (product: WhatWorksProduct) => {
    setBusyId(product.id);
    try {
      const next = await toggleEndorsement(product.id, product.viewerHasEndorsed);
      setProblems((prev) => prev.map((problem) => ({
        ...problem,
        products: problem.products.map((item) => (item.id === product.id ? { ...item, ...next } : item)),
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={WW.brand} /></View>;
  }

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
        <Text style={styles.h1}>What actually works.</Text>
        <Text style={styles.lede}>Pick a problem. Underneath are specific tools a survivor here used and said helped — with a direct link to get it.</Text>
        <View style={styles.chipRow}>
          {[`${stats.problems} problems`, `${stats.verifiedTools} tools`, 'Survivor-verified'].map((chip) => (
            <React.Fragment key={chip}>
              <View style={styles.chip}><Text style={styles.chipText}>{chip}</Text></View>
            </React.Fragment>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {problems.length === 0 ? (
          <Text style={styles.empty}>The list is just getting started. Add the first tool that worked for you.</Text>
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
                    <ToolCard product={product} busy={busyId === product.id} onToggle={onToggle} />
                  </React.Fragment>
                ))}
              </View>
            </React.Fragment>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.suggestBtn} onPress={() => navigation?.navigate('Suggest')}>
          <Ionicons name="add" size={16} color={WW.brandInk} />
          <Text style={styles.suggestText}>Suggest an item</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WW.bg },
  center: { flex: 1, backgroundColor: WW.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0D0F14', borderBottomWidth: 1, borderBottomColor: WW.border },
  headerTitle: { fontSize: 16, fontWeight: '700', color: WW.text },
  verifiedBadge: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, backgroundColor: 'rgba(132,204,22,0.12)', borderWidth: 1, borderColor: 'rgba(132,204,22,0.3)' },
  verifiedBadgeText: { fontSize: 10.5, fontWeight: '700', color: WW.brand },
  h1: { fontSize: 21, fontWeight: '800', color: WW.text, marginBottom: 6 },
  lede: { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: WW.surface, borderWidth: 1, borderColor: WW.border },
  chipText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  error: { color: '#fecaca', marginTop: 12 },
  empty: { color: WW.subtle, marginTop: 18, fontSize: 13, lineHeight: 20 },
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
  helpful: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  helpfulText: { fontSize: 11, fontWeight: '600' },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(132,204,22,0.18)', borderWidth: 1, borderColor: 'rgba(132,204,22,0.4)' },
  viewText: { fontSize: 11.5, fontWeight: '700', color: WW.brand },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: WW.border, backgroundColor: '#0D0F14' },
  suggestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 10, backgroundColor: WW.brand },
  suggestText: { fontSize: 13, fontWeight: '700', color: WW.brandInk },
});
