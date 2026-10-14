// The Offer tab, copied from the web OfferSkillsPanel (foundation-offer-skills.tsx): the listing blurb,
// the instant connection settings, then the member's Directory skills, each one turned on or off for
// Foundation's provider search.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ShieldCheck } from 'lucide-react-native';
import { fetchOfferableSkills, saveOfferedSkills, type OfferableSkill } from './FoundationDataApi';
import { InstantCallSettings, ProviderDescriptionSettings } from './FoundationOfferSettings';
import { ErrorBanner, GradientPanel } from './FDParts';
import { alpha, font, useFDTheme } from './useFDTheme';

function useOfferableSkills() {
  const [skills, setSkills] = useState<OfferableSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOfferableSkills()
      .then(setSkills)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load your skills.'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = useCallback(async (skill: OfferableSkill) => {
    if (savingId) return;
    setSavingId(skill.id);
    setError(null);
    const next = skills.map((s) => (s.id === skill.id ? { ...s, offered: !s.offered } : s));
    const offeredIds = next.filter((s) => s.offered).map((s) => s.id);
    setSkills(next);
    try {
      // The server drops any skill not on the member's own Directory profile; show what it kept.
      const accepted = new Set((await saveOfferedSkills(offeredIds)) ?? offeredIds);
      setSkills((curr) => curr.map((item) => ({ ...item, offered: accepted.has(item.id) })));
    } catch (caught) {
      setSkills(skills);
      setError(caught instanceof Error ? caught.message : 'Could not save. Please try again.');
    } finally {
      setSavingId(null);
    }
  }, [savingId, skills]);

  return { skills, loading, error, savingId, toggle };
}

function SkillRow({ skill: s, saving, onToggle }: { skill: OfferableSkill; saving: boolean; onToggle: () => void }) {
  const { t, r } = useFDTheme();
  return (
    <Pressable
      disabled={saving}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: s.offered, disabled: saving }}
      style={[styles.row, { borderRadius: r(12), opacity: saving ? 0.6 : 1, backgroundColor: s.offered ? alpha(t.ACCENT, '12') : 'rgba(255,255,255,0.02)', borderColor: s.offered ? alpha(t.ACCENT, '40') : t.BORDER_STRONG }]}
    >
      <View style={[styles.box, { borderRadius: r(6), backgroundColor: s.offered ? t.ACCENT : 'transparent', borderColor: s.offered ? t.ACCENT : 'rgba(255,255,255,0.2)' }]}>
        {s.offered ? <Check size={14} color="#1a1205" /> : null}
      </View>
      <Text style={[font(14, '600'), styles.flex, { color: t.TITLE }]}>{s.name}</Text>
      <Text style={[font(12), { color: s.offered ? t.ACCENT : t.MUTED }]}>{s.offered ? 'Offering' : 'Off'}</Text>
    </Pressable>
  );
}

export function OfferSkillsPanel() {
  const { t } = useFDTheme();
  const { skills, loading, error, savingId, toggle } = useOfferableSkills();
  const offeredCount = skills.filter((s) => s.offered).length;
  return (
    <View>
      <ProviderDescriptionSettings />
      <InstantCallSettings />
      <GradientPanel>
        <View style={styles.titleRow}>
          <ShieldCheck size={18} color={t.ACCENT} />
          <Text style={[font(20, '800'), { color: t.TITLE }]}>Offer your skills</Text>
        </View>
        <Text style={[font(14), { color: t.SUBTLE }]}>
          Turn on the skills you&apos;re willing to be contacted about. Only these put you in Foundation&apos;s provider search — survivors only reach out to people who said yes.
        </Text>
      </GradientPanel>
      {error ? <ErrorBanner text={error} style={styles.mb16} /> : null}
      {loading ? (
        <Text style={[font(14), styles.loading, { color: t.MUTED }]}>Loading your skills…</Text>
      ) : skills.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[font(15, '600'), styles.center, { color: t.SUBTLE }]}>No skills on your Directory profile yet</Text>
          <Text style={[font(13), styles.center, { color: t.FAINT }]}>Add skills to your Directory profile first — then you can offer them here.</Text>
        </View>
      ) : (
        <>
          <Text style={[font(12), styles.mb12, { color: t.MUTED }]}>{offeredCount} of {skills.length} offered</Text>
          <View style={styles.list}>
            {skills.map((s) => <SkillRow key={s.id} skill={s} saving={savingId === s.id} onToggle={() => void toggle(s)} />)}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
  loading: { padding: 48, textAlign: 'center' },
  empty: { paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1 },
  box: { width: 22, height: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
