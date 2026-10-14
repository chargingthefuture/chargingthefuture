// The Browse tab, copied from the web BrowsePanel (foundation-panels.tsx): the hero, the skill filter
// banner, the empty states and the provider cards with their skill chips and Connect now.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Hammer } from 'lucide-react-native';
import type { ProviderView } from './FoundationDataApi';
import { ConnectNowButton, InstantCallAvailabilityBadge, acceptsInstantCalls, canOfferConnectNow } from './ConnectNow';
import { GradientPanel, InitialsAvatar } from './FDParts';
import { alpha, font, useFDTheme } from './useFDTheme';

// How many skills a card shows before the rest sit behind "+N more" (the web SKILL_PREVIEW_CAP).
const SKILL_PREVIEW_CAP = 6;

type SkillFilter = (_skillId: string | null, _skillName?: string | null) => void;

function resolveBannerSkillName(activeSkillName: string | null, activeSkillId: string | null, providers: ProviderView[]): string | null {
  if (activeSkillName) return activeSkillName;
  if (!activeSkillId) return null;
  return providers.flatMap((p) => p.offeredSkills).find((s) => s.id === activeSkillId)?.name ?? null;
}

function EmptyState({ activeSkillId, searchActive }: { activeSkillId: string | null; searchActive: boolean }) {
  const { t, r } = useFDTheme();
  const filtered = Boolean(activeSkillId) || searchActive;
  const title = filtered ? 'No providers match' : 'No providers offering skills yet';
  const hint = activeSkillId
    ? 'Try a different skill, or clear the filter to see everyone.'
    : searchActive
      ? 'Try a different search.'
      : 'Everyone here opts in before they show up. Check back soon as members offer skills.';
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { borderRadius: r(24) }]}>
        <Hammer size={20} color="rgba(239,68,68,0.4)" />
      </View>
      <Text style={[font(15, '600'), styles.center, { color: t.SUBTLE }]}>{title}</Text>
      <Text style={[font(13), styles.center, { color: t.FAINT }]}>{hint}</Text>
    </View>
  );
}

function SkillChips({ provider, activeSkillId, onSkillFilter, onSelect }: { provider: ProviderView; activeSkillId: string | null; onSkillFilter: SkillFilter; onSelect: () => void }) {
  const { t, r } = useFDTheme();
  // The skill being filtered on goes first: it is why this provider matched.
  const ordered = activeSkillId
    ? [...provider.offeredSkills].sort((a, b) => (a.id === activeSkillId ? -1 : b.id === activeSkillId ? 1 : 0))
    : provider.offeredSkills;
  const visible = ordered.slice(0, SKILL_PREVIEW_CAP);
  const hidden = ordered.length - visible.length;
  return (
    <View style={styles.chips}>
      {visible.map((s) => {
        const active = s.id === activeSkillId;
        return (
          <Pressable
            key={s.id}
            onPress={() => onSkillFilter(active ? null : s.id, active ? null : s.name)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, { borderRadius: r(999), backgroundColor: active ? t.ACCENT : alpha(t.ACCENT, '12'), borderColor: active ? t.ACCENT : alpha(t.ACCENT, '30') }]}
          >
            <Text style={[font(11.5, '600'), { color: active ? '#1a1205' : t.ACCENT }]}>{s.name}</Text>
          </Pressable>
        );
      })}
      {hidden > 0 ? (
        <Pressable
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityLabel={`View ${hidden} more ${hidden === 1 ? 'skill' : 'skills'} on ${provider.displayName}'s profile`}
          style={[styles.chip, { borderRadius: r(999), backgroundColor: t.INPUT_BG, borderColor: 'rgba(255,255,255,0.14)' }]}
        >
          <Text style={[font(11.5, '600'), { color: t.SUBTLE }]}>+{hidden} more</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ProviderCard({ p, viewerUserId, activeSkillId, onSelect, onSkillFilter }: {
  p: ProviderView;
  viewerUserId: string | null;
  activeSkillId: string | null;
  onSelect: (_p: ProviderView) => void;
  onSkillFilter: SkillFilter;
}) {
  const { t, r } = useFDTheme();
  return (
    <Pressable onPress={() => onSelect(p)} accessibilityRole="button" style={[styles.card, { borderRadius: r(14), borderColor: alpha(t.ACCENT, '18') }]}>
      <View style={styles.cardHead}>
        <InitialsAvatar name={p.displayName} size={52} fontSize={18} tint="20" />
        <View style={styles.identity}>
          <Text style={[font(15, '700'), styles.mb4, { color: t.TITLE }]}>{p.displayName}</Text>
          {p.headline ? <Text style={[font(13), styles.mb6, { color: t.SUBTLE }]}>{p.headline}</Text> : null}
          {p.bio ? <Text style={[font(12), styles.lh18, { color: t.MUTED }]} numberOfLines={2}>{p.bio}</Text> : null}
        </View>
        <View style={[styles.viewProfile, { borderRadius: r(8), backgroundColor: alpha(t.ACCENT, '15'), borderColor: alpha(t.ACCENT, '30') }]}>
          <Text style={[font(12, '600'), { color: t.ACCENT }]}>View Profile</Text>
        </View>
      </View>
      {p.shortDescription ? <Text style={[font(13), styles.lh19, { color: t.SUBTLE }]}>{p.shortDescription}</Text> : null}
      {p.offeredSkills.length > 0 ? <SkillChips provider={p} activeSkillId={activeSkillId} onSkillFilter={onSkillFilter} onSelect={() => onSelect(p)} /> : null}
      {canOfferConnectNow(p, viewerUserId) ? (
        <ConnectNowButton provider={p} compact />
      ) : acceptsInstantCalls(p) ? (
        <InstantCallAvailabilityBadge provider={p} compact />
      ) : null}
    </Pressable>
  );
}

export function BrowsePanel({ providers, viewerUserId, onSelect, activeSkillId, activeSkillName, searchActive, onSkillFilter }: {
  providers: ProviderView[];
  viewerUserId: string | null;
  onSelect: (_p: ProviderView) => void;
  activeSkillId: string | null;
  activeSkillName: string | null;
  searchActive: boolean;
  onSkillFilter: SkillFilter;
}) {
  const { t, r } = useFDTheme();
  const bannerSkillName = resolveBannerSkillName(activeSkillName, activeSkillId, providers);
  return (
    <View>
      <GradientPanel>
        <Text style={[font(20, '800'), styles.mb4, { color: t.TITLE }]}>Find providers offering a skill</Text>
        <Text style={[font(14), { color: t.SUBTLE }]}>Everyone here has opted in to be contacted — tap a skill to filter.</Text>
      </GradientPanel>
      {activeSkillId ? (
        <View style={[styles.banner, { borderRadius: r(10), backgroundColor: alpha(t.ACCENT, '12'), borderColor: alpha(t.ACCENT, '30') }]}>
          <Text style={[font(13), styles.flex, { color: t.TITLE }]}>
            Offering: <Text style={[font(13, '700'), { color: t.ACCENT }]}>{bannerSkillName ?? 'selected skill'}</Text>
          </Text>
          <Pressable onPress={() => onSkillFilter(null)} accessibilityRole="button" style={[styles.clear, { borderRadius: r(7), borderColor: alpha(t.ACCENT, '40') }]}>
            <Text style={[font(12, '600'), { color: t.ACCENT }]}>Clear</Text>
          </Pressable>
        </View>
      ) : null}
      {providers.length === 0 ? (
        <EmptyState activeSkillId={activeSkillId} searchActive={searchActive} />
      ) : (
        <View style={styles.list}>
          {providers.map((p) => (
            <ProviderCard key={p.profileId} p={p} viewerUserId={viewerUserId} activeSkillId={activeSkillId} onSelect={onSelect} onSkillFilter={onSkillFilter} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  mb4: { marginBottom: 4 },
  mb6: { marginBottom: 6 },
  lh18: { lineHeight: 18 },
  lh19: { lineHeight: 19.5 },
  banner: { marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1 },
  clear: { paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1 },
  empty: { padding: 48, alignItems: 'center', gap: 12 },
  emptyIcon: { width: 48, height: 48, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center', justifyContent: 'center' },
  list: { gap: 12 },
  card: { paddingVertical: 18, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, gap: 12 },
  cardHead: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  identity: { flex: 1, minWidth: 0 },
  viewProfile: { paddingVertical: 7, paddingHorizontal: 16, borderWidth: 1, flexShrink: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 3, paddingHorizontal: 10, borderWidth: 1 },
});
