import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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
const ACCENT = '#0EA5E9';
const ACCENT_LIGHT = '#7DD3FC';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

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
  const band = confidenceBand(item.nluConfidence);
  return (
    <View>
      <Text style={styles.sectionLabel}>Confidence</Text>
      <View style={styles.confCard}>
        <View style={styles.confTop}>
          <Text style={[styles.confLabel, { color: band.color }]}>{band.label}</Text>
          {band.pct !== null ? (
            <Text style={[styles.confLabel, { color: band.color }]}>{band.pct}%</Text>
          ) : null}
        </View>
        {band.pct !== null ? (
          <View style={styles.confTrack}>
            <View style={[styles.confFill, { width: `${band.pct}%`, backgroundColor: band.color }]} />
          </View>
        ) : (
          <View style={styles.confHintRow}>
            <Ionicons name="warning-outline" size={12} color="#FCD34D" />
            <Text style={styles.confHintText}>
              No calibrated confidence yet — every draft is held for human review.
            </Text>
          </View>
        )}
        {band.low ? (
          <View style={styles.confHintRow}>
            <Ionicons name="warning-outline" size={12} color="#FCA5A5" />
            <Text style={styles.confLowText}>Safety-sensitive — review wording carefully.</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function DashboardHeader({ count, allClear }: { count: number; allClear: boolean }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIcon}>
        <Ionicons name="shield-checkmark" size={17} color={ACCENT} />
      </View>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>Review Dashboard</Text>
        <Text style={styles.headerSub}>AI Assistant answers awaiting review</Text>
      </View>
      <View style={[styles.countPill, allClear ? styles.countPillClear : null]}>
        <Ionicons name="time-outline" size={11} color={allClear ? '#22C55E' : ACCENT} />
        <Text style={[styles.countText, allClear ? styles.countTextClear : null]}>{count}</Text>
      </View>
    </View>
  );
}

// Compact "Training examples collected: N" line under the header. Read-only and best-effort: the
// caller passes null when the stats fetch failed (or the viewer is not an admin), so the line hides.
function TrainingStatsLine({ stats }: { stats: ComicTrainingStats | null }) {
  if (!stats) return null;
  const pending = stats.trainingExamplesByStatus.pending ?? 0;
  const exported = stats.trainingExamplesByStatus.exported ?? 0;
  return (
    <View style={styles.trainingStatsLine}>
      <Ionicons name="school-outline" size={12} color={SUBTLE} />
      <Text style={styles.trainingStatsText} numberOfLines={2}>
        <Text style={styles.trainingStatsStrong}>Training examples collected: </Text>
        <Text style={styles.trainingStatsStrong}>{stats.trainingExamplesTotal}</Text>
        <Text style={styles.trainingStatsDim}>
          {` (${pending} pending · ${exported} exported · ${stats.ratedAnswersTotal} rated answers)`}
        </Text>
      </Text>
    </View>
  );
}

function EmptyDashboard({ trainingStats }: { trainingStats: ComicTrainingStats | null }) {
  return (
    <View style={styles.screen}>
      <DashboardHeader count={0} allClear />
      <TrainingStatsLine stats={trainingStats} />
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <Ionicons name="checkmark-circle" size={38} color="#22C55E" />
        </View>
        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptyBody}>
          Every AI Assistant answer has been reviewed. Survivors only ever see answers a human has approved.
        </Text>
        <View style={styles.emptyNote}>
          <Ionicons name="mail-outline" size={13} color="#4B5563" />
          <Text style={styles.emptyNoteText}>New drafts will appear here automatically.</Text>
        </View>
      </View>
    </View>
  );
}

function ProvenanceRow({ item }: { item: ComicReviewItem }) {
  return (
    <View style={styles.provenanceWrap}>
      <Text style={styles.sectionLabel}>Provenance</Text>
      <View style={styles.provenanceGrid}>
        {item.hasDraft ? (
          <View style={styles.provenanceItem}>
            <Text style={styles.provenanceKey}>Engine</Text>
            <Text style={styles.provenanceValue}>{item.engine}</Text>
          </View>
        ) : null}
        <View style={styles.provenanceItem}>
          <Text style={styles.provenanceKey}>Intent</Text>
          <Text style={styles.provenanceValue}>{item.intent ?? '—'}</Text>
        </View>
        <View style={styles.provenanceItem}>
          <Text style={styles.provenanceKey}>Confidence</Text>
          <Text style={styles.provenanceValue}>{confidenceLabel(item.nluConfidence)}</Text>
        </View>
        {item.safetyCategory ? (
          <View style={styles.provenanceItem}>
            <Text style={styles.provenanceKey}>Safety</Text>
            <Text style={[styles.provenanceValue, styles.provenanceSafety]}>{item.safetyCategory}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const ComicReviewDashboard = () => {
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
      <View style={styles.screen}>
        <DashboardHeader count={0} allClear={false} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </View>
    );
  }

  if (forbidden) {
    return (
      <View style={styles.screen}>
        <DashboardHeader count={0} allClear={false} />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={32} color={SUBTLE} />
          <Text style={styles.noticeText}>The review dashboard is available to owners only.</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <DashboardHeader count={0} allClear={false} />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (items.length === 0 || !selected) {
    return <EmptyDashboard trainingStats={trainingStats} />;
  }

  return (
    <View style={styles.screen}>
      <DashboardHeader count={items.length} allClear={false} />
      <TrainingStatsLine stats={trainingStats} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsBar}
        contentContainerStyle={styles.chipsContent}
      >
        {items.map((entry) => {
          const active = entry.reviewId === selected.reviewId;
          return (
            <Pressable
              key={entry.reviewId}
              style={[styles.chip, active ? styles.chipActive : null]}
              onPress={() => {
                setSelectedId(entry.reviewId);
                setEditing(false);
              }}
            >
              <View style={[styles.chipDot, entry.safetyCategory ? styles.chipDotSafety : null]} />
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]} numberOfLines={1}>
                {entry.askedByUsername ? `@${entry.askedByUsername}` : shortAsker(entry.askedByUserId)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.detail} showsVerticalScrollIndicator={false}>
        <View style={styles.detailMeta}>
          <Text style={styles.detailAsker}>{selected.askedByUsername ? `@${selected.askedByUsername}` : shortAsker(selected.askedByUserId)}</Text>
          <Text style={styles.detailTime}>{formatTime(selected.createdAtIso)}</Text>
        </View>

        <Text style={styles.sectionLabel}>Question</Text>
        <View style={styles.questionBox}>
          <Text style={styles.questionText}>{selected.questionBody}</Text>
        </View>

        {editing ? (
          <>
            {/* Original AI draft (read-only) — only when a real AI draft exists. With no draft
                (drafting unavailable, or safety-held), there is nothing to show above the editor. */}
            {selected.hasDraft ? (
              <>
                <View style={styles.draftHeader}>
                  <Text style={styles.sectionLabel}>Original AI draft</Text>
                  <View style={styles.needsCorrectionBadge}>
                    <Text style={styles.needsCorrectionText}>Needs correction</Text>
                  </View>
                </View>
                <View style={styles.draftReadonlyBox}>
                  <Text style={styles.draftReadonlyText}>{selected.draftBody}</Text>
                </View>
              </>
            ) : null}

            {/* Editable answer with Reset + character count. */}
            <View style={styles.draftHeader}>
              <Text style={styles.sectionLabelCyan}>Your {selected.hasDraft ? 'corrected ' : ''}answer</Text>
              <Pressable
                style={styles.resetBtn}
                onPress={() => setDraft(selected.hasDraft ? selected.draftBody : '')}
                disabled={busy}
              >
                <Ionicons name="refresh" size={11} color={SUBTLE} />
                <Text style={styles.resetText}>Reset</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.editInput}
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder={selected.hasDraft ? 'Correct the answer before approving…' : 'Write the answer before approving…'}
              placeholderTextColor={SUBTLE}
              editable={!busy}
            />
            <Text style={styles.charCount}>{draft.length} characters</Text>

            {/* Safety reminder banner. */}
            <View style={styles.safetyBanner}>
              <Ionicons name="warning-outline" size={15} color="#FBBF24" />
              <Text style={styles.safetyBannerText}>
                Make sure the corrected wording never pressures someone to reveal their location or
                identity before they&apos;re ready.
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.draftHeader}>
              <Text style={styles.sectionLabel}>{selected.hasDraft ? 'AI draft' : 'No AI draft'}</Text>
              <View style={styles.notSentBadge}>
                <Ionicons name="sparkles" size={8} color={ACCENT_LIGHT} />
                <Text style={styles.notSentText}>Not sent</Text>
              </View>
            </View>
            <View style={styles.draftBox}>
              <Text style={styles.draftText}>
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
          <View style={styles.pluginPickerWrap}>
            <Text style={styles.sectionLabel}>Applicable plugins</Text>
            <Text style={styles.pluginPickerHint}>Tag the plugins this answer points to (optional).</Text>
            <View style={styles.pluginChipWrap}>
              {plugins.map((p) => {
                const on = selectedSlugs.includes(p.slug);
                return (
                  <Pressable
                    key={p.slug}
                    style={[styles.pluginChip, on ? styles.pluginChipOn : null]}
                    onPress={() => togglePluginSlug(p.slug)}
                  >
                    <Text style={[styles.pluginChipText, on ? styles.pluginChipTextOn : null]}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {actionError && <Text style={styles.actionError}>{actionError}</Text>}
        {editing ? (
          // Edit mode: primary = approve the corrected answer (disabled while empty), then Reject.
          <>
            <Pressable
              style={[styles.approveBtn, busy || draft.trim().length === 0 ? styles.btnBusy : null]}
              onPress={() => resolve('correct')}
              disabled={busy || draft.trim().length === 0}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.approveText}>Approve corrected</Text>
                </>
              )}
            </Pressable>
            <View style={styles.secondaryRow}>
              <Pressable style={styles.editBtn} onPress={() => setEditing(false)} disabled={busy}>
                <Ionicons name="arrow-back" size={14} color={ACCENT_LIGHT} />
                <Text style={styles.editText}>Cancel edit</Text>
              </Pressable>
              <Pressable style={styles.rejectBtn} onPress={() => resolve('reject')} disabled={busy}>
                <Ionicons name="close" size={14} color="#F87171" />
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
            </View>
          </>
        ) : (
          // Default view: Approve & send (only when a real AI draft exists to send), then
          // Edit & approve + Reject. With no draft the owner must author the answer via Edit.
          <>
            {selected.hasDraft ? (
              <Pressable
                style={[styles.approveBtn, busy ? styles.btnBusy : null]}
                onPress={() => resolve('approve')}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.approveText}>Approve &amp; send</Text>
                  </>
                )}
              </Pressable>
            ) : null}
            <View style={styles.secondaryRow}>
              <Pressable style={styles.editBtn} onPress={beginEdit} disabled={busy}>
                <Ionicons name="pencil" size={14} color={ACCENT_LIGHT} />
                <Text style={styles.editText}>Edit &amp; approve</Text>
              </Pressable>
              <Pressable style={styles.rejectBtn} onPress={() => resolve('reject')} disabled={busy}>
                <Ionicons name="close" size={14} color="#F87171" />
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
    color: TEXT,
  },
  headerSub: {
    fontSize: 11,
    color: SUBTLE,
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
    color: '#22C55E',
  },
  trainingStatsLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: PANEL,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  trainingStatsText: {
    flexShrink: 1,
    fontSize: 11,
    color: SUBTLE,
  },
  trainingStatsStrong: {
    color: '#E5E7EB',
    fontWeight: '600',
  },
  trainingStatsDim: {
    color: '#4B5563',
  },
  chipsBar: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
    borderColor: BORDER,
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
    color: '#9CA3AF',
    maxWidth: 120,
  },
  chipTextActive: {
    color: TEXT,
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
    color: SUBTLE,
  },
  detailTime: {
    fontSize: 11,
    color: SUBTLE,
    marginLeft: 'auto',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: SUBTLE,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 8,
  },
  pluginPickerWrap: { marginTop: 14 },
  pluginPickerHint: { fontSize: 11, color: SUBTLE, marginBottom: 8 },
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
  pluginChipText: { fontSize: 12, fontWeight: '600', color: SUBTLE },
  pluginChipTextOn: { color: ACCENT_LIGHT },
  questionBox: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  questionText: {
    fontSize: 14,
    color: TEXT,
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
    color: '#E8EAF0',
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
    color: SUBTLE,
  },
  charCount: {
    fontSize: 10,
    color: '#4B5563',
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
    borderColor: BORDER,
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
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    color: '#E8EAF0',
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
    borderColor: BORDER,
  },
  provenanceKey: {
    fontSize: 10,
    color: SUBTLE,
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
    borderTopColor: BORDER,
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
    color: SUBTLE,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
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
    color: TEXT,
  },
  emptyBody: {
    fontSize: 13,
    color: '#9CA3AF',
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
    color: '#4B5563',
  },
});
