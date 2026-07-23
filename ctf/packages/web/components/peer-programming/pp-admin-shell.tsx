'use client';

// PeerProgramming admin surface. Dark admin design system (rule 131), mirroring the
// designed admin shells (see unlock-admin-shell). Mobile-responsive single column.
//
// Binds only endpoints that exist today:
//   - GET  /api/peer-programming/admin/topics             (current published topic)
//   - PUT  /api/peer-programming/admin/topics             (upsert / publish a weekly topic)
//   - POST /api/peer-programming/admin/assignments/run    (run weekly cohort assignment)
//   - GET  /api/peer-programming/admin/single-open-cohort (effective mode + source)
//   - POST /api/peer-programming/admin/single-open-cohort (set / clear the mode toggle)
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Code2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import type { AssignmentRunResult, PeerProgrammingCohort, PeerProgrammingTopic, SingleOpenCohortMode } from './pp-admin-shared';
import { ppAdminMutate } from './pp-admin-shared';
import { getPeerProgrammingTokens } from './pp-shared';
import { PeerProgrammingAdminTopicForm } from './pp-admin-topic-form';
import { PeerProgrammingAdminAssignments } from './pp-admin-assignments';

// Admin design tokens (shared admin look from the design system) come from the theme-aware
// PeerProgramming tokens: accent (mint), page background, panel/header, admin card surface, and
// the solid admin border. The default theme keeps the shipped hex values.

// A cohort member surfaced in the admin roster: user id + resolved display name (null when Clerk
// could not resolve it). Membership is not secret — an admin sees who is assigned, not just a count.
type CohortMember = { userId: string; username: string | null };
type AdminCohort = PeerProgrammingCohort & { members?: CohortMember[] };

// One member feedback entry in the admin inbox (mirrors PeerProgrammingFeedbackItem from the
// repository). Kept local so this client shell does not import the server repository module.
type FeedbackItem = {
  id: string;
  cohortId: string | null;
  userId: string;
  authorName: string | null;
  issueType: string;
  suggestionCategory: string;
  releaseSurface: string;
  note: string;
  createdAtIso: string;
};

function memberName(member: CohortMember): string {
  return member.username ?? `Member ${member.userId.slice(0, 6)}`;
}

function feedbackAuthor(item: FeedbackItem): string {
  return item.authorName ?? `Member ${item.userId.slice(0, 6)}`;
}

function formatFeedbackTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Monday (UTC) of the current week — matches the server's getWeekStartDate so the
// form defaults to the week the room actually reads.
function currentWeekStartDate(now = new Date()): string {
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = current.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setUTCDate(current.getUTCDate() + diff);
  return current.toISOString().slice(0, 10);
}

export function PeerProgrammingAdminShell() {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  const defaultWeekStart = useMemo(() => currentWeekStartDate(), []);

  const [topic, setTopic] = useState<PeerProgrammingTopic | null>(null);
  const [cohorts, setCohorts] = useState<AdminCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingTopic, setSavingTopic] = useState(false);
  const [runningAssignment, setRunningAssignment] = useState(false);
  const [lastRun, setLastRun] = useState<AssignmentRunResult | null>(null);
  const [mode, setMode] = useState<SingleOpenCohortMode | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);

  const loadTopic = useCallback(async () => {
    const res = await fetch('/api/peer-programming/admin/topics');
    if (!res.ok) {
      throw new Error('Could not load the weekly topic.');
    }
    const data = (await res.json()) as { ok: boolean; topic: PeerProgrammingTopic | null };
    setTopic(data.topic ?? null);
  }, []);

  const loadCohorts = useCallback(async () => {
    const res = await fetch('/api/peer-programming/admin/cohorts');
    if (!res.ok) {
      throw new Error('Could not load the active cohorts.');
    }
    const data = (await res.json()) as { ok: boolean; cohorts: AdminCohort[] };
    setCohorts(data.cohorts ?? []);
  }, []);

  const loadMode = useCallback(async () => {
    const res = await fetch('/api/peer-programming/admin/single-open-cohort');
    if (!res.ok) {
      throw new Error('Could not load the single-open-cohort setting.');
    }
    const data = (await res.json()) as { ok: boolean; mode: SingleOpenCohortMode };
    setMode(data.mode ?? null);
  }, []);

  // The feedback inbox is best-effort: a failure leaves it empty rather than failing the whole admin
  // page (the topic/cohort tools must still load).
  const loadFeedback = useCallback(async () => {
    try {
      const res = await fetch('/api/peer-programming/admin/feedback');
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; feedback: FeedbackItem[] };
      setFeedback(data.feedback ?? []);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadTopic(), loadCohorts(), loadMode(), loadFeedback()]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load the admin data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadTopic, loadCohorts, loadMode, loadFeedback]);

  const submitTopic = useCallback(
    async (draft: {
      weekStartDate: string;
      title: string;
      guidance: string;
      revisionNote: string;
      publish: boolean;
    }) => {
      setSavingTopic(true);
      setError(null);
      setNotice(null);
      const result = await ppAdminMutate<{ topic: PeerProgrammingTopic }>(
        '/api/peer-programming/admin/topics',
        'PUT',
        {
          weekStartDate: draft.weekStartDate,
          title: draft.title,
          guidance: draft.guidance,
          revisionNote: draft.revisionNote.length > 0 ? draft.revisionNote : null,
          publish: draft.publish,
        },
      );
      if (!result.ok) {
        setError(result.message);
      } else {
        setNotice(draft.publish ? 'Topic published.' : 'Draft saved.');
        try {
          await loadTopic();
        } catch {
          // The save succeeded; a refresh failure is non-fatal.
        }
      }
      setSavingTopic(false);
    },
    [loadTopic],
  );

  const runAssignment = useCallback(
    async (input: { allowManualOverride: boolean; activeUserIds: string[] }) => {
      setRunningAssignment(true);
      setError(null);
      setNotice(null);
      const result = await ppAdminMutate<AssignmentRunResult>(
        '/api/peer-programming/admin/assignments/run',
        'POST',
        input,
      );
      if (!result.ok) {
        setError(result.message);
      } else {
        setLastRun({
          cohortsCreated: result.data.cohortsCreated ?? 0,
          notificationsCreated: result.data.notificationsCreated ?? 0,
          membersSelected: result.data.membersSelected ?? 0,
        });
        setNotice('Weekly assignment complete.');
        try {
          await loadCohorts();
        } catch {
          // The assignment succeeded; a cohort-list refresh failure is non-fatal.
        }
      }
      setRunningAssignment(false);
    },
    [loadCohorts],
  );

  // Persist (or clear) the single-standing-cohort mode toggle. `enabled` is true/false for an
  // explicit admin choice, or null to clear the admin setting and fall back to the env flag / default.
  const setSingleOpenCohort = useCallback(
    async (enabled: boolean | null) => {
      setSavingMode(true);
      setError(null);
      setNotice(null);
      const result = await ppAdminMutate<{ mode: SingleOpenCohortMode }>(
        '/api/peer-programming/admin/single-open-cohort',
        'POST',
        { enabled },
      );
      if (!result.ok) {
        setError(result.message);
      } else {
        if (result.data.mode) {
          setMode(result.data.mode);
        }
        setNotice(
          enabled === null
            ? 'Cleared the admin override. The mode now follows the server setting.'
            : enabled
              ? 'Single standing Cohort 1 mode is on.'
              : 'Single standing Cohort 1 mode is off. Weekly cohorts resume.',
        );
        try {
          await Promise.all([loadMode(), loadCohorts()]);
        } catch {
          // The save succeeded; a refresh failure is non-fatal.
        }
      }
      setSavingMode(false);
    },
    [loadMode, loadCohorts],
  );

  return (
    <div
      style={{
        // The document scrolls, so set a min-height on the shell. Matches the unlock / skills-hunt
        // admin shells.
        minHeight: '100dvh',
        background: t.BG,
        color: t.TITLE,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <MobileScreenHeader title="PeerProgramming Admin" accent={t.ACCENT} icon={<Code2 size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/apps/peer-programming" accent={t.ACCENT} />} />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 12,
            background: t.HEADER,
            border: `1px solid ${t.BORDER_SOLID}`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: `${t.ACCENT}20`,
              border: `1px solid ${t.ACCENT}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Code2 size={18} color={t.ACCENT} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>PeerProgramming Admin</div>
            <div style={{ fontSize: 12, color: t.MUTED }}>Weekly topic &amp; cohort assignment</div>
          </div>
          <span
            style={{
              marginLeft: 'auto',
              padding: '3px 9px',
              borderRadius: 6,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              fontSize: 11,
              color: '#6366F1',
              fontWeight: 700,
            }}
          >
            ADMIN
          </span>
        </div>


        {error ? (
          <div
            role="alert"
            style={{
              marginBottom: 12,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}
        {notice ? (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: '#22C55E',
              fontSize: 13,
            }}
          >
            {notice}
          </div>
        ) : null}

        {loading ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14 }}>
            Loading…
          </div>
        ) : (
          <>
            <section
              style={{
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                background: t.SURFACE,
                border: `1px solid ${t.BORDER_SOLID}`,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 800, color: t.TITLE, margin: '0 0 4px' }}>
                Member feedback
              </h2>
              <p style={{ fontSize: 12, color: t.MUTED, margin: '0 0 12px', lineHeight: 1.5 }}>
                What members sent from PeerProgramming, newest first. This is an inbox to read, not a
                queue to clear — the admin dot flags feedback that arrived since you last opened this page.
              </p>
              {feedback.length === 0 ? (
                <p style={{ fontSize: 13, color: t.MUTED, margin: 0 }}>No feedback yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {feedback.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: t.HEADER,
                        border: `1px solid ${t.BORDER_SOLID}`,
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>{feedbackAuthor(item)}</span>
                        <span style={{ fontSize: 11, color: t.ACCENT, fontWeight: 600 }}>{item.issueType}</span>
                        <span style={{ fontSize: 11, color: t.MUTED }}>{item.suggestionCategory}</span>
                        <span style={{ fontSize: 11, color: t.MUTED, marginLeft: 'auto' }}>{formatFeedbackTime(item.createdAtIso)}</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#D1D5DB', margin: '6px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section
              style={{
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                background: t.SURFACE,
                border: `1px solid ${t.BORDER_SOLID}`,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 800, color: t.TITLE, margin: '0 0 4px' }}>
                Single standing Cohort 1 mode
              </h2>
              <p style={{ fontSize: 12, color: t.MUTED, margin: '0 0 12px', lineHeight: 1.5 }}>
                While there are too few active members to fill weekly cohorts of up to 12 people, everyone shares
                one standing, always-open Cohort 1 instead of being split into tiny rooms. Turn it off
                to resume the weekly split into C1, C2, C3.
              </p>
              {mode ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: t.HEADER,
                      border: `1px solid ${t.BORDER_SOLID}`,
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        background: mode.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.18)',
                        color: mode.enabled ? '#22C55E' : t.MUTED,
                        border: `1px solid ${mode.enabled ? 'rgba(34,197,94,0.3)' : t.BORDER_SOLID}`,
                      }}
                    >
                      {mode.enabled ? 'On' : 'Off'}
                    </span>
                    <span style={{ fontSize: 12, color: t.MUTED }}>
                      Source:{' '}
                      <span style={{ color: t.TITLE, fontWeight: 600 }}>
                        {mode.source === 'admin_setting'
                          ? 'admin setting'
                          : mode.source === 'env_flag'
                            ? 'server setting'
                            : 'default'}
                      </span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      disabled={savingMode || (mode.source === 'admin_setting' && mode.adminSetting === true)}
                      onClick={() => void setSingleOpenCohort(true)}
                      style={{
                        flex: '1 1 100%',
                        padding: '9px 16px',
                        borderRadius: 9,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: savingMode ? 'progress' : 'pointer',
                        background: `${t.ACCENT}1F`,
                        color: t.ACCENT,
                        border: `1px solid ${t.ACCENT}40`,
                        opacity: savingMode ? 0.7 : 1,
                      }}
                    >
                      Turn on
                    </button>
                    <button
                      type="button"
                      disabled={savingMode || (mode.source === 'admin_setting' && mode.adminSetting === false)}
                      onClick={() => void setSingleOpenCohort(false)}
                      style={{
                        flex: '1 1 100%',
                        padding: '9px 16px',
                        borderRadius: 9,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: savingMode ? 'progress' : 'pointer',
                        background: 'rgba(239,68,68,0.12)',
                        color: '#EF4444',
                        border: '1px solid rgba(239,68,68,0.3)',
                        opacity: savingMode ? 0.7 : 1,
                      }}
                    >
                      Turn off
                    </button>
                    {mode.source === 'admin_setting' ? (
                      <button
                        type="button"
                        disabled={savingMode}
                        onClick={() => void setSingleOpenCohort(null)}
                        style={{
                          flex: '1 1 100%',
                          padding: '9px 16px',
                          borderRadius: 9,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: savingMode ? 'progress' : 'pointer',
                          background: 'transparent',
                          color: t.MUTED,
                          border: `1px solid ${t.BORDER_SOLID}`,
                          opacity: savingMode ? 0.7 : 1,
                        }}
                      >
                        Clear override (use server setting)
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: t.MUTED, margin: 0 }}>
                  The current mode could not be read.
                </p>
              )}
            </section>

            <section
              style={{
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                background: t.SURFACE,
                border: `1px solid ${t.BORDER_SOLID}`,
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: t.TITLE, margin: 0 }}>Weekly topic</h2>
                {topic ? (
                  <p style={{ fontSize: 12, color: t.MUTED, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
                    Current published topic:{' '}
                    <span style={{ color: t.TITLE, fontWeight: 600 }}>{topic.title}</span> (week of{' '}
                    {topic.weekStartDate}, status {topic.status}).
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: t.MUTED, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
                    No topic is published for the current week. Fill in the form to set one.
                  </p>
                )}
              </div>
              <PeerProgrammingAdminTopicForm
                topic={topic}
                defaultWeekStart={defaultWeekStart}
                busy={savingTopic}
                isMobile={true}
                onSubmit={submitTopic}
              />
            </section>

            <section
              style={{
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                background: t.SURFACE,
                border: `1px solid ${t.BORDER_SOLID}`,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 800, color: t.TITLE, margin: '0 0 12px' }}>
                Weekly cohort assignment
              </h2>
              <PeerProgrammingAdminAssignments
                busy={runningAssignment}
                lastResult={lastRun}
                onRun={runAssignment}
              />
            </section>

            <section
              style={{
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                background: t.SURFACE,
                border: `1px solid ${t.BORDER_SOLID}`,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 800, color: t.TITLE, margin: '0 0 4px' }}>
                Cohorts
              </h2>
              <p style={{ fontSize: 12, color: t.MUTED, margin: '0 0 12px', lineHeight: 1.5 }}>
                Every cohort you have formed, most recent first. Open any one to read along and manage
                it — you are included in all of them.
              </p>
              {cohorts.length === 0 ? (
                <p style={{ fontSize: 13, color: t.MUTED, margin: 0 }}>
                  No cohorts have formed yet. Run the weekly assignment above to form them.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cohorts.map((cohort) => (
                    <div
                      key={cohort.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: t.HEADER,
                        border: `1px solid ${t.BORDER_SOLID}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: t.TITLE }}>Cohort {cohort.cohortLabel}</span>
                          {cohort.fallbackOpen ? (
                            <span style={{ background: 'rgba(234,179,8,0.15)', color: '#EAB308', border: '1px solid rgba(234,179,8,0.3)', fontSize: 10, padding: '1px 7px', borderRadius: 10 }}>
                              Open
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>
                          Week of {cohort.weekStartDate} · {cohort.memberCount} member{cohort.memberCount !== 1 ? 's' : ''}
                        </div>
                        {cohort.members && cohort.members.length > 0 ? (
                          <div style={{ fontSize: 12, color: '#D1D5DB', marginTop: 4 }}>
                            Members: {cohort.members.map(memberName).join(', ')}
                          </div>
                        ) : null}
                      </div>
                      <Link
                        href={`/apps/peer-programming?cohortId=${encodeURIComponent(cohort.id)}`}
                        style={{ fontSize: 12, fontWeight: 700, color: t.ACCENT, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        Open room →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
