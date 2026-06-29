import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import {
  fetchAllWorkforceOccupations,
  fetchWorkforceOccupation,
  fetchWorkforceSectorReport,
  fetchWorkforceSkillLevelReport,
  fetchWorkforceSectorDetail,
  fetchWorkforceSkillLevelDetail,
} from './api';
import type {
  WorkforceBucketDetail,
  WorkforceGroupedReportItem,
  WorkforceMatchedMember,
  WorkforceMatchReason,
  WorkforceOccupation,
} from './api';

// Body for the Workforce screen's Occupations / Sectors / Skill Level tabs. This is part of the one
// Workforce feature — the screen's tab bar lives in WorkforceDashboard; this renders only the chosen
// tab's content. Occupations browse mirrors the web browse; Sectors / Skill Level are the V2 member
// drilldowns. Read-only.
const COLOR = '#F97316';
const SKILL_LEVELS = ['Foundational', 'Intermediate', 'Advanced'];
const PAGE_SIZE = 20;

export type WorkforceBrowseTab = 'occupations' | 'sector' | 'skill-level';

const REASON: Record<WorkforceMatchReason, { label: string; color: string }> = {
  jobTitle: { label: 'Job title', color: '#22C55E' },
  skill: { label: 'Skill', color: '#A855F7' },
  sector: { label: 'Sector', color: '#3B82F6' },
  none: { label: 'No match', color: '#EF4444' },
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function MemberCard({ m }: { m: WorkforceMatchedMember }) {
  const r = REASON[m.matchReason];
  return (
    <View style={styles.memberCard}>
      <View style={styles.memberHead}>
        <Text style={styles.memberName}>{m.displayName}</Text>
        <View style={[styles.badge, { backgroundColor: r.color + '1A', borderColor: r.color + '40' }]}>
          <Text style={[styles.badgeText, { color: r.color }]}>{r.label}</Text>
        </View>
      </View>
      {m.matchingOccupations.length > 0 ? (
        <Text style={styles.memberMeta} numberOfLines={2}>
          {m.matchingOccupations.map((o) => o.title).join(', ')}
        </Text>
      ) : null}
      {m.skills.length > 0 ? (
        <Text style={styles.memberSub} numberOfLines={2}>Skills: {m.skills.join(', ')}</Text>
      ) : null}
    </View>
  );
}

function BucketRow({ kind, item }: { kind: 'sector' | 'skill-level'; item: WorkforceGroupedReportItem }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WorkforceBucketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && detail === null && !loading) {
      setLoading(true);
      setError(null);
      try {
        const d = kind === 'sector'
          ? await fetchWorkforceSectorDetail(item.bucket)
          : await fetchWorkforceSkillLevelDetail(item.bucket);
        setDetail(d ?? { ...item, matchedMembers: [] });
      } catch {
        setError('Could not load members.');
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <View style={styles.bucketRow}>
      <TouchableOpacity onPress={toggle} style={styles.bucketHead} accessibilityState={{ expanded: open }}>
        <Text style={styles.bucketChevron}>{open ? '▾' : '▸'}</Text>
        <Text style={styles.bucketName} numberOfLines={1}>{item.bucket}</Text>
        <Text style={styles.rowMeta}>{fmt(item.recruited)} / {fmt(item.target)}</Text>
        <Text style={[styles.rowGap, { color: item.gap > 0 ? '#F97316' : '#22C55E' }]}>
          {item.gap > 0 ? `${fmt(item.gap)} to fill` : 'filled'}
        </Text>
      </TouchableOpacity>
      {open ? (
        <View style={styles.bucketBody}>
          {loading ? (
            <ActivityIndicator color={COLOR} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (detail?.matchedMembers.length ?? 0) === 0 ? (
            <Text style={styles.muted}>No matching members yet.</Text>
          ) : (
            detail!.matchedMembers.map((m) => <MemberCard key={m.profileId} m={m} />)
          )}
        </View>
      ) : null}
    </View>
  );
}

function BucketDrilldown({ kind, fetcher }: { kind: 'sector' | 'skill-level'; fetcher: () => Promise<WorkforceGroupedReportItem[]> }) {
  const [items, setItems] = useState<WorkforceGroupedReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetcher()
      .then((i) => { if (active) setItems(i); })
      .catch(() => { if (active) setError('Failed to load.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetcher]);

  if (loading) return <ActivityIndicator color={COLOR} style={{ marginTop: 24 }} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (items.length === 0) return <Text style={styles.muted}>No data yet.</Text>;
  return <View>{items.map((item) => <BucketRow key={item.bucket} kind={kind} item={item} />)}</View>;
}

function OccupationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [occ, setOcc] = useState<WorkforceOccupation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchWorkforceOccupation(id)
      .then((o) => { if (active) setOcc(o); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const stats = occ
    ? [
        { l: 'Headcount target', v: fmt(occ.target) },
        { l: 'Annual training target', v: fmt(occ.annualTrainingTarget) },
        { l: 'Members', v: fmt(occ.members) },
        { l: 'Recruited', v: fmt(occ.recruited) },
        { l: 'Roles to fill', v: occ.gap > 0 ? fmt(occ.gap) : '—' },
      ]
    : [];

  return (
    <View>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Back to occupations</Text>
      </TouchableOpacity>
      {loading ? (
        <ActivityIndicator color={COLOR} />
      ) : !occ ? (
        <Text style={styles.muted}>Occupation not found.</Text>
      ) : (
        <View>
          <Text style={styles.detailTitle}>{occ.name}</Text>
          <Text style={styles.memberSub}>{occ.sector} · {occ.skillLevel}</Text>
          <View style={styles.statWrap}>
            {stats.map((s) => (
              <View key={s.l} style={styles.statBox}>
                <Text style={styles.statLabel}>{s.l}</Text>
                <Text style={styles.statValue}>{s.v}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.explain}>
            Headcount target is this occupation&apos;s share of its sector&apos;s demand (population ×
            participation, split by sector workforce share, then across the sector&apos;s job titles).
            Annual training target is a share of that by skill level. Recruited is the distinct members
            matched by sector, job title, or a registered skill. Gap = target − recruited.
          </Text>
        </View>
      )}
    </View>
  );
}

function OccupationsBrowse() {
  const [all, setAll] = useState<WorkforceOccupation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAllWorkforceOccupations()
      .then((i) => { if (active) setAll(i); })
      .catch(() => { if (active) setError('Failed to load.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((o) => {
      if (level !== 'all' && o.skillLevel !== level) return false;
      if (q && !`${o.name} ${o.sector}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, search, level]);

  if (selectedId) return <OccupationDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  if (loading) return <ActivityIndicator color={COLOR} style={{ marginTop: 24 }} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <View>
      <TextInput
        value={search}
        onChangeText={(v) => { setSearch(v); setPage(0); }}
        placeholder="Search occupations or sector…"
        placeholderTextColor="#4B5563"
        style={styles.input}
      />
      <View style={styles.chips}>
        {['all', ...SKILL_LEVELS].map((l) => (
          <TouchableOpacity
            key={l}
            onPress={() => { setLevel(l); setPage(0); }}
            style={[styles.chip, level === l && styles.chipActive]}
          >
            <Text style={[styles.chipText, level === l && styles.chipTextActive]}>{l === 'all' ? 'All levels' : l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {filtered.length === 0 ? (
        <Text style={styles.muted}>No occupations match these filters.</Text>
      ) : (
        <>
          {rows.map((o) => (
            <TouchableOpacity key={o.id} onPress={() => setSelectedId(o.id)} style={styles.occRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bucketName} numberOfLines={1}>{o.name}</Text>
                <Text style={styles.rowSub}>{o.sector} · {o.skillLevel}</Text>
              </View>
              <Text style={styles.rowMeta}>{fmt(o.recruited)} / {fmt(o.target)}</Text>
              <Text style={[styles.rowGap, { color: o.gap > 0 ? '#F97316' : '#22C55E' }]}>
                {o.gap > 0 ? `${fmt(o.gap)} to fill` : 'filled'}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.pager}>
            <TouchableOpacity disabled={current === 0} onPress={() => setPage(current - 1)} style={[styles.pageBtn, current === 0 && styles.pageBtnDisabled]}>
              <Text style={styles.pageBtnText}>Prev</Text>
            </TouchableOpacity>
            <Text style={styles.muted}>Page {current + 1} / {pageCount}</Text>
            <TouchableOpacity disabled={current >= pageCount - 1} onPress={() => setPage(current + 1)} style={[styles.pageBtn, current >= pageCount - 1 && styles.pageBtnDisabled]}>
              <Text style={styles.pageBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

export function WorkforceBrowseViews({ tab }: { tab: WorkforceBrowseTab }) {
  if (tab === 'occupations') return <OccupationsBrowse />;
  if (tab === 'sector') return <BucketDrilldown kind="sector" fetcher={fetchWorkforceSectorReport} />;
  return <BucketDrilldown kind="skill-level" fetcher={fetchWorkforceSkillLevelReport} />;
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: '#6B7280', paddingVertical: 8 },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', paddingVertical: 12 },
  input: {
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, color: '#E8EAF0', fontSize: 14, marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  chipActive: { backgroundColor: COLOR + '20', borderColor: COLOR + '40' },
  chipText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  chipTextActive: { color: COLOR },
  occRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowSub: { fontSize: 11, color: '#6B7280' },
  rowMeta: { fontSize: 11, color: '#9CA3AF' },
  rowGap: { fontSize: 13, fontWeight: '700', textAlign: 'right', minWidth: 90 },
  bucketRow: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  bucketHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  bucketChevron: { fontSize: 14, color: '#6B7280', width: 14 },
  bucketName: { flex: 1, fontSize: 14, color: '#E8EAF0', fontWeight: '600' },
  bucketBody: { paddingLeft: 24, paddingBottom: 12, gap: 8 },
  memberCard: {
    padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 8,
  },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#E8EAF0' },
  memberMeta: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  memberSub: { fontSize: 11, color: '#6B7280' },
  badge: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  backBtn: { paddingVertical: 8, marginBottom: 8 },
  backText: { fontSize: 13, color: '#9CA3AF' },
  detailTitle: { fontSize: 20, fontWeight: '700', color: '#F9FAFB' },
  statWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 14 },
  statBox: {
    padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', minWidth: 100, flexGrow: 1,
  },
  statLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#F9FAFB' },
  explain: { fontSize: 12, color: '#6B7280', lineHeight: 19 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  pageBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, color: '#E8EAF0' },
});
