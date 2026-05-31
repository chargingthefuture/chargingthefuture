// Skills Taxonomy mobile screen.
//
// Pixel pass aligned to:
//   design/.../survivor-hub/MobileSkillsTaxonomy.tsx  (populated state)
//   design/.../survivor-hub/MobileSkillsTaxonomyEmpty.tsx
//   design/.../survivor-hub/MobileSkillsTaxonomyLoading.tsx
//   design/.../survivor-hub/MobileSkillsTaxonomyPublic.tsx
//
// Real data only — bound to GET /api/skills-taxonomy/hierarchy.
// Omitted (no API backing): per-sector accent color (mockup hardcodes; no color field in API).

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../auth/auth-context';
import { SkillsTaxonomyApi, type TaxonomyHierarchySector, type TaxonomyHierarchyJobTitle } from './SkillsTaxonomyApi';

// ---------------------------------------------------------------------------
// Design tokens (from mockup)
// ---------------------------------------------------------------------------

const BRAND = '#8B5CF6';
const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';
const STATUS_BG = '#090B0F';

// ---------------------------------------------------------------------------
// Loading state — matches MobileSkillsTaxonomyLoading.tsx
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <View style={styles.loadingRoot}>
      <View style={styles.loadingInner}>
        <Text style={styles.loadingLine}>EXIT THEIR ECONOMY</Text>
        <Text style={styles.loadingLine}>EXIT THE PSYOP</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state — matches MobileSkillsTaxonomyEmpty.tsx
// ---------------------------------------------------------------------------

function EmptyScreen({ isAdmin }: { isAdmin: boolean }) {
  return (
    <View style={styles.root}>
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusDots}>•••</Text>
      </View>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.bookIcon}>📖</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Skills Taxonomy</Text>
          <Text style={styles.headerSubtitle}>Sectors · Job Titles · Skills</Text>
        </View>
      </View>
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrap}>
          <Text style={styles.emptyIcon}>📖</Text>
        </View>
        <Text style={styles.emptyHeadline}>
          {isAdmin ? 'Taxonomy not populated yet' : 'Skills database coming soon'}
        </Text>
        <Text style={styles.emptyBody}>
          {isAdmin
            ? 'Import a CSV or manually add sectors, job titles, and skills.'
            : 'The skills taxonomy is being built by admins. Check back soon.'}
        </Text>
        {!isAdmin && (
          <View style={styles.emptyWaitRow}>
            <Text style={styles.emptyWaitText}>Admins are building the taxonomy</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Public state — matches MobileSkillsTaxonomyPublic.tsx
// ---------------------------------------------------------------------------

function PublicScreen({ sectorCount, jobTitleCount, skillCount }: {
  sectorCount: number;
  jobTitleCount: number;
  skillCount: number;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusDots}>•••</Text>
      </View>
      <View style={[styles.header, styles.publicHeader]}>
        <View style={styles.headerRow}>
          <Text style={styles.bookIconSmall}>📖</Text>
          <Text style={styles.headerTitle}>Skills Taxonomy</Text>
        </View>
        <View style={styles.publicBtns}>
          <TouchableOpacity style={styles.signInBtn}>
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.joinBtn}>
            <Text style={styles.joinBtnText}>Join Free</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.statsStrip}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{skillCount}</Text>
          <Text style={styles.statLabel}>Skills</Text>
        </View>
        <View style={[styles.statCell, styles.statCellBorder]}>
          <Text style={styles.statValue}>{jobTitleCount}</Text>
          <Text style={styles.statLabel}>Job Titles</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{sectorCount}</Text>
          <Text style={styles.statLabel}>Sectors</Text>
        </View>
      </View>
      <View style={styles.publicHero}>
        <Text style={styles.publicHeroTitle}>Explore the survivor skills database</Text>
        <Text style={styles.publicHeroBody}>
          {skillCount} skills, {jobTitleCount} job titles, {sectorCount} sectors. Sign in to
          search, filter, and trade with survivors who have the skills you need.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skill pill — extracted to give FlatList / map a stable element type without
// passing 'key' to a View (which TypeScript complains about in some RN versions)
// ---------------------------------------------------------------------------

function SkillPill({ name }: { name: string }) {
  return (
    <View style={styles.skillPill}>
      <Text style={styles.skillPillText}>{name}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Job accordion row (populated state inner component)
// ---------------------------------------------------------------------------

function JobRow({
  jobTitle,
  open,
  onToggle,
}: {
  jobTitle: TaxonomyHierarchyJobTitle;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <View>
      <TouchableOpacity
        onPress={onToggle}
        style={[styles.jobRowBtn, open && styles.jobRowBtnOpen]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.jobRowLabel, open && styles.jobRowLabelOpen]}>{jobTitle.name}</Text>
        <View style={styles.jobRowRight}>
          <Text style={[styles.jobRowCount, open && styles.jobRowCountOpen]}>
            {jobTitle.skills.length}
          </Text>
          <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
        </View>
      </TouchableOpacity>
      {open && (
        <View style={styles.skillsWrap}>
          <View style={styles.skillsRow}>
            {jobTitle.skills.map((sk) => (
              <React.Fragment key={sk.id}>
                <SkillPill name={sk.name} />
              </React.Fragment>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Populated state — matches MobileSkillsTaxonomy.tsx
// ---------------------------------------------------------------------------

function PopulatedScreen({
  sectors,
  totalSkills,
}: {
  sectors: TaxonomyHierarchySector[];
  totalSkills: number;
}) {
  const [selectedSectorId, setSelectedSectorId] = useState(sectors[0]?.id ?? '');
  const [openJobId, setOpenJobId] = useState<string | null>(
    sectors[0]?.jobTitles[0]?.id ?? null,
  );
  const [search, setSearch] = useState('');

  const selectedSector = sectors.find((s) => s.id === selectedSectorId) ?? sectors[0];

  const filteredJobTitles = selectedSector
    ? selectedSector.jobTitles.filter(
        (jt) =>
          search.trim() === '' ||
          jt.name.toLowerCase().includes(search.toLowerCase()) ||
          jt.skills.some((sk) => sk.name.toLowerCase().includes(search.toLowerCase())),
      )
    : [];

  const renderSectorPill = useCallback(
    ({ item }: { item: TaxonomyHierarchySector }) => (
      <TouchableOpacity
        key={item.id}
        onPress={() => {
          setSelectedSectorId(item.id);
          setOpenJobId(item.jobTitles[0]?.id ?? null);
        }}
        style={[styles.sectorPill, item.id === selectedSectorId && styles.sectorPillActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: item.id === selectedSectorId }}
      >
        {/* Sector accent dot — color is not available in API data; dot is rendered in BRAND */}
        <View style={styles.sectorDot} />
        <Text style={[styles.sectorPillText, item.id === selectedSectorId && styles.sectorPillTextActive]}>
          {item.name}
        </Text>
        <Text style={styles.sectorPillCount}>({item.jobTitles.length})</Text>
      </TouchableOpacity>
    ),
    [selectedSectorId],
  );

  return (
    <View style={styles.root}>
      <View style={styles.statusBar}>
        <Text style={styles.statusTime}>9:41</Text>
        <Text style={styles.statusDots}>•••</Text>
      </View>

      {/* Header */}
      <View style={styles.headerBlock}>
        <View style={styles.headerRowSpaced}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Text style={styles.bookIcon}>📖</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>Skills Taxonomy</Text>
              <Text style={styles.headerSubtitle}>
                {totalSkills} skills · {sectors.length} sectors
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search skills…"
            placeholderTextColor="#4B5563"
            style={styles.searchInput}
            accessibilityLabel="Search skills"
          />
        </View>
      </View>

      {/* Sector pills horizontal scroll */}
      <FlatList
        data={sectors}
        keyExtractor={(item) => item.id}
        renderItem={renderSectorPill}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsBar}
        contentContainerStyle={styles.pillsBarContent}
      />

      {/* Job title accordion */}
      <ScrollView style={styles.accordionScroll} contentContainerStyle={styles.accordionContent}>
        {selectedSector && (
          <Text style={styles.sectorHeading}>
            {selectedSector.name} — {filteredJobTitles.length} job title
            {filteredJobTitles.length !== 1 ? 's' : ''}
          </Text>
        )}
        <View style={styles.accordionCard}>
          {filteredJobTitles.map((jt) => {
            const jtId = jt.id;
            return (
              <React.Fragment key={jtId}>
                <JobRow
                  jobTitle={jt}
                  open={openJobId === jtId}
                  onToggle={() => setOpenJobId(openJobId === jtId ? null : jtId)}
                />
              </React.Fragment>
            );
          })}
          {filteredJobTitles.length === 0 && (
            <Text style={styles.noResults}>No job titles match your search.</Text>
          )}
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <View style={styles.navItem}>
          <View style={styles.navIconActive}>
            <Text style={styles.bookIconNav}>📖</Text>
          </View>
          <Text style={styles.navLabelActive}>Browse</Text>
        </View>
        <View style={styles.navItem}>
          <View style={styles.navIconInactive}>
            <Text style={styles.navIconGlyph}>🔍</Text>
          </View>
          <Text style={styles.navLabelInactive}>Search</Text>
        </View>
        <View style={styles.navItem}>
          <View style={styles.navIconInactive}>
            <Text style={styles.navIconGlyph}>＋</Text>
          </View>
          <Text style={styles.navLabelInactive}>Add</Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root — orchestrates data fetch and state routing
// ---------------------------------------------------------------------------

export function SkillsTaxonomy() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const [sectors, setSectors] = useState<TaxonomyHierarchySector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await SkillsTaxonomyApi.getHierarchy();
        if (!cancelled) setSectors(data.items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load taxonomy.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    const totalSkills = sectors.reduce(
      (acc, s) => acc + s.jobTitles.reduce((a, jt) => a + jt.skills.length, 0),
      0,
    );
    const totalJobs = sectors.reduce((acc, s) => acc + s.jobTitles.length, 0);
    return (
      <PublicScreen
        sectorCount={sectors.length}
        jobTitleCount={totalJobs}
        skillCount={totalSkills}
      />
    );
  }

  if (error) {
    return (
      <View style={styles.errorRoot}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (sectors.length === 0) {
    return <EmptyScreen isAdmin={isAdmin} />;
  }

  const totalSkills = sectors.reduce(
    (acc, s) => acc + s.jobTitles.reduce((a, jt) => a + jt.skills.length, 0),
    0,
  );

  return <PopulatedScreen sectors={sectors} totalSkills={totalSkills} />;
}

export default SkillsTaxonomy;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Loading
  loadingRoot: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingInner: { alignItems: 'center', paddingHorizontal: 32 },
  loadingLine: {
    fontSize: 10,
    letterSpacing: 2.56,
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },

  // Shared shell
  root: { flex: 1, backgroundColor: BG },
  statusBar: {
    height: 44,
    backgroundColor: STATUS_BG,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  statusTime: { fontSize: 13, fontWeight: '700', color: TEXT },
  statusDots: { fontSize: 12, color: SUBTLE },

  // Header
  header: {
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerRowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: `${BRAND}20`,
    borderWidth: 1,
    borderColor: `${BRAND}35`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookIcon: { fontSize: 16 },
  bookIconSmall: { fontSize: 16, color: BRAND },
  bookIconNav: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TEXT },
  headerSubtitle: { fontSize: 11, color: SUBTLE },

  // Public header
  publicHeader: {
    backgroundColor: `${BRAND}10`,
    borderBottomColor: `${BRAND}25`,
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  publicBtns: { flexDirection: 'row', gap: 6 },
  signInBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  signInBtnText: { color: TEXT, fontSize: 11, fontWeight: '600' },
  joinBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: BRAND,
  },
  joinBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Stats strip (public)
  statsStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: SURFACE,
  },
  statCell: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  statCellBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: BORDER,
  },
  statValue: { fontSize: 16, fontWeight: '900', color: BRAND },
  statLabel: { fontSize: 10, color: SUBTLE },

  // Public hero
  publicHero: { padding: 16 },
  publicHeroTitle: { fontSize: 20, fontWeight: '800', color: TEXT, marginBottom: 8 },
  publicHeroBody: { fontSize: 13, color: SUBTLE, lineHeight: 20.8 },

  // Search
  searchWrap: {},
  searchInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingLeft: 30,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    fontSize: 13,
    color: '#9CA3AF',
  },

  // Sector pills
  pillsBar: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  pillsBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  sectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectorPillActive: {
    backgroundColor: `${BRAND}20`,
    borderColor: `${BRAND}50`,
  },
  sectorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    // Per-sector accent color not in API data; using BRAND as neutral fallback
    backgroundColor: BRAND,
  },
  sectorPillText: { color: SUBTLE, fontSize: 12 },
  sectorPillTextActive: { color: BRAND, fontWeight: '700' },
  sectorPillCount: { fontSize: 10, color: SUBTLE, opacity: 0.7 },

  // Accordion
  accordionScroll: { flex: 1 },
  accordionContent: { padding: 14, paddingBottom: 80 },
  sectorHeading: { fontSize: 13, fontWeight: '600', color: TEXT, marginBottom: 12 },
  accordionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  noResults: { color: SUBTLE, padding: 16, textAlign: 'center' },

  // Job row
  jobRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: 'transparent',
  },
  jobRowBtnOpen: { backgroundColor: `${BRAND}10` },
  jobRowLabel: { fontSize: 14, fontWeight: '600', color: TEXT },
  jobRowLabelOpen: { color: BRAND },
  jobRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  jobRowCount: { fontSize: 11, color: SUBTLE },
  jobRowCountOpen: { color: BRAND },
  chevron: {
    fontSize: 18,
    color: SUBTLE,
    transform: [{ rotate: '90deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '0deg' }],
  },
  skillsWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  skillPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: `${BRAND}12`,
    borderWidth: 1,
    borderColor: `${BRAND}25`,
  },
  skillPillText: { fontSize: 12, color: BRAND },

  // Bottom nav
  bottomNav: {
    height: 72,
    backgroundColor: STATUS_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8 },
  navIconActive: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${BRAND}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconInactive: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconGlyph: { fontSize: 18, color: SUBTLE },
  navLabelActive: { fontSize: 10, color: BRAND, fontWeight: '600' },
  navLabelInactive: { fontSize: 10, color: '#4B5563' },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 20,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: `${BRAND}10`,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: `${BRAND}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: { fontSize: 34, opacity: 0.4 },
  emptyHeadline: { fontSize: 22, fontWeight: '800', color: TEXT, textAlign: 'center' },
  emptyBody: {
    fontSize: 14,
    color: SUBTLE,
    lineHeight: 22.4,
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyWaitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyWaitText: { fontSize: 12, color: SUBTLE },

  // Error
  errorRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    padding: 24,
  },
  errorText: { color: '#EF4444', fontSize: 15, textAlign: 'center' },
});
