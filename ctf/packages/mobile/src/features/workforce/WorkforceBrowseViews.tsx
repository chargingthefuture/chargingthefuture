import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useTheme, getAppAccent, type ThemeTokens } from '../../theme';
import {
  fetchAllWorkforceOccupations,
  fetchWorkforceOccupation,
  fetchWorkforceSectorReport,
  fetchWorkforceSkillLevelReport,
  fetchWorkforceSectorDetail,
  fetchWorkforceSkillLevelDetail,
  fetchWorkforceCommunityPlanning,
} from './api';
import type {
  CommunityPlanningTeamRoster,
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
const SKILL_LEVELS = ['Foundational', 'Intermediate', 'Advanced'];
const PAGE_SIZE = 20;

export type WorkforceBrowseTab = 'occupations' | 'sector' | 'skill-level' | 'community';

// Match-reason badge palette — a mixed categorical status set with no sanctioned tokens; stays raw.
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

function useWorkforceStyles() {
  const { tokens, theme } = useTheme();
  const accent = getAppAccent('workforce', theme);
  const styles = useMemo(() => makeStyles(tokens, accent), [tokens, accent]);
  return { tokens, accent, styles };
}

function MemberCard({ m }: { m: WorkforceMatchedMember }) {
  const { styles } = useWorkforceStyles();
  const r = REASON[m.matchReason];
  return (
    <View style={styles.memberCard}>
      <View style={styles.memberHead}>
        <Text style={styles.memberName}>{m.displayName}</Text>
        <View style={[styles.badge, { backgroundColor: r.color + '1A', borderColor: r.color + '40' }]}>
          <Text style={[styles.badgeText, { color: r.color }]}>{r.label}</Text>
        </View>
      </View>
      {m.matchingOccupations.map((o) => {
        const or_ = REASON[o.reason];
        return (
          <View key={o.id} style={styles.memberOccRow}>
            <Text style={styles.memberMeta} numberOfLines={2}>
              {o.title} ({o.sector})
              {o.viaSkills.length > 0 ? ` — via ${o.viaSkills.join(', ')}` : ''}
            </Text>
            <View style={styles.memberOccMetaRow}>
              <View style={[styles.badge, { backgroundColor: or_.color + '1A', borderColor: or_.color + '40' }]}>
                <Text style={[styles.badgeText, { color: or_.color }]}>{or_.label}</Text>
              </View>
              <Text style={styles.memberSub}>{o.gap > 0 ? `${fmt(o.gap)} to fill` : 'filled'}</Text>
            </View>
          </View>
        );
      })}
      {m.skills.length > 0 ? (
        <Text style={styles.memberSub} numberOfLines={2}>All skills: {m.skills.join(', ')}</Text>
      ) : null}
    </View>
  );
}

function BucketRow({ kind, item }: { kind: 'sector' | 'skill-level'; item: WorkforceGroupedReportItem }) {
  const { tokens, accent, styles } = useWorkforceStyles();
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
        <Text style={[styles.rowGap, { color: item.gap > 0 ? accent : tokens.success }]}>
          {item.gap > 0 ? `${fmt(item.gap)} to fill` : 'filled'}
        </Text>
      </TouchableOpacity>
      {open ? (
        <View style={styles.bucketBody}>
          {loading ? (
            <ActivityIndicator color={accent} />
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
  const { accent, styles } = useWorkforceStyles();
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

  if (loading) return <ActivityIndicator color={accent} style={{ marginTop: 24 }} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (items.length === 0) return <Text style={styles.muted}>No data yet.</Text>;
  return <View>{items.map((item) => <BucketRow key={item.bucket} kind={kind} item={item} />)}</View>;
}

function OccupationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { accent, styles } = useWorkforceStyles();
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
        // No declared-occupation "Members" stat: members join jobless but skilled, so the declared
        // count is ~always 0. Recruited (matched) carries the story; occ.members stays in the API.
        { l: 'Recruited (matched)', v: fmt(occ.recruited) },
        { l: 'Roles to fill', v: occ.gap > 0 ? fmt(occ.gap) : '—' },
      ]
    : [];

  return (
    <View>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>‹ Back to occupations</Text>
      </TouchableOpacity>
      {loading ? (
        <ActivityIndicator color={accent} />
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
  const { tokens, accent, styles } = useWorkforceStyles();
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
  if (loading) return <ActivityIndicator color={accent} style={{ marginTop: 24 }} />;
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
        placeholderTextColor={tokens.textMuted}
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
              <Text style={[styles.rowGap, { color: o.gap > 0 ? accent : tokens.success }]}>
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

// One planning team from issue #1465: a named union of Workforce sectors, expandable to its
// de-duplicated matched-member roster. Mirrors the web TeamCard.
function TeamRow({ team }: { team: CommunityPlanningTeamRoster }) {
  const { tokens, accent, styles } = useWorkforceStyles();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.bucketRow}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} style={styles.teamHead} accessibilityState={{ expanded: open }}>
        <Text style={styles.bucketChevron}>{open ? '▾' : '▸'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bucketName} numberOfLines={1}>{team.name}</Text>
          <Text style={styles.rowSub} numberOfLines={2}>{team.responsibleFor}</Text>
          <Text style={styles.teamSectors} numberOfLines={2}>
            {team.sectors.map((s) => (team.missingSectors.includes(s) ? `${s} · not mapped` : s)).join(' · ')}
          </Text>
        </View>
        <View style={styles.teamMeta}>
          <Text style={[styles.rowGap, { color: accent }]}>{fmt(team.memberCount)} members</Text>
          <Text style={[styles.rowGap, { color: team.gap > 0 ? accent : tokens.success }]}>
            {team.gap > 0 ? `${fmt(team.gap)} to fill` : 'filled'}
          </Text>
        </View>
      </TouchableOpacity>
      {open ? (
        <View style={styles.bucketBody}>
          {team.memberCount === 0 ? (
            <Text style={styles.muted}>No members match this team&apos;s sectors yet.</Text>
          ) : (
            team.members.map((m) => <MemberCard key={m.profileId} m={m} />)
          )}
        </View>
      ) : null}
    </View>
  );
}

function CommunityPlanning() {
  const { accent, styles } = useWorkforceStyles();
  const [report, setReport] = useState<CommunityPlanningTeamRoster[] | null>(null);
  const [sourceIssue, setSourceIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchWorkforceCommunityPlanning()
      .then((r) => { if (active) { setReport(r?.teams ?? []); setSourceIssue(r?.sourceIssue ?? null); } })
      .catch(() => { if (active) setError('Failed to load.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <ActivityIndicator color={accent} style={{ marginTop: 24 }} />;
  if (error) return <Text style={styles.errorText}>{error}</Text>;
  const teams = report ?? [];
  return (
    <View>
      <Text style={styles.communityIntro}>
        Proposed rosters for the survivor-built gated community planning document. Each team draws from
        the Workforce sectors it maps to; the roster is every member who already matches those sectors,
        and the gap is how many positions those sectors still have to fill. Recomputes live from the
        Directory.
      </Text>
      {sourceIssue ? <Text style={styles.rowSub}>Planning document: issue #1465</Text> : null}
      {teams.length === 0 ? (
        <Text style={styles.muted}>No teams to show yet.</Text>
      ) : (
        <View style={{ marginTop: 8 }}>{teams.map((team) => <TeamRow key={team.key} team={team} />)}</View>
      )}
    </View>
  );
}

export function WorkforceBrowseViews({ tab }: { tab: WorkforceBrowseTab }) {
  if (tab === 'occupations') return <OccupationsBrowse />;
  if (tab === 'sector') return <BucketDrilldown kind="sector" fetcher={fetchWorkforceSectorReport} />;
  if (tab === 'community') return <CommunityPlanning />;
  return <BucketDrilldown kind="skill-level" fetcher={fetchWorkforceSkillLevelReport} />;
}

function makeStyles(t: ThemeTokens, accent: string) {
  return StyleSheet.create({
    muted: { fontSize: 13, color: t.textSecondary, paddingVertical: 8 },
    errorText: { fontSize: 14, color: t.danger, textAlign: 'center', paddingVertical: 12 },
    input: {
      paddingHorizontal: 12, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, color: t.textShell, fontSize: 14, marginBottom: 10,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    chipActive: { backgroundColor: accent + '20', borderColor: accent + '40' },
    chipText: { fontSize: 12, color: t.textSecondary, fontWeight: '600' },
    chipTextActive: { color: accent },
    occRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    rowSub: { fontSize: 11, color: t.textSecondary },
    rowMeta: { fontSize: 11, color: t.textSecondary },
    rowGap: { fontSize: 13, fontWeight: '700', textAlign: 'right', minWidth: 90 },
    bucketRow: { borderBottomWidth: 1, borderBottomColor: t.borderFaint },
    bucketHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    teamHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12 },
    teamSectors: { fontSize: 11, color: t.textSecondary, marginTop: 4 },
    teamMeta: { alignItems: 'flex-end', gap: 4 },
    communityIntro: { fontSize: 13, color: t.textSecondary, lineHeight: 20, marginBottom: 6 },
    bucketChevron: { fontSize: 14, color: t.textSecondary, width: 14 },
    bucketName: { flex: 1, fontSize: 14, color: t.textShell, fontWeight: '600' },
    bucketBody: { paddingLeft: 24, paddingBottom: 12, gap: 8 },
    memberCard: {
      padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1, borderColor: t.borderFaint, marginBottom: 8,
    },
    memberOccRow: {
      marginTop: 4,
      gap: 2,
    },
    memberOccMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    memberHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    memberName: { fontSize: 14, fontWeight: '600', color: t.textShell },
    memberMeta: { fontSize: 12, color: t.textSecondary, marginBottom: 2 },
    memberSub: { fontSize: 11, color: t.textSecondary },
    badge: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: t.radiusChip, borderWidth: 1 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    backBtn: { paddingVertical: 8, marginBottom: 8 },
    backText: { fontSize: 13, color: t.textSecondary },
    detailTitle: { fontSize: 20, fontWeight: '700', color: t.textPrimary },
    statWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 14 },
    statBox: {
      padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.02)',
      borderWidth: 1, borderColor: t.borderFaint, minWidth: 100, flexGrow: 1,
    },
    statLabel: { fontSize: 11, color: t.textSecondary, marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: '700', color: t.textPrimary },
    explain: { fontSize: 12, color: t.textSecondary, lineHeight: 19 },
    pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
    pageBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    pageBtnDisabled: { opacity: 0.4 },
    pageBtnText: { fontSize: 13, color: t.textShell },
  });
}
