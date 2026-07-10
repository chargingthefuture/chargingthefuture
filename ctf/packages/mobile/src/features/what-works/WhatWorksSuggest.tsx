import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fetchProblems, suggestProduct, type WhatWorksProblemOption } from './api';
import { WW } from './theme';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';

export function WhatWorksSuggest() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('what-works', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);

  const [problems, setProblems] = useState<WhatWorksProblemOption[]>([]);
  const [problemId, setProblemId] = useState('');
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [why, setWhy] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchProblems();
        setProblems(data.problems ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ready = Boolean(problemId && name.trim() && link.trim());

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await suggestProduct({ problemId, name: name.trim(), purchaseUrl: link.trim(), note: why.trim() });
      setProblemId('');
      setName('');
      setLink('');
      setWhy('');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={accent} /></View>;
  }

  if (done) {
    return (
      <View style={styles.center}>
        <View style={styles.doneCircle}><Ionicons name="checkmark" size={30} color={accent} /></View>
        <Text style={styles.doneTitle}>Suggestion submitted</Text>
        <Text style={styles.doneBody}>A reviewer will check it before it joins the shared list.</Text>
        <Pressable style={styles.submitBtn} onPress={() => setDone(false)}>
          <Ionicons name="add" size={15} color={WW.brandInk} />
          <Text style={styles.submitText}>Add another</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>Suggest a tool that worked.</Text>
      <Text style={styles.lede}>Pick the problem it solves, add the product and a direct link, and a short note on why it helped.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Problem it solves *</Text>
      <View style={styles.chipWrap}>
        {problems.map((problem) => {
          const active = problem.id === problemId;
          return (
            <Pressable key={problem.id} onPress={() => setProblemId(problem.id)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{problem.emoji ? `${problem.emoji} ` : ''}{problem.title}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>New problems are added by admins to avoid duplicates.</Text>

      <Text style={styles.label}>Product name *</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Sony WH-1000XM5" placeholderTextColor={tokens.textSecondary} style={styles.input} />

      <Text style={styles.label}>Direct purchase link *</Text>
      <TextInput value={link} onChangeText={setLink} placeholder="https://…" placeholderTextColor={tokens.textSecondary} autoCapitalize="none" keyboardType="url" style={styles.input} />

      <Text style={styles.label}>Why it works (optional)</Text>
      <TextInput value={why} onChangeText={setWhy} placeholder="A short note from your experience." placeholderTextColor={tokens.textSecondary} multiline style={[styles.input, { height: 84, textAlignVertical: 'top' }]} />

      <Pressable disabled={!ready || submitting} onPress={submit} style={[styles.submitBtn, (!ready || submitting) && styles.submitDisabled]}>
        <Ionicons name="send" size={15} color={ready && !submitting ? WW.brandInk : tokens.textSecondary} />
        <Text style={[styles.submitText, (!ready || submitting) && { color: tokens.textSecondary }]}>{submitting ? 'Submitting…' : 'Submit for review'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    center: { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    h1: { fontSize: 21, fontWeight: '800', color: t.textPrimary, marginBottom: 8 },
    lede: { fontSize: 13, color: t.textSecondary, lineHeight: 20, marginBottom: 16 },
    error: { color: '#fecaca', marginBottom: 12 },
    label: { fontSize: 12.5, fontWeight: '600', color: '#9CA3AF', marginTop: 14, marginBottom: 7 },
    helper: { fontSize: 10.5, color: t.textSecondary, marginTop: 6 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: t.border },
    chipActive: { borderColor: accent, backgroundColor: 'rgba(132,204,22,0.12)' },
    chipText: { fontSize: 12.5, color: '#9CA3AF', fontWeight: '500' },
    chipTextActive: { color: t.textPrimary, fontWeight: '600' },
    input: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: t.border, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, color: t.textPrimary, fontSize: 14 },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 11, backgroundColor: accent, marginTop: 20 },
    submitDisabled: { backgroundColor: t.borderFaint },
    submitText: { fontSize: 14.5, fontWeight: '700', color: WW.brandInk },
    doneCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(132,204,22,0.15)', borderWidth: 1, borderColor: 'rgba(132,204,22,0.3)', alignItems: 'center', justifyContent: 'center' },
    doneTitle: { fontSize: 20, fontWeight: '800', color: t.textPrimary },
    doneBody: { fontSize: 13, color: t.textSecondary, lineHeight: 20, textAlign: 'center' },
  });
}
