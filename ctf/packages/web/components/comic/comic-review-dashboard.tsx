'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Check, FileText, Inbox, Pencil, RotateCcw,
  ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { PluginRailFooter } from '@/components/shared/plugin-rail-footer';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import { useTheme } from '@/hooks/useTheme';
import { getComicTokens } from './comic-shared';
import type { ComicReviewItem, ComicTrainingStats } from '../../lib/comic/types';
import styles from './comic-review-dashboard.module.css';

type ReviewListResponse = {
  ok: true;
  items: ComicReviewItem[];
  pagination: { page: number; pageSize: number; total: number };
};

type TrainingStatsResponse = { ok: true; stats: ComicTrainingStats };

// Compact "Training examples collected: N" line for the queue header. Read-only and best-effort: the
// caller only renders this when the stats fetch succeeded, so a failure simply hides the number.
function TrainingStatsBadge({ stats }: { stats: ComicTrainingStats }) {
  const { theme } = useTheme();
  const t = getComicTokens(theme);
  const pending = stats.trainingExamplesByStatus.pending ?? 0;
  const exported = stats.trainingExamplesByStatus.exported ?? 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.SUBTLE, flexWrap: 'wrap' }}>
      <strong style={{ color: '#E5E7EB', fontWeight: 600 }}>Training examples collected:</strong>{' '}
      <span style={{ color: '#E5E7EB', fontWeight: 600 }}>{stats.trainingExamplesTotal}</span>
      <span style={{ color: t.FAINT }}>
        ({pending} awaiting export · {exported} exported · {stats.ratedAnswersTotal} rated answers)
      </span>
    </span>
  );
}

// A plugin option for the "Applicable plugins" picker. Sourced from /api/plugins, which returns the
// visible registry (operator-only plugins are filtered for non-admins; admins get the full list).
type PluginOption = { slug: string; name: string };

type PluginsResponse = {
  plugins: Array<{ slug: string; name: string }>;
};

type LoadState = 'loading' | 'ready' | 'error';

type Resolution = 'approve' | 'correct' | 'reject';

type ConfidenceBand = {
  label: string;
  className: string;
  pct: number | null;
};

// Map the (possibly null) NLU confidence to a band. Confidence is no longer populated, so it is
// typically null — surfaced honestly as "Not yet scored" rather than a fabricated percentage.
function confidenceBand(confidence: number | null): ConfidenceBand {
  if (confidence === null) {
    return { label: 'Not yet scored', className: styles.confNone, pct: null };
  }
  const pct = Math.round(confidence * 100);
  if (pct >= 80) return { label: 'High confidence', className: styles.confHigh, pct };
  if (pct >= 50) return { label: 'Medium confidence', className: styles.confMedium, pct };
  return { label: 'Low confidence', className: styles.confLow, pct };
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'just now';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload ? payload.message : 'Request failed.';
    throw new Error(typeof message === 'string' ? message : 'Request failed.');
  }
  return payload as T;
}

const REVIEWER_GUIDANCE = [
  "Never approve answers that reveal a survivor's location or identity.",
  'Correct tone to be warm, plain, and non-judgmental.',
  'Reject and escalate anything involving immediate danger.',
];

// Confirmation copy before any action that changes what a survivor sees: publishing (approve/correct)
// sends the answer; reject discards the draft. A misclick must not silently push or drop a reply.
function buildConfirmPrompt(resolution: Resolution): string {
  if (resolution === 'reject') return 'Reject this draft? The survivor will not receive this answer.';
  if (resolution === 'correct') return 'Approve and send your corrected answer to the survivor?';
  return 'Approve and send this answer to the survivor?';
}

// Build the resolve request body. The corrected text rides only with a "correct"; the chosen
// applicable plugins ride with any publish (approve/correct) so the server can validate/dedupe/cap them.
function buildResolveBody(
  resolution: Resolution,
  correctedBody: string,
  selectedPluginSlugs: string[],
): { resolution: string; correctedBody?: string; linkedPluginSlugs?: string[] } {
  const requestBody: { resolution: string; correctedBody?: string; linkedPluginSlugs?: string[] } = { resolution };
  if (resolution === 'correct') {
    requestBody.correctedBody = correctedBody.trim();
  }
  if (resolution === 'approve' || resolution === 'correct') {
    requestBody.linkedPluginSlugs = selectedPluginSlugs;
  }
  return requestBody;
}

// Label for the regenerate/generate button: which verb, and whether a draft already exists.
function regenerateLabel(regenerating: boolean, hasDraft: boolean): string {
  if (regenerating) return hasDraft ? 'Regenerating…' : 'Generating…';
  return hasDraft ? 'Regenerate draft' : 'Generate draft';
}

// At-a-glance counts of the collected training signal (owner corrections + rated answers).
// Best-effort: a failure just leaves the counter hidden, never blocks the review queue.
function useTrainingStats(): ComicTrainingStats | null {
  const [trainingStats, setTrainingStats] = useState<ComicTrainingStats | null>(null);
  useEffect(() => {
    let canceled = false;
    void requestJson<TrainingStatsResponse>('/api/comic/admin/training-stats')
      .then((payload) => {
        if (!canceled) setTrainingStats(payload.stats);
      })
      .catch(() => {
        /* training counter is best-effort */
      });
    return () => {
      canceled = true;
    };
  }, []);
  return trainingStats;
}

// Load the plugin registry once for the "Applicable plugins" picker. Best-effort: a failure just
// leaves the picker empty and never blocks reviewing.
function usePluginOptions(): PluginOption[] {
  const [pluginOptions, setPluginOptions] = useState<PluginOption[]>([]);
  useEffect(() => {
    let canceled = false;
    void requestJson<PluginsResponse>('/api/plugins')
      .then((payload) => {
        if (!canceled && Array.isArray(payload.plugins)) {
          setPluginOptions(payload.plugins.map((plugin) => ({ slug: plugin.slug, name: plugin.name })));
        }
      })
      .catch(() => {
        /* picker is best-effort */
      });
    return () => {
      canceled = true;
    };
  }, []);
  return pluginOptions;
}

// All queue state, effects, and resolve/regenerate handlers for the dashboard. Grouped in one hook so
// the component stays a thin render, while keeping every hook in a fixed, unconditional order.
function useComicReview() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [items, setItems] = useState<ComicReviewItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The corrected-text buffer for the selected item (the editable corrected answer).
  const [correctedBody, setCorrectedBody] = useState('');
  // Whether the detail is in edit mode (Edit & approve) vs the default approve/reject view.
  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState(false);
  // "Regenerate draft" in-flight + a note shown when the engine is still unreachable.
  const [regenerating, setRegenerating] = useState(false);
  const [regenNote, setRegenNote] = useState<string | null>(null);
  // The slugs the reviewer has toggled on for the selected item. The chosen slugs are sent with
  // approve/correct so the published answer renders those plugin links.
  const [selectedPluginSlugs, setSelectedPluginSlugs] = useState<string[]>([]);
  const trainingStats = useTrainingStats();
  const pluginOptions = usePluginOptions();

  const refresh = useCallback(async () => {
    try {
      // Follow pagination so the full pending queue shows, not just the first page. Page size is
      // capped server-side (COMIC_MAX_PAGE_SIZE); loop until every pending item is collected.
      const pageSize = 100;
      const collected: ComicReviewItem[] = [];
      let page = 1;
      // Guard against an unbounded loop if total/pageSize ever disagree.
      for (let safety = 0; safety < 1000; safety += 1) {
        const payload = await requestJson<ReviewListResponse>(
          `/api/comic/review?page=${page}&pageSize=${pageSize}`,
        );
        collected.push(...payload.items);
        if (collected.length >= payload.pagination.total || payload.items.length === 0) {
          break;
        }
        page += 1;
      }
      setItems(collected);
      setLoadState('ready');
      setError(null);
      return collected;
    } catch (loadError) {
      setLoadState('error');
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the review queue.');
      return [] as ComicReviewItem[];
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the queue fresh so a question a survivor just sent to @comic shows up
  // without a manual page reload. Poll only while the reviewer is idle — no item
  // open, not editing, no action in flight — so a background refresh can never
  // wipe an in-progress correction or steal the current selection.
  useEffect(() => {
    if (selectedId !== null || editing || resolving) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [refresh, selectedId, editing, resolving]);

  const selected = useMemo(
    () => items.find((item) => item.reviewId === selectedId) ?? null,
    [items, selectedId],
  );

  // When the selection changes, seed the corrected-text buffer. Bot-draft items seed from the draft
  // so the owner edits it; human-first (safety-flagged) items have no AI draft, so start blank and let
  // the reviewer author the answer.
  useEffect(() => {
    if (selected) {
      // Seed the editor from a real AI draft so the owner can refine it. When no draft is attached
      // (still generating, drafting unavailable, or a safety-held question), start blank — never seed
      // the box with the question text, which would otherwise look like an AI draft.
      setCorrectedBody(selected.hasDraft ? selected.draftBody : '');
      setEditing(false);
      setRegenNote(null);
      // Seed the "Applicable plugins" picker from any links already tagged on the item; a pending
      // review has none yet, so this clears the picker for a fresh selection.
      const seeded = (selected as { linkedPlugins?: Array<{ slug: string }> }).linkedPlugins;
      setSelectedPluginSlugs(Array.isArray(seeded) ? seeded.map((plugin) => plugin.slug) : []);
    }
  }, [selected]);

  // Toggle a plugin slug in the "Applicable plugins" picker.
  const togglePluginSlug = useCallback((slug: string) => {
    setSelectedPluginSlugs((previous) =>
      previous.includes(slug) ? previous.filter((value) => value !== slug) : [...previous, slug],
    );
  }, []);

  const resolveSelected = useCallback(
    async (resolution: Resolution) => {
      if (!selected || resolving) return;
      if (typeof window !== 'undefined' && !window.confirm(buildConfirmPrompt(resolution))) {
        return;
      }

      setResolving(true);
      setError(null);
      const requestBody = buildResolveBody(resolution, correctedBody, selectedPluginSlugs);

      try {
        await requestJson(`/api/comic/review/${selected.reviewId}/resolve`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
          body: JSON.stringify(requestBody),
        });
        const remaining = await refresh();
        // Advance to the next pending item, or clear the selection when the queue is empty.
        setSelectedId(remaining.length > 0 ? remaining[0].reviewId : null);
      } catch (resolveError) {
        setError(resolveError instanceof Error ? resolveError.message : 'Unable to resolve this item.');
      } finally {
        setResolving(false);
      }
    },
    [selected, correctedBody, resolving, refresh, selectedPluginSlugs],
  );

  // Re-run the AI draft for the selected item — used after the engine (the RunPod/Ollama endpoint)
  // was down at ask time and is back up. On success the item now shows an AI draft; if the engine is
  // still unreachable, show a note and leave it human-first.
  const regenerateSelected = useCallback(async () => {
    if (!selected || regenerating) return;
    setRegenerating(true);
    setRegenNote(null);
    setError(null);
    try {
      const result = await requestJson<{ ok: true; attached: boolean; reason: string | null }>(
        `/api/comic/review/${selected.reviewId}/regenerate`,
        { method: 'POST', headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' } },
      );
      if (result.attached) {
        await refresh();
      } else {
        // Show the real reason the draft failed (timeout, model-not-found, auth, network) rather than
        // a blanket "unreachable", then point at the two ways forward.
        setRegenNote(`${result.reason ?? 'No draft was generated.'} Or use Edit & approve to write the answer yourself.`);
      }
    } catch (regenError) {
      setError(regenError instanceof Error ? regenError.message : 'Unable to regenerate the draft.');
    } finally {
      setRegenerating(false);
    }
  }, [selected, regenerating, refresh]);

  return {
    loadState,
    items,
    selectedId,
    setSelectedId,
    error,
    correctedBody,
    setCorrectedBody,
    editing,
    setEditing,
    resolving,
    regenerating,
    regenNote,
    trainingStats,
    pluginOptions,
    selectedPluginSlugs,
    selected,
    pendingCount: items.length,
    togglePluginSlug,
    resolveSelected,
    regenerateSelected,
  };
}

// STATE: Authenticated + Loading.
function LoadingScreen() {
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingInner}>
        <div className={styles.loadingLine}>EXIT THEIR ECONOMY</div>
        <div className={styles.loadingLine}>EXIT THE PSYOP</div>
      </div>
    </div>
  );
}

function IconRail({ accent }: { accent: string }) {
  return (
    <aside className={styles.iconRail}>
      <div className={styles.iconRailLogo} aria-hidden="true">
        <ShieldCheck size={20} color={accent} />
      </div>
      <button type="button" className={`${styles.iconRailBtn} ${styles.iconRailBtnActive}`} aria-label="Review queue" aria-current="page">
        <Inbox size={20} />
      </button>
      {/* Shared bottom of every plugin rail: back to all apps, account and settings, account menu. */}
      <PluginRailFooter />
    </aside>
  );
}

function QueueItemButton({
  item,
  active,
  onSelect,
}: {
  item: ComicReviewItem;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const band = confidenceBand(item.nluConfidence);
  return (
    <button
      type="button"
      className={active ? `${styles.queueItem} ${styles.queueItemActive}` : styles.queueItem}
      onClick={() => onSelect(item.reviewId)}
      aria-current={active ? 'true' : undefined}
    >
      <span className={styles.queueItemQuestion}>{item.questionBody}</span>
      <span className={styles.queueItemFooter}>
        <span className={`${styles.queueItemConf} ${band.className}`}>
          <span className={styles.queueItemConfDot} /> {band.label}
        </span>
        {item.safetyCategory ? (
          <span className={styles.queueItemSafety}>
            <AlertTriangle size={10} /> {item.safetyCategory.replace(/_/g, ' ')}
          </span>
        ) : null}
        <span className={styles.queueItemTime}>{formatRelativeTime(item.createdAtIso)}</span>
      </span>
    </button>
  );
}

function QueueEmpty() {
  return (
    <div className={styles.queueEmpty}>
      <div className={styles.queueEmptyIcon} aria-hidden="true">
        <Inbox size={20} color="#22C55E" />
      </div>
      <div className={styles.queueEmptyTitle}>Queue is clear</div>
      <div className={styles.queueEmptyText}>New AI Assistant drafts will appear here for review.</div>
    </div>
  );
}

function QueueSidebar({
  items,
  selectedId,
  onSelect,
  pendingCount,
  trainingStats,
}: {
  items: ComicReviewItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  pendingCount: number;
  trainingStats: ComicTrainingStats | null;
}) {
  return (
    <aside className={styles.queueSidebar}>
      <div className={styles.queueHeader}>
        <div className={styles.queueKicker}>Review Queue</div>
        <div className={styles.queueSub}>AI Assistant drafts awaiting human review</div>
        {trainingStats ? (
          <div style={{ margin: '0 0 4px' }}>
            <TrainingStatsBadge stats={trainingStats} />
          </div>
        ) : null}
        {pendingCount > 0 ? (
          <span className={styles.queuePendingBadge}>{pendingCount} pending</span>
        ) : (
          <span className={styles.queueClearBadge}>0 pending</span>
        )}
      </div>

      {pendingCount === 0 ? (
        <QueueEmpty />
      ) : (
        <div className={styles.queueList}>
          {items.map((item) => (
            <QueueItemButton
              key={item.reviewId}
              item={item}
              active={item.reviewId === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </aside>
  );
}

function MainHeaderBar({
  editing,
  selected,
  accent,
  onExitEdit,
}: {
  editing: boolean;
  selected: ComicReviewItem | null;
  accent: string;
  onExitEdit: () => void;
}) {
  const isEditingSelected = editing && selected !== null;
  const band = selected ? confidenceBand(selected.nluConfidence) : null;
  return (
    <header className={styles.mainHeader}>
      {isEditingSelected ? (
        <button type="button" className={styles.backBtn} onClick={onExitEdit}>
          <ArrowLeft size={14} /> Queue
        </button>
      ) : (
        <Sparkles size={18} color={accent} />
      )}
      <div className={styles.mainHeaderText}>
        <div className={styles.mainHeaderTitle}>
          {isEditingSelected ? (
            <>
              <Pencil size={15} color={accent} /> Edit &amp; approve answer
            </>
          ) : (
            'Review & Correction Dashboard'
          )}
        </div>
        <div className={styles.mainHeaderSub}>Approve, correct, or reject AI Assistant answers before they reach survivors</div>
      </div>
      {isEditingSelected && band ? (
        <span className={`${styles.headerConfPill} ${band.className}`}>
          <AlertTriangle size={12} /> {band.label}
        </span>
      ) : null}
      {/* Desktop-only: at phone width the shared mobile bar above already carries this pill. */}
      <span className={styles.memberViewPill}>
        <PluginUserShellButton href="/" accent={accent} label="Commons" />
      </span>
    </header>
  );
}

function EmptyDetailState({
  pendingCount,
  loadState,
  error,
  accent,
}: {
  pendingCount: number;
  loadState: LoadState;
  error: string | null;
  accent: string;
}) {
  // STATE: Authenticated + Empty (queue genuinely clear — no pending items).
  if (pendingCount === 0 && loadState === 'ready' && !error) {
    return (
      <div className={styles.allCaughtUp}>
        <div className={styles.allCaughtUpIcon} aria-hidden="true">
          <Check size={42} color="#22C55E" />
        </div>
        <div className={styles.allCaughtUpTitle}>All caught up</div>
        <div className={styles.allCaughtUpText}>
          Every AI Assistant answer has been reviewed. Survivors only ever see answers a human has approved.
        </div>
      </div>
    );
  }
  // Items remain (or the queue failed to load) but none is selected: prompt to pick one
  // rather than implying the queue is clear.
  return (
    <div className={styles.allCaughtUp}>
      <div className={styles.allCaughtUpIcon} aria-hidden="true">
        <Inbox size={42} color={accent} />
      </div>
      <div className={styles.allCaughtUpTitle}>
        {error ? 'Queue unavailable' : 'Select an answer to review'}
      </div>
      <div className={styles.allCaughtUpText}>
        {error
          ? 'The review queue could not be loaded. Retry in a moment.'
          : 'Choose an item from the queue to approve, correct, or reject the AI Assistant draft.'}
      </div>
    </div>
  );
}

function DetailMeta({ selected }: { selected: ComicReviewItem }) {
  return (
    <div className={styles.detailMeta}>
      <span className={styles.detailChannel}>@comic</span>
      <span>Asked by {selected.askedByUsername ? `@${selected.askedByUsername}` : selected.askedByUserId}</span>
      <span className={styles.detailTime}>{formatRelativeTime(selected.createdAtIso)}</span>
    </div>
  );
}

// Edit mode: original AI draft (read-only, when present) beside the editable corrected answer.
function EditView({
  selected,
  correctedBody,
  setCorrectedBody,
}: {
  selected: ComicReviewItem;
  correctedBody: string;
  setCorrectedBody: (value: string) => void;
}) {
  return (
    <div className={styles.detailTwoCol}>
      {/* Original AI draft (read-only) — only when a real AI draft exists. With no draft
          (drafting unavailable, or safety-held), there is nothing to show beside the editor. */}
      {selected.hasDraft ? (
        <div className={styles.detailCol}>
          <div className={styles.detailColHead}>
            <span className={styles.detailLabel}>Original AI draft</span>
            <span className={styles.needsCorrectionTag}>Needs correction</span>
          </div>
          <div className={styles.draftReadonly}>{selected.draftBody}</div>
        </div>
      ) : null}

      {/* Corrected text (editable) */}
      <div className={styles.detailCol}>
        <div className={styles.detailColHead}>
          <span className={styles.detailLabelCyan}>Your {selected.hasDraft ? 'corrected ' : ''}answer</span>
          <button
            type="button"
            className={styles.resetBtn}
            onClick={() => setCorrectedBody(selected.hasDraft ? selected.draftBody : '')}
          >
            <RotateCcw size={11} /> Reset
          </button>
        </div>
        <label className={styles.visuallyHidden} htmlFor="comic-corrected">Your corrected answer</label>
        <textarea
          id="comic-corrected"
          className={styles.correctedTextarea}
          value={correctedBody}
          onChange={(event) => setCorrectedBody(event.target.value)}
        />
        <div className={styles.charCount}>{correctedBody.length} characters</div>
      </div>
    </div>
  );
}

// Default view: the AI draft (or the "no draft" explanation) shown read-only before any action.
function DraftView({ selected }: { selected: ComicReviewItem }) {
  return (
    <div>
      <div className={styles.detailColHead}>
        <span className={styles.detailLabel}>{selected.hasDraft ? 'AI Assistant draft' : 'No AI draft'}</span>
        <span className={styles.notYetSentTag}>
          <Sparkles size={9} /> Not yet sent
        </span>
      </div>
      <div className={styles.draftCard}>
        {selected.hasDraft
          ? selected.draftBody
          : selected.safetyCategory
            ? 'This safety-sensitive question was held for a person to answer directly — the AI Assistant did not draft a reply. Use Edit & approve to write the response.'
            : 'No AI draft yet — it may still be generating, or drafting was unavailable. Use Generate draft to try again, or Edit & approve to write the answer.'}
      </div>
    </div>
  );
}

// Source + confidence (real fields only — no fabricated sources).
function SourcePanel({ selected, accent }: { selected: ComicReviewItem; accent: string }) {
  return (
    <div className={styles.detailCol}>
      <div className={styles.detailLabel}>Source</div>
      <div className={styles.provenanceList}>
        {selected.hasDraft ? (
          <div className={styles.provenanceRow}>
            <FileText size={13} color={accent} /> Drafted by: {selected.engine}
          </div>
        ) : null}
        <div className={styles.provenanceRow}>
          <FileText size={13} color={accent} /> Intent: {selected.intent ?? 'not classified'}
        </div>
        {selected.safetyCategory ? (
          <div className={styles.provenanceRow}>
            <AlertTriangle size={13} color="#F59E0B" /> Safety: {selected.safetyCategory.replace(/_/g, ' ')} (human-first)
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConfidencePanel({ selected }: { selected: ComicReviewItem }) {
  const band = confidenceBand(selected.nluConfidence);
  return (
    <div className={styles.confCol}>
      <div className={styles.detailLabel}>Confidence</div>
      <div className={styles.confCard}>
        <div className={styles.confCardTop}>
          <span className={`${styles.confLabel} ${band.className}`}>{band.label}</span>
          {band.pct !== null ? (
            <span className={`${styles.confPct} ${band.className}`}>{band.pct}%</span>
          ) : null}
        </div>
        {band.pct !== null ? (
          <div className={styles.confTrack}>
            <div
              className={`${styles.confFill} ${band.className}`}
              style={{ width: `${band.pct}%` }}
            />
          </div>
        ) : (
          <div className={styles.confHint}>
            <AlertTriangle size={13} /> No confidence score yet — every draft is held for human review.
          </div>
        )}
      </div>
    </div>
  );
}

// Applicable plugins — shown in both the default (approve) view and the Edit view.
// The chosen plugins are sent on approve/correct and render as tappable links under
// the published answer.
function ApplicablePlugins({
  pluginOptions,
  selectedPluginSlugs,
  togglePluginSlug,
}: {
  pluginOptions: PluginOption[];
  selectedPluginSlugs: string[];
  togglePluginSlug: (slug: string) => void;
}) {
  return (
    <div>
      <div className={styles.detailLabel}>Applicable plugins</div>
      {pluginOptions.length > 0 ? (
        <>
          <div className={styles.pluginPicker} role="group" aria-label="Applicable plugins">
            {pluginOptions.map((plugin) => {
              const active = selectedPluginSlugs.includes(plugin.slug);
              return (
                <button
                  key={plugin.slug}
                  type="button"
                  className={active ? `${styles.pluginChip} ${styles.pluginChipActive}` : styles.pluginChip}
                  aria-pressed={active}
                  onClick={() => togglePluginSlug(plugin.slug)}
                >
                  {plugin.name}
                </button>
              );
            })}
          </div>
          <div className={styles.pluginPickerHint}>
            Pick the plugins this answer points to (up to 5). They show as tappable links beneath the answer.
          </div>
        </>
      ) : (
        <div className={styles.pluginPickerHint}>Plugin list unavailable right now.</div>
      )}
    </div>
  );
}

function DetailActions({
  editing,
  selected,
  resolving,
  regenerating,
  correctedBody,
  onResolve,
  onRegenerate,
  onEdit,
}: {
  editing: boolean;
  selected: ComicReviewItem;
  resolving: boolean;
  regenerating: boolean;
  correctedBody: string;
  onResolve: (resolution: Resolution) => void;
  onRegenerate: () => void;
  onEdit: () => void;
}) {
  if (editing) {
    return (
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.approveBtn}
          disabled={resolving || correctedBody.trim().length === 0}
          onClick={() => onResolve('correct')}
        >
          <Check size={16} /> Approve corrected answer
        </button>
        <button type="button" className={styles.rejectBtn} disabled={resolving} onClick={() => onResolve('reject')}>
          <X size={15} /> Reject
        </button>
      </div>
    );
  }
  return (
    <div className={styles.actions}>
      {selected.hasDraft ? (
        <button type="button" className={styles.approveBtn} disabled={resolving} onClick={() => onResolve('approve')}>
          <Check size={16} /> Approve &amp; send
        </button>
      ) : null}
      <button type="button" className={styles.editBtn} disabled={resolving || regenerating} onClick={onRegenerate}>
        <RotateCcw size={15} />{' '}
        {regenerateLabel(regenerating, selected.hasDraft)}
      </button>
      <button type="button" className={styles.editBtn} disabled={resolving} onClick={onEdit}>
        <Pencil size={15} /> Edit &amp; approve
      </button>
      <button type="button" className={styles.rejectBtn} disabled={resolving} onClick={() => onResolve('reject')}>
        <X size={15} /> Reject
      </button>
    </div>
  );
}

type ReviewDetailProps = {
  selected: ComicReviewItem;
  editing: boolean;
  correctedBody: string;
  setCorrectedBody: (value: string) => void;
  pluginOptions: PluginOption[];
  selectedPluginSlugs: string[];
  togglePluginSlug: (slug: string) => void;
  accent: string;
  resolving: boolean;
  regenerating: boolean;
  regenNote: string | null;
  onMobileBack: () => void;
  onResolve: (resolution: Resolution) => void;
  onRegenerate: () => void;
  onEdit: () => void;
};

function ReviewDetail(props: ReviewDetailProps) {
  const { selected, editing, correctedBody, setCorrectedBody, accent, regenNote } = props;
  return (
    <div className={styles.detail}>
      {/* Mobile-only: return to the queue list (the sidebar is hidden at phone width). */}
      <button type="button" className={styles.mobileQueueBack} onClick={props.onMobileBack}>
        <ArrowLeft size={14} /> Back to queue
      </button>

      {/* Asker meta */}
      <DetailMeta selected={selected} />

      {/* Question */}
      <div>
        <div className={styles.detailLabel}>Survivor&apos;s question</div>
        <div className={styles.detailQuestion}>{selected.questionBody}</div>
      </div>

      {editing ? (
        <EditView selected={selected} correctedBody={correctedBody} setCorrectedBody={setCorrectedBody} />
      ) : (
        <DraftView selected={selected} />
      )}

      <div className={styles.detailTwoCol}>
        <SourcePanel selected={selected} accent={accent} />
        <ConfidencePanel selected={selected} />
      </div>

      <ApplicablePlugins
        pluginOptions={props.pluginOptions}
        selectedPluginSlugs={props.selectedPluginSlugs}
        togglePluginSlug={props.togglePluginSlug}
      />

      <DetailActions
        editing={editing}
        selected={selected}
        resolving={props.resolving}
        regenerating={props.regenerating}
        correctedBody={correctedBody}
        onResolve={props.onResolve}
        onRegenerate={props.onRegenerate}
        onEdit={props.onEdit}
      />

      {regenNote ? (
        <div className={styles.confHint} role="status" style={{ marginTop: 10 }}>
          <AlertTriangle size={13} /> {regenNote}
        </div>
      ) : null}
    </div>
  );
}

function RightRailGuidance({ accent }: { accent: string }) {
  return (
    <aside className={styles.rightRail}>
      <div className={styles.guidanceCard}>
        <div className={styles.guidanceHead}>
          <ShieldCheck size={15} color={accent} />
          <span>Reviewer guidance</span>
        </div>
        {REVIEWER_GUIDANCE.map((g) => (
          <div key={g} className={styles.guidanceItem}>
            <span className={styles.guidanceBullet}>·</span> {g}
          </div>
        ))}
      </div>
    </aside>
  );
}

export function ComicReviewDashboard() {
  const { theme } = useTheme();
  const t = getComicTokens(theme);
  const review = useComicReview();

  if (review.loadState === 'loading') {
    return <LoadingScreen />;
  }

  const { selected } = review;
  return (
    <div className={styles.mobileFrame}>
      {/* Standard on-brand top bar. Self-gates on breakpoint: at phone width the left icon rail
          (with its back control) is hidden, so this renders the full mobile header — back chevron,
          brand mark, title, and the shared report-bug / settings / account cluster. On desktop the
          rail already carries the back control, so desktopBack={false} makes this render nothing. */}
      <MobileScreenHeader
        title="AI Assistant"
        accent={t.ACCENT}
        icon={<ShieldCheck size={18} color={t.ACCENT} />}
        desktopBack={false}
        actions={<PluginUserShellButton href="/" accent={t.ACCENT} label="Commons" />}
      />
      <div className={`${styles.dashboard} ${selected ? styles.dashboardDetail : styles.dashboardList}`}>
        {/* Icon rail */}
        <IconRail accent={t.ACCENT} />

        {/* Queue sidebar */}
        <QueueSidebar
          items={review.items}
          selectedId={review.selectedId}
          onSelect={review.setSelectedId}
          pendingCount={review.pendingCount}
          trainingStats={review.trainingStats}
        />

        {/* Main detail */}
        <div className={styles.main}>
          <MainHeaderBar
            editing={review.editing}
            selected={selected}
            accent={t.ACCENT}
            onExitEdit={() => review.setEditing(false)}
          />

          {review.error ? <div className={styles.errorBanner} role="status">{review.error}</div> : null}

          <div className={styles.mainBody}>
            {!selected ? (
              <EmptyDetailState
                pendingCount={review.pendingCount}
                loadState={review.loadState}
                error={review.error}
                accent={t.ACCENT}
              />
            ) : (
              <ReviewDetail
                selected={selected}
                editing={review.editing}
                correctedBody={review.correctedBody}
                setCorrectedBody={review.setCorrectedBody}
                pluginOptions={review.pluginOptions}
                selectedPluginSlugs={review.selectedPluginSlugs}
                togglePluginSlug={review.togglePluginSlug}
                accent={t.ACCENT}
                resolving={review.resolving}
                regenerating={review.regenerating}
                regenNote={review.regenNote}
                onMobileBack={() => {
                  review.setEditing(false);
                  review.setSelectedId(null);
                }}
                onResolve={review.resolveSelected}
                onRegenerate={review.regenerateSelected}
                onEdit={() => review.setEditing(true)}
              />
            )}
          </div>
        </div>

        {/* Right rail — reviewer guidance */}
        <RightRailGuidance accent={t.ACCENT} />
      </div>
    </div>
  );
}
