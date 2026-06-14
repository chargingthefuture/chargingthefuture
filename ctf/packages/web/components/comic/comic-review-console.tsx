'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Check, FileText, Inbox, Pencil, RotateCcw,
  ShieldCheck, Sparkles, X,
} from 'lucide-react';
import type { ComicReviewItem } from '../../lib/comic/types';
import styles from './comic-review-console.module.css';

type ReviewListResponse = {
  ok: true;
  items: ComicReviewItem[];
  pagination: { page: number; pageSize: number; total: number };
};

type LoadState = 'loading' | 'ready' | 'error';

type ServiceStatus = { configured: boolean; reachable: boolean; latencyMs: number | null };
type AiStatusResponse = {
  ok: true;
  rasa: ServiceStatus;
  ollama: ServiceStatus & { model: string };
};

function statusLabel(s: ServiceStatus): { text: string; color: string } {
  if (!s.configured) return { text: 'not configured', color: '#6B7280' };
  if (!s.reachable) return { text: 'unreachable', color: '#EF4444' };
  return { text: `reachable${s.latencyMs !== null ? ` · ${s.latencyMs}ms` : ''}`, color: '#22C55E' };
}

function ServiceStatusBadge({ name, status }: { name: string; status: ServiceStatus }) {
  const { text, color } = statusLabel(status);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9CA3AF' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} aria-hidden="true" />
      <strong style={{ color: '#E5E7EB', fontWeight: 600 }}>{name}</strong> {text}
    </span>
  );
}

type ConfidenceBand = {
  label: string;
  className: string;
  pct: number | null;
};

// Map the real (possibly null) NLU confidence to a band. Rasa is not deployed yet, so confidence
// is typically null — surfaced honestly as "Not yet scored" rather than a fabricated percentage.
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

export function ComicReviewConsole() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [items, setItems] = useState<ComicReviewItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The corrected-text buffer for the selected item (the editable corrected answer).
  const [correctedBody, setCorrectedBody] = useState('');
  // Whether the detail is in edit mode (Edit & approve) vs the default approve/reject view.
  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);

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

  // Live status of the AI backends the assistant depends on (Rasa = intent labels, Ollama = answer
  // drafts). Best-effort: a failure just leaves the panel hidden, never blocks the review queue.
  useEffect(() => {
    let cancelled = false;
    void requestJson<AiStatusResponse>('/api/comic/admin/ai-status')
      .then((payload) => {
        if (!cancelled) setAiStatus(payload);
      })
      .catch(() => {
        /* status panel is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => items.find((item) => item.reviewId === selectedId) ?? null,
    [items, selectedId],
  );

  // When the selection changes, seed the corrected-text buffer. Bot-draft items seed from the draft
  // so the owner edits it; human-first (safety-flagged) items have no AI draft, so start blank and let
  // the reviewer author the answer.
  useEffect(() => {
    if (selected) {
      setCorrectedBody(selected.safetyCategory ? '' : selected.draftBody);
      setEditing(false);
    }
  }, [selected]);

  const resolveSelected = useCallback(
    async (resolution: 'approve' | 'correct' | 'reject') => {
      if (!selected || resolving) return;

      // Confirm before any action that changes what a survivor sees: publishing (approve/correct)
      // sends the answer; reject discards the draft. A misclick must not silently push or drop a reply.
      const confirmPrompt =
        resolution === 'reject'
          ? 'Reject this draft? The survivor will not receive this answer.'
          : resolution === 'correct'
            ? 'Approve and send your corrected answer to the survivor?'
            : 'Approve and send this answer to the survivor?';
      if (typeof window !== 'undefined' && !window.confirm(confirmPrompt)) {
        return;
      }

      setResolving(true);
      setError(null);

      const requestBody: { resolution: string; correctedBody?: string } = { resolution };
      if (resolution === 'correct') {
        requestBody.correctedBody = correctedBody.trim();
      }

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
    [selected, correctedBody, resolving, refresh],
  );

  const pendingCount = items.length;

  // STATE: Authenticated + Loading.
  if (loadState === 'loading') {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingInner}>
          <div className={styles.loadingLine}>EXIT THEIR ECONOMY</div>
          <div className={styles.loadingLine}>EXIT THE PSYOP</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.console}>
      {/* Icon rail */}
      <aside className={styles.iconRail}>
        <div className={styles.iconRailLogo} aria-hidden="true">
          <ShieldCheck size={20} color="#0EA5E9" />
        </div>
        <button type="button" className={`${styles.iconRailBtn} ${styles.iconRailBtnActive}`} aria-label="Review queue" aria-current="page">
          <Inbox size={20} />
        </button>
        <div className={styles.iconRailAvatar} aria-hidden="true">O</div>
      </aside>

      {/* Queue sidebar */}
      <aside className={styles.queueSidebar}>
        <div className={styles.queueHeader}>
          <div className={styles.queueKicker}>Review Queue</div>
          <div className={styles.queueSub}>AI Assistant drafts awaiting human review</div>
          {aiStatus ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '8px 0 4px' }}>
              <ServiceStatusBadge name="Rasa" status={aiStatus.rasa} />
              <ServiceStatusBadge name="Ollama" status={aiStatus.ollama} />
            </div>
          ) : null}
          {pendingCount > 0 ? (
            <span className={styles.queuePendingBadge}>{pendingCount} pending</span>
          ) : (
            <span className={styles.queueClearBadge}>0 pending</span>
          )}
        </div>

        {pendingCount === 0 ? (
          <div className={styles.queueEmpty}>
            <div className={styles.queueEmptyIcon} aria-hidden="true">
              <Inbox size={20} color="#22C55E" />
            </div>
            <div className={styles.queueEmptyTitle}>Queue is clear</div>
            <div className={styles.queueEmptyText}>New AI Assistant drafts will appear here for review.</div>
          </div>
        ) : (
          <div className={styles.queueList}>
            {items.map((item) => {
              const band = confidenceBand(item.nluConfidence);
              const active = item.reviewId === selectedId;
              return (
                <button
                  key={item.reviewId}
                  type="button"
                  className={active ? `${styles.queueItem} ${styles.queueItemActive}` : styles.queueItem}
                  onClick={() => setSelectedId(item.reviewId)}
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
            })}
          </div>
        )}
      </aside>

      {/* Main detail */}
      <div className={styles.main}>
        <header className={styles.mainHeader}>
          {editing && selected ? (
            <button type="button" className={styles.backBtn} onClick={() => setEditing(false)}>
              <ArrowLeft size={14} /> Queue
            </button>
          ) : (
            <Sparkles size={18} color="#0EA5E9" />
          )}
          <div className={styles.mainHeaderText}>
            <div className={styles.mainHeaderTitle}>
              {editing && selected ? (
                <>
                  <Pencil size={15} color="#0EA5E9" /> Edit &amp; approve answer
                </>
              ) : (
                'Review & Correction Console'
              )}
            </div>
            <div className={styles.mainHeaderSub}>Approve, correct, or reject AI Assistant answers before they reach survivors</div>
          </div>
          {editing && selected ? (
            <span className={`${styles.headerConfPill} ${confidenceBand(selected.nluConfidence).className}`}>
              <AlertTriangle size={12} /> {confidenceBand(selected.nluConfidence).label}
            </span>
          ) : null}
        </header>

        {error ? <div className={styles.errorBanner} role="status">{error}</div> : null}

        <div className={styles.mainBody}>
          {!selected && pendingCount === 0 && loadState === 'ready' && !error ? (
            // STATE: Authenticated + Empty (queue genuinely clear — no pending items).
            <div className={styles.allCaughtUp}>
              <div className={styles.allCaughtUpIcon} aria-hidden="true">
                <Check size={42} color="#22C55E" />
              </div>
              <div className={styles.allCaughtUpTitle}>All caught up</div>
              <div className={styles.allCaughtUpText}>
                Every AI Assistant answer has been reviewed. Survivors only ever see answers a human has approved.
              </div>
            </div>
          ) : !selected ? (
            // Items remain (or the queue failed to load) but none is selected: prompt to pick one
            // rather than implying the queue is clear.
            <div className={styles.allCaughtUp}>
              <div className={styles.allCaughtUpIcon} aria-hidden="true">
                <Inbox size={42} color="#0EA5E9" />
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
          ) : (
            <div className={styles.detail}>
              {/* Asker meta */}
              <div className={styles.detailMeta}>
                <span className={styles.detailChannel}>@comic</span>
                <span>Asked by {selected.askedByUserId}</span>
                <span className={styles.detailTime}>{formatRelativeTime(selected.createdAtIso)}</span>
              </div>

              {/* Question */}
              <div>
                <div className={styles.detailLabel}>Survivor&apos;s question</div>
                <div className={styles.detailQuestion}>{selected.questionBody}</div>
              </div>

              {editing ? (
                <div className={styles.detailTwoCol}>
                  {/* Original AI draft (read-only) */}
                  <div className={styles.detailCol}>
                    <div className={styles.detailColHead}>
                      <span className={styles.detailLabel}>Original AI draft</span>
                      <span className={styles.needsCorrectionTag}>Needs correction</span>
                    </div>
                    <div className={styles.draftReadonly}>{selected.draftBody}</div>
                  </div>

                  {/* Corrected text (editable) */}
                  <div className={styles.detailCol}>
                    <div className={styles.detailColHead}>
                      <span className={styles.detailLabelCyan}>Your corrected answer</span>
                      <button
                        type="button"
                        className={styles.resetBtn}
                        onClick={() => setCorrectedBody(selected.draftBody)}
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
              ) : (
                <div>
                  <div className={styles.detailColHead}>
                    <span className={styles.detailLabel}>{selected.safetyCategory ? 'No AI draft' : 'AI Assistant draft'}</span>
                    <span className={styles.notYetSentTag}>
                      <Sparkles size={9} /> Not yet sent
                    </span>
                  </div>
                  <div className={styles.draftCard}>{selected.safetyCategory ? 'This safety-sensitive question was held for a person to answer directly — the AI Assistant did not draft a reply. Use Edit & approve to write the response.' : selected.draftBody}</div>
                </div>
              )}

              {/* Provenance + confidence (real fields only — no fabricated sources). */}
              <div className={styles.detailTwoCol}>
                <div className={styles.detailCol}>
                  <div className={styles.detailLabel}>Provenance</div>
                  <div className={styles.provenanceList}>
                    {selected.safetyCategory ? null : (
                      <div className={styles.provenanceRow}>
                        <FileText size={13} color="#0EA5E9" /> Drafted by engine: {selected.engine}
                      </div>
                    )}
                    <div className={styles.provenanceRow}>
                      <FileText size={13} color="#0EA5E9" /> Intent: {selected.intent ?? 'not classified (Rasa pending)'}
                    </div>
                    {selected.safetyCategory ? (
                      <div className={styles.provenanceRow}>
                        <AlertTriangle size={13} color="#F59E0B" /> Safety: {selected.safetyCategory.replace(/_/g, ' ')} (human-first)
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className={styles.confCol}>
                  <div className={styles.detailLabel}>Confidence</div>
                  <div className={styles.confCard}>
                    <div className={styles.confCardTop}>
                      <span className={`${styles.confLabel} ${confidenceBand(selected.nluConfidence).className}`}>
                        {confidenceBand(selected.nluConfidence).label}
                      </span>
                      {confidenceBand(selected.nluConfidence).pct !== null ? (
                        <span className={`${styles.confPct} ${confidenceBand(selected.nluConfidence).className}`}>
                          {confidenceBand(selected.nluConfidence).pct}%
                        </span>
                      ) : null}
                    </div>
                    {confidenceBand(selected.nluConfidence).pct !== null ? (
                      <div className={styles.confTrack}>
                        <div
                          className={`${styles.confFill} ${confidenceBand(selected.nluConfidence).className}`}
                          style={{ width: `${confidenceBand(selected.nluConfidence).pct}%` }}
                        />
                      </div>
                    ) : (
                      <div className={styles.confHint}>
                        <AlertTriangle size={13} /> No calibrated confidence yet — every draft is held for human review.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className={styles.actions}>
                {editing ? (
                  <>
                    <button
                      type="button"
                      className={styles.approveBtn}
                      disabled={resolving || correctedBody.trim().length === 0}
                      onClick={() => void resolveSelected('correct')}
                    >
                      <Check size={16} /> Approve corrected answer
                    </button>
                    <button type="button" className={styles.rejectBtn} disabled={resolving} onClick={() => void resolveSelected('reject')}>
                      <X size={15} /> Reject
                    </button>
                  </>
                ) : (
                  <>
                    {selected.safetyCategory ? null : (
                      <button type="button" className={styles.approveBtn} disabled={resolving} onClick={() => void resolveSelected('approve')}>
                        <Check size={16} /> Approve &amp; send
                      </button>
                    )}
                    <button type="button" className={styles.editBtn} disabled={resolving} onClick={() => setEditing(true)}>
                      <Pencil size={15} /> Edit &amp; approve
                    </button>
                    <button type="button" className={styles.rejectBtn} disabled={resolving} onClick={() => void resolveSelected('reject')}>
                      <X size={15} /> Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right rail — reviewer guidance */}
      <aside className={styles.rightRail}>
        <div className={styles.guidanceCard}>
          <div className={styles.guidanceHead}>
            <ShieldCheck size={15} color="#0EA5E9" />
            <span>Reviewer guidance</span>
          </div>
          {REVIEWER_GUIDANCE.map((g) => (
            <div key={g} className={styles.guidanceItem}>
              <span className={styles.guidanceBullet}>·</span> {g}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
