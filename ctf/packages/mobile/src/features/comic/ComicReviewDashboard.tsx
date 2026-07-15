import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, type ThemeTokens } from '../../theme';
import {
  fetchComicReviewQueue,
  fetchComicTrainingStats,
  fetchVisiblePlugins,
  resolveComicReview,
} from './api';
import type {
  ComicPluginOption,
  ComicReviewItem,
  ComicReviewResolution,
  ComicTrainingStats,
} from './api';

// Owner Review & Correction Dashboard (mobile). Matches the locked MobileAIReviewConsole /
// MobileAIReviewConsoleEmpty mockups. Admin-gated server-side; a non-admin sees an access notice.
// Provenance shown is real only (engine / intent / safety category / the real nlu confidence) —
// the mockup's fabricated "Sources" list and hardcoded confidence buckets are intentionally not
// reproduced, matching the web dashboard (no fabricated source documents).
// ACCENT / ACCENT_LIGHT are the @comic AI-assistant cyan (and its light tint). They are kept raw:
// this cyan is the assistant accent that the comic theme remaps to inkDim, a value change out of
// scope for this byte-identical token pass. PANEL is a bespoke deep-chrome shade with no matching
// mobile token, so it also stays raw. Background, borders, and text read the theme tokens.
const ACCENT = '#0EA5E9';
const ACCENT_LIGHT = '#7DD3FC';
const PANEL = '#0D0F14';

function shortAsker(userId: string): string {
  if (!userId) return 'Survivor';
  return userId.length > 8 ? `Survivor ${userId.slice(0, 6)}` : `Survivor ${userId}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diffMin = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return date.toLocaleDateString();
}

function confidenceLabel(value: number | null): string {
  if (value === null) return 'Not yet scored';
  return `${Math.round(value * 100)}%`;
}

type ConfidenceBand = { label: string; color: string; pct: number | null; low: boolean };

// Map the (possibly null) NLU confidence to a band, mirroring the web dashboard. Confidence is no
// longer populated, so it is typically null — surfaced honestly rather than a fabricated number.
function confidenceBand(value: number | null): ConfidenceBand {
  if (value === null) return { label: 'Not yet scored', color: ACCENT_LIGHT, pct: null, low: false };
  const pct = Math.round(value * 100);
  if (pct >= 80) return { label: 'High confidence', color: '#22C55E', pct, low: false };
  if (pct >= 50) return { label: 'Medium confidence', color: '#F59E0B', pct, low: false };
  return { label: 'Low confidence', color: '#EF4444', pct, low: true };
}

function ConfidenceCard({ item }: { item: ComicReviewItem }) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const band = confidenceBand(item.nluConfidence);
  return (
    <View>
      <Text style={s.sectionLabel}>Confidence</Text>
      <View style={s.confCard}>
        <View style={s.confTop}>
          <Text style={[s.confLabel, { color: band.color }]}>{band.label}</Text>
          {band.pct !== null ? (
            <Text style={[s.confLabel, { color: band.color }]}>{band.pct}%</Text>
          ) : null}
        </View>
        {band.pct !== null ? (
          <View style={s.confTrack}>
            <View style={[s.confFill, { width: `${band.pct}%`, backgroundColor: band.color }]} />
          </View>
        ) : (
          <View style={s.confHintRow}>
            <Ionicons name="warning-outline" size={12} color="#FCD34D" />
            <Text style={s.confHintText}>
              No calibrated confidence yet — every draft is held for human review.
            </Text>
          </View>
        )}
        {band.low ? (
          <View style={s.confHintRow}>
            <Ionicons name="warning-outline" size={12} color="#FCA5A5" />
            <Text style={s.confLowText}>Safety-sensitive — review wording carefully.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function DashboardHeader({ count, allClear }: { count: number; allClear: boolean }) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={s.header}>
      <View style={s.headerIcon}>
        <Ionicons name="shield-checkmark" size={17} color={ACCENT} />
      </View>
      <View style={s.headerText}>
        <Text style={s.headerTitle}>Review Dashboard</Text>
        <Text style={s.headerSub}>AI Assistant answers awaiting review</Text>
      </View>
      <View style={[s.countPill, allClear ? s.countPillClear : null]}>
        <Ionicons name="time-outline" size={11} color={allClear ? tokens.success : ACCENT} />
        <Text style={[s.countText, allClear ? s.countTextClear : null]}>{count}</Text>
      </View>
    </View>
  );
}

// Compact "Training examples collected: N" line under the header. Read-only and best-effort: the
// caller passes null when the stats fetch failed (or the viewer is not an admin), so the line hides.
function TrainingStatsLine({ stats }: { stats: ComicTrainingStats | null }) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  if (!stats) return null;
  const pending = stats.trainingExamplesByStatus.pending ?? 0;
  const exported = stats.trainingExamplesByStatus.exported ?? 0;
  return (
    <View style={s.trainingStatsLine}>
      <Ionicons name="school-outline" size={12} color={tokens.textSecondary} />
      <Text style={s.trainingStatsText} numberOfLines={2}>
        <Text style={s.trainingStatsStrong}>Training examples collected: </Text>
        <Text style={s.trainingStatsStrong}>{stats.trainingExamplesTotal}</Text>
        <Text style={s.trainingStatsDim}>
          {` (${pending} awaiting export · ${exported} exported · ${stats.ratedAnswersTotal} rated answers)`}
        </Text>
      </Text>
    </View>
  );
}

function EmptyDashboard({ trainingStats }: { trainingStats: ComicTrainingStats | null }) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={s.screen}>
      <DashboardHeader count={0} allClear />
      <TrainingStatsLine stats={trainingStats} />
      <View style={s.emptyWrap}>
        <View style={s.emptyIcon}>
          <Ionicons name="checkmark-circle" size={38} color={tokens.success} />
        </View>
        <Text style={s.emptyTitle}>All caught up</Text>
        <Text style={s.emptyBody}>
          Every AI Assistant answer has been reviewed. Survivors only ever see answers a human has approved.
        </Text>
        <View style={s.emptyNote}>
          <Ionicons name="mail-outline" size={13} color={tokens.textMuted} />
          <Text style={s.emptyNoteText}>New drafts will appear here automatically.</Text>
        </View>
      </View>
    </View>
  );
}

function ProvenanceRow({ item }: { item: ComicReviewItem }) {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  return (
    <View style={s.provenanceWrap}>
      <Text style={s.sectionLabel}>Provenance</Text>
      <View style={s.provenanceGrid}>
        {item.hasDraft ? (
          <View style={s.provenanceItem}>
            <Text style={s.provenanceKey}>Engine</Text>
            <Text style={s.provenanceValue}>{item.engine}</Text>
          </View>
        ) : null}
        <View style={s.provenanceItem}>
          <Text style={s.provenanceKey}>Intent</Text>
          <Text style={s.provenanceValue}>{item.intent ?? '—'}</Text>
        </View>
        <View style={s.provenanceItem}>
          <Text style={s.provenanceKey}>Confidence</Text>
          <Text style={s.provenanceValue}>{confidenceLabel(item.nluConfidence)}</Text>
        </View>
        {item.safetyCategory ? (
          <View style={s.provenanceItem}>
            <Text style={s.provenanceKey}>Safety</Text>
            <Text style={[s.provenanceValue, s.provenanceSafety]}>{item.safetyCategory}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const ComicReviewDashboard = () => {
  const { tokens } = useTheme();
  const s = useMemo(() => makeStyles(tokens), [tokens]);
  const [items, setItems] = useState<ComicReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [trainingStats, setTrainingStats] = useState<ComicTrainingStats | null>(null);
  // The visible plugin registry for the "Applicable plugins" picker, and the reviewer's current
  // selection for the item being resolved (reset when the selected item changes).
  const [plugins, setPlugins] = useState<ComicPluginOption[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchComicReviewQueue();
      setForbidden(result.forbidden);
      setItems(result.items);
      setSelectedId((prev) => {
        if (prev && result.items.some((entry) => entry.reviewId === prev)) return prev;
        return result.items[0]?.reviewId ?? null;
      });
      // Best-effort training-examples counter and plugin list; never block the queue.
      setTrainingStats(await fetchComicTrainingStats());
      setPlugins(await fetchVisiblePlugins());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the review queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pull-to-refresh: re-pull the queue in the background (load only shows the full-screen
  // spinner on the initial mount, so the current queue stays visible while it re-pulls).
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const selected = useMemo(
    () => items.find((entry) => entry.reviewId === selectedId) ?? null,
    [items, selectedId],
  );

  // A fresh plugin selection per item being reviewed (the queue holds unresolved drafts, which carry
  // no tags yet).
  useEffect(() => {
    setSelectedSlugs([]);
  }, [selectedId]);

  const togglePluginSlug = useCallback((slug: string) => {
    setSelectedSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }, []);

  const performResolve = useCallback(
    async (resolution: ComicReviewResolution) => {
      if (!selected || busy) return;
      setBusy(true);
      setActionError(null);
      try {
        await resolveComicReview(
          selected.reviewId,
          resolution,
          resolution === 'correct' ? draft : null,
          // Tags only apply to a published answer; the server drops them for a reject.
          resolution === 'reject' ? [] : selectedSlugs,
        );
        setEditing(false);
        setDraft('');
        await load();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Unable to resolve the item.');
      } finally {
        setBusy(false);
      }
    },
    [selected, busy, draft, load, selectedSlugs],
  );

  // Confirm before any action that changes what a survivor sees: publishing (approve/correct) sends
  // the answer; reject discards the draft. A misclick must not silently push or drop a reply.
  const resolve = useCallback(
    (resolution: ComicReviewResolution) => {
      if (!selected || busy) return;
      const message =
        resolution === 'reject'
          ? 'Reject this draft? The survivor will not receive this answer.'
          : resolution === 'correct'
            ? 'Approve and send your corrected answer to the survivor?'
            : 'Approve and send this answer to the survivor?';
      const confirmLabel = resolution === 'reject' ? 'Reject' : 'Approve & send';
      Alert.alert(resolution === 'reject' ? 'Reject draft' : 'Approve answer', message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: confirmLabel,
          style: resolution === 'reject' ? 'destructive' : 'default',
          onPress: () => {
            void performResolve(resolution);
          },
        },
      ]);
    },
    [selected, busy, performResolve],
  );

  const beginEdit = useCallback(() => {
    if (!selected) return;
    // Seed from a real AI draft only; with no draft start blank so the question text is never
    // presented as a draft to edit.
    setDraft(selected.hasDraft ? selected.draftBody : '');
    setEditing(true);
  }, [selected]);

  if (loading) {
    return (
      <View style={s.screen}>
        <DashboardHeader count={0} allClear={false} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </View>
    );
  }

  if (forbidden) {
    return (
      <View style={s.screen}>
        <DashboardHeader count={0} allClear={false} />
        <View style={s.center}>
          <Ionicons name="lock-closed-outline" size={32} color={tokens.textSecondary} />
          <Text style={s.noticeText}>The review dashboard is available to owners only.</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.screen}>
        <DashboardHeader count={0} allClear={false} />
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={load}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (items.length === 0 || !selected) {
    return <EmptyDashboard trainingStats={trainingStats} />;
  }

  return (
    <View style={s.screen}>
      <DashboardHeader count={items.length} allClear={false} />
      <TrainingStatsLine stats={trainingStats} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipsBar}
        contentContainerStyle={s.chipsContent}
      >
        {items.map((entry) => {
          const active = entry.reviewId === selected.reviewId;
          return (
            <Pressable
              key={entry.reviewId}
              style={[s.chip, active ? s.chipActive : null]}
              onPress={() => {
                setSelectedId(entry.reviewId);
                setEditing(false);
              }}
            >
              <View style={[s.chipDot, entry.safetyCategory ? s.chipDotSafety : null]} />
              <Text style={[s.chipText, active ? s.chipTextActive : null]} numberOfLines={1}>
                {entry.askedByUsername ? `@${entry.askedByUsername}` : shortAsker(entry.askedByUserId)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={s.detail}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        <View style={s.detailMeta}>
          <Text style={s.detailAsker}>{selected.askedByUsername ? `@${selected.askedByUsername}` : shortAsker(selected.askedByUserId)}</Text>
          <Text style={s.detailTime}>{formatTime(selected.createdAtIso)}</Text>
        </View>

        <Text style={s.sectionLabel}>Question</Text>
        <View style={s.questionBox}>
          <Text style={s.questionText}>{selected.questionBody}</Text>
        </View>

        {editing ? (
          <>
            {/* Original AI draft (read-only) — only when a real AI draft exists. With no draft
                (drafting unavailable, or safety-held), there is nothing to show above the editor. */}
            {selected.hasDraft ? (
              <>
                <View style={s.draftHeader}>
                  <Text style={s.sectionLabel}>Original AI draft</Text>
                  <View style={s.needsCorrectionBadge}>
                    <Text style={s.needsCorrectionText}>Needs correction</Text>
                  </View>
                </View>
                <View style={s.draftReadonlyBox}>
                  <Text style={s.draftReadonlyText}>{selected.draftBody}</Text>
                </View>
              </>
            ) : null}

            {/* Editable answer with Reset + character count. */}
            <View style={s.draftHeader}>
              <Text style={s.sectionLabelCyan}>Your {selected.hasDraft ? 'corrected ' : ''}answer</Text>
              <Pressable
                style={s.resetBtn}
                onPress={() => setDraft(selected.hasDraft ? selected.draftBody : '')}
                disabled={busy}
              >
                <Ionicons name="refresh" size={11} color={tokens.textSecondary} />
                <Text style={s.resetText}>Reset</Text>
              </Pressable>
            </View>
            <TextInput
              style={s.editInput}
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder={selected.hasDraft ? 'Correct the answer before approving…' : 'Write the answer before approving…'}
              placeholderTextColor={tokens.textSecondary}
              editable={!busy}
            />
            <Text style={s.charCount}>{draft.length} characters</Text>

            {/* Safety reminder banner. */}
            <View style={s.safetyBanner}>
              <Ionicons name="warning-outline" size={15} color="#FBBF24" />
              <Text style={s.safetyBannerText}>
                Make sure the corrected wording never pressures someone to reveal their location or
                identity before they&apos;re ready.
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={s.draftHeader}>
              <Text style={s.sectionLabel}>{selected.hasDraft ? 'AI draft' : 'No AI draft'}</Text>
              <View style={s.notSentBadge}>
                <Ionicons name="sparkles" size={8} color={ACCENT_LIGHT} />
                <Text style={s.notSentText}>Not sent</Text>
              </View>
            </View>
            <View style={s.draftBox}>
              <Text style={s.draftText}>
                {selected.hasDraft
                  ? selected.draftBody
                  : selected.safetyCategory
                    ? 'This safety-sensitive question was held for a person to answer directly — the AI Assistant did not draft a reply. Use Edit & approve to write the response.'
                    : 'No AI draft yet — it may still be generating, or drafting was unavailable. Check back in a moment, or use Edit & approve to write the answer.'}
              </Text>
            </View>

            <ConfidenceCard item={selected} />
            <ProvenanceRow item={selected} />
          </>
        )}

        {plugins.length > 0 ? (
          <View style={s.pluginPickerWrap}>
            <Text style={s.sectionLabel}>Applicable plugins</Text>
            <Text style={s.pluginPickerHint}>Tag the plugins this answer points to (optional).</Text>
            <View style={s.pluginChipWrap}>
              {plugins.map((p) => {
                const on = selectedSlugs.includes(p.slug);
                return (
                  <Pressable
                    key={p.slug}
                    style={[s.pluginChip, on ? s.pluginChipOn : null]}
                    onPress={() => togglePluginSlug(p.slug)}
                  >
                    <Text style={[s.pluginChipText, on ? s.pluginChipTextOn : null]}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={s.actions}>
        {actionError && <Text style={s.actionError}>{actionError}</Text>}
        {editing ? (
          // Edit mode: primary = approve the corrected answer (disabled while empty), then Reject.
          <>
            <Pressable
              style={[s.approveBtn, busy || draft.trim().length === 0 ? s.btnBusy : null]}
              onPress={() => resolve('correct')}
              disabled={busy || draft.trim().length === 0}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={s.approveText}>Approve corrected</Text>
                </>
              )}
            </Pressable>
            <View style={s.secondaryRow}>
              <Pressable style={s.editBtn} onPress={() => setEditing(false)} disabled={busy}>
                <Ionicons name="arrow-back" size={14} color={ACCENT_LIGHT} />
                <Text style={s.editText}>Cancel edit</Text>
              </Pressable>
              <Pressable style={s.rejectBtn} onPress={() => resolve('reject')} disabled={busy}>
                <Ionicons name="close" size={14} color="#F87171" />
                <Text style={s.rejectText}>Reject</Text>
              </Pressable>
            </View>
          </>
        ) : (
          // Default view: Approve & send (only when a real AI draft exists to send), then
          // Edit & approve + Reject. With no draft the owner must author the answer via Edit.
          <>
            {selected.hasDraft ? (
              <Pressable
                style={[s.approveBtn, busy ? s.btnBusy : null]}
                onPress={() => resolve('approve')}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={s.approveText}>Approve &amp; send</Text>
                  </>
                )}
              </Pressable>
            ) : null}
            <View style={s.secondaryRow}>
              <Pressable style={s.editBtn} onPress={beginEdit} disabled={busy}>
                <Ionicons name="pencil" size={14} color={ACCENT_LIGHT} />
                <Text style={s.editText}>Edit &amp; approve</Text>
              </Pressable>
              <Pressable style={s.rejectBtn} onPress={() => resolve('reject')} disabled={busy}>
                <Ionicons name="close" size={14} color="#F87171" />
                <Text style={s.rejectText}>Reject</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(14,165,233,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.31)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: t.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: t.textSecondary,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(14,165,233,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
  },
  countPillClear: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.25)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: ACCENT,
  },
  countTextClear: {
    color: t.success,
  },
  trainingStatsLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: PANEL,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  trainingStatsText: {
    flexShrink: 1,
    fontSize: 11,
    color: t.textSecondary,
  },
  trainingStatsStrong: {
    color: '#E5E7EB',
    fontWeight: '600',
  },
  trainingStatsDim: {
    color: t.textMuted,
  },
  chipsBar: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  chipsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: t.border,
  },
  chipActive: {
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderColor: 'rgba(14,165,233,0.4)',
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  chipDotSafety: {
    backgroundColor: '#EF4444',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: t.textSecondary,
    maxWidth: 120,
  },
  chipTextActive: {
    color: t.textPrimary,
  },
  detail: {
    padding: 16,
    gap: 14,
  },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailAsker: {
    fontSize: 11,
    color: t.textSecondary,
  },
  detailTime: {
    fontSize: 11,
    color: t.textSecondary,
    marginLeft: 'auto',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: t.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 8,
  },
  pluginPickerWrap: { marginTop: 14 },
  pluginPickerHint: { fontSize: 11, color: t.textSecondary, marginBottom: 8 },
  pluginChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pluginChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pluginChipOn: {
    backgroundColor: `${ACCENT}1F`,
    borderColor: `${ACCENT}66`,
  },
  pluginChipText: { fontSize: 12, fontWeight: '600', color: t.textSecondary },
  pluginChipTextOn: { color: ACCENT_LIGHT },
  questionBox: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: t.border,
  },
  questionText: {
    fontSize: 14,
    color: t.textPrimary,
    lineHeight: 21,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
  },
  notSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(14,165,233,0.15)',
    marginBottom: 6,
    marginTop: 8,
  },
  notSentText: {
    fontSize: 9,
    fontWeight: '600',
    color: ACCENT_LIGHT,
  },
  draftBox: {
    padding: 14,
    borderRadius: 11,
    backgroundColor: 'rgba(14,165,233,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.25)',
  },
  draftText: {
    fontSize: 14,
    color: t.textShell,
    lineHeight: 22,
  },
  sectionLabelCyan: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: ACCENT_LIGHT,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 8,
  },
  needsCorrectionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(239,68,68,0.12)',
    marginBottom: 6,
    marginTop: 8,
  },
  needsCorrectionText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FCA5A5',
  },
  draftReadonlyBox: {
    padding: 14,
    borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  draftReadonlyText: {
    fontSize: 13,
    color: '#D1D5DB',
    lineHeight: 20,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    marginBottom: 6,
    marginTop: 8,
  },
  resetText: {
    fontSize: 11,
    color: t.textSecondary,
  },
  charCount: {
    fontSize: 10,
    color: t.textMuted,
    textAlign: 'right',
    marginTop: 5,
  },
  safetyBanner: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    borderRadius: 11,
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    marginTop: 4,
  },
  safetyBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#FCD34D',
    lineHeight: 18,
  },
  confCard: {
    padding: 14,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: t.border,
  },
  confTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  confLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  confTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: t.borderFaint,
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
    borderRadius: 4,
  },
  confHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 9,
  },
  confHintText: {
    flex: 1,
    fontSize: 11,
    color: '#FCD34D',
    lineHeight: 16,
  },
  confLowText: {
    flex: 1,
    fontSize: 11,
    color: '#FCA5A5',
    lineHeight: 16,
  },
  editInput: {
    minHeight: 120,
    padding: 14,
    borderRadius: 11,
    backgroundColor: 'rgba(14,165,233,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.4)',
    fontSize: 14,
    color: t.textShell,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  provenanceWrap: {
    marginTop: 4,
  },
  provenanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  provenanceItem: {
    minWidth: '46%',
    flexGrow: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: t.border,
  },
  provenanceKey: {
    fontSize: 10,
    color: t.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  provenanceValue: {
    fontSize: 13,
    color: '#D1D5DB',
    fontWeight: '600',
  },
  provenanceSafety: {
    color: '#FCA5A5',
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: t.border,
    backgroundColor: PANEL,
    gap: 8,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: '#16A34A',
  },
  btnBusy: {
    opacity: 0.7,
  },
  approveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.4)',
  },
  editText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT_LIGHT,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  rejectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F87171',
  },
  actionError: {
    fontSize: 12,
    color: '#F87171',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  noticeText: {
    fontSize: 14,
    color: t.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: t.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.4)',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT_LIGHT,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  emptyIcon: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: t.textPrimary,
  },
  emptyBody: {
    fontSize: 13,
    color: t.textSecondary,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  emptyNoteText: {
    fontSize: 12,
    color: t.textMuted,
  },
  });
}
