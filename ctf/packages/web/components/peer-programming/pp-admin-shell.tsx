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
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Code2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import type { AssignmentRunResult, PeerProgrammingCohort, PeerProgrammingTopic, SingleOpenCohortMode } from './pp-admin-shared';
import { ppAdminMutate } from './pp-admin-shared';
import { getPeerProgrammingTokens, type PeerProgrammingTokens } from './pp-shared';
import { PeerProgrammingAdminTopicForm } from './pp-admin-topic-form';
import { PeerProgrammingAdminAssignments } from './pp-admin-assignments';
import { responseFailureText } from 'lib/errors/client-failure';

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

// Shared token type for extracted child components (the theme-aware PeerProgramming tokens).
type Tokens = PeerProgrammingTokens;

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

// Human-readable label for where the effective single-open-cohort mode came from.
function modeSourceLabel(source: SingleOpenCohortMode['source']): string {
  if (source === 'admin_setting') return 'admin setting';
  if (source === 'env_flag') return 'server setting';
  return 'default';
}

// ---------------------------------------------------------------------------
// Draft type shared between the form and the submit handler.
// ---------------------------------------------------------------------------
type TopicDraft = {
  weekStartDate: string;
  title: string;
  guidance: string;
  revisionNote: string;
  publish: boolean;
};

type AssignmentInput = { allowManualOverride: boolean; activeUserIds: string[] };

// ---------------------------------------------------------------------------
// Data hook: all admin state, loaders, and mutation handlers. Keeping the hook
// separate keeps the shell component small. Hooks stay in a fixed order and are
// never called conditionally.
// ---------------------------------------------------------------------------
type AdminData = {
  topic: PeerProgrammingTopic | null;
  cohorts: AdminCohort[];
  loading: boolean;
  error: string | null;
  notice: string | null;
  savingTopic: boolean;
  runningAssignment: boolean;
  lastRun: AssignmentRunResult | null;
  mode: SingleOpenCohortMode | null;
  savingMode: boolean;
  feedback: FeedbackItem[];
  endingCohortId: string | null;
  submitTopic: (draft: TopicDraft) => Promise<void>;
  runAssignment: (input: AssignmentInput) => Promise<void>;
  setSingleOpenCohort: (enabled: boolean | null) => Promise<void>;
  endCohortAction: (cohortId: string) => Promise<void>;
};

function usePeerProgrammingAdmin(): AdminData {
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
  const [endingCohortId, setEndingCohortId] = useState<string | null>(null);

  const loadTopic = useCallback(async () => {
    const res = await fetch('/api/peer-programming/admin/topics');
    if (!res.ok) {
      throw new Error(await responseFailureText(res, 'Could not load the weekly topic.'));
    }
    const data = (await res.json()) as { ok: boolean; topic: PeerProgrammingTopic | null };
    setTopic(data.topic ?? null);
  }, []);

  const loadCohorts = useCallback(async () => {
    const res = await fetch('/api/peer-programming/admin/cohorts');
    if (!res.ok) {
      throw new Error(await responseFailureText(res, 'Could not load the active cohorts.'));
    }
    const data = (await res.json()) as { ok: boolean; cohorts: AdminCohort[] };
    setCohorts(data.cohorts ?? []);
  }, []);

  const loadMode = useCallback(async () => {
    const res = await fetch('/api/peer-programming/admin/single-open-cohort');
    if (!res.ok) {
      throw new Error(await responseFailureText(res, 'Could not load the single-open-cohort setting.'));
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
    async (draft: TopicDraft) => {
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
    async (input: AssignmentInput) => {
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
        setNotice(modeToggleNotice(enabled));
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

  // End (close) a cohort. Its Direct Line becomes read-only — members keep reading, no one can post.
  // The standing Cohort 1 has no End button (it can never be ended). One-way in this build, so confirm.
  const endCohortAction = useCallback(
    async (cohortId: string) => {
      setEndingCohortId(cohortId);
      setError(null);
      setNotice(null);
      const result = await ppAdminMutate<{ cohort: AdminCohort }>(
        '/api/peer-programming/admin/cohorts/end',
        'POST',
        { cohortId },
      );
      if (!result.ok) {
        setError(result.message);
      } else {
        setNotice('Cohort ended. Its conversation is now read-only.');
        try {
          await loadCohorts();
        } catch {
          // The end succeeded; a cohort-list refresh failure is non-fatal.
        }
      }
      setEndingCohortId(null);
    },
    [loadCohorts],
  );

  return {
    topic,
    cohorts,
    loading,
    error,
    notice,
    savingTopic,
    runningAssignment,
    lastRun,
    mode,
    savingMode,
    feedback,
    endingCohortId,
    submitTopic,
    runAssignment,
    setSingleOpenCohort,
    endCohortAction,
  };
}

// Notice copy for the single-standing-cohort toggle, split out so the handler stays flat.
function modeToggleNotice(enabled: boolean | null): string {
  if (enabled === null) {
    return 'Cleared the admin override. The mode now follows the server setting.';
  }
  if (enabled) {
    return 'Single standing Cohort 1 mode is on.';
  }
  return 'Single standing Cohort 1 mode is off. Weekly cohorts resume.';
}

// ---------------------------------------------------------------------------
// Presentational building blocks (module scope so they never remount on parent
// re-render and each stays within complexity/line limits).
// ---------------------------------------------------------------------------

// Shared section wrapper: a card surface with the admin border.
function AdminSection({ t, children }: { t: Tokens; children: ReactNode }) {
  return (
    <section
      style={{
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        background: t.SURFACE,
        border: `1px solid ${t.BORDER_SOLID}`,
      }}
    >
      {children}
    </section>
  );
}

function AdminHeaderCard({ t }: { t: Tokens }) {
  return (
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
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  );
}

function NoticeBanner({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  );
}

// --- Member feedback -------------------------------------------------------

function FeedbackRow({ t, item }: { t: Tokens; item: FeedbackItem }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        background: t.HEADER,
        border: `1px solid ${t.BORDER_SOLID}`,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.TITLE }}>{feedbackAuthor(item)}</span>
        {/* issueType and suggestionCategory are deliberately not rendered. The member form has no
            category picker — it posts the literal "general" for both — so every row showed
            "general general", which told the admin nothing. Bring the labels back if the member
            form ever collects real categories. */}
        <span style={{ fontSize: 11, color: t.MUTED, marginLeft: 'auto' }}>{formatFeedbackTime(item.createdAtIso)}</span>
      </div>
      <p style={{ fontSize: 13, color: '#D1D5DB', margin: '6px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{item.note}</p>
    </div>
  );
}

function FeedbackSection({ t, feedback }: { t: Tokens; feedback: FeedbackItem[] }) {
  return (
    <AdminSection t={t}>
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
            <FeedbackRow key={item.id} t={t} item={item} />
          ))}
        </div>
      )}
    </AdminSection>
  );
}

// --- Single standing Cohort 1 mode ----------------------------------------

function ModeStatusRow({ t, mode }: { t: Tokens; mode: SingleOpenCohortMode }) {
  const on = mode.enabled;
  return (
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
          background: on ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.18)',
          color: on ? '#22C55E' : t.MUTED,
          border: `1px solid ${on ? 'rgba(34,197,94,0.3)' : t.BORDER_SOLID}`,
        }}
      >
        {on ? 'On' : 'Off'}
      </span>
      <span style={{ fontSize: 12, color: t.MUTED }}>
        Source:{' '}
        <span style={{ color: t.TITLE, fontWeight: 600 }}>{modeSourceLabel(mode.source)}</span>
      </span>
    </div>
  );
}

// One toggle button. Colors are passed in so this stays a flat presentational cell.
function ModeButton({
  label,
  disabled,
  savingMode,
  onClick,
  background,
  color,
  border,
}: {
  label: string;
  disabled: boolean;
  savingMode: boolean;
  onClick: () => void;
  background: string;
  color: string;
  border: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        flex: '1 1 100%',
        padding: '9px 16px',
        borderRadius: 9,
        fontSize: 13,
        fontWeight: 700,
        cursor: savingMode ? 'progress' : 'pointer',
        background,
        color,
        border,
        opacity: savingMode ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  );
}

function ModeButtons({
  t,
  mode,
  savingMode,
  onSet,
}: {
  t: Tokens;
  mode: SingleOpenCohortMode;
  savingMode: boolean;
  onSet: (enabled: boolean | null) => void;
}) {
  const isAdminSetting = mode.source === 'admin_setting';
  const turnOnDisabled = savingMode || (isAdminSetting && mode.adminSetting === true);
  const turnOffDisabled = savingMode || (isAdminSetting && mode.adminSetting === false);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <ModeButton
        label="Turn on"
        disabled={turnOnDisabled}
        savingMode={savingMode}
        onClick={() => onSet(true)}
        background={`${t.ACCENT}1F`}
        color={t.ACCENT}
        border={`1px solid ${t.ACCENT}40`}
      />
      <ModeButton
        label="Turn off"
        disabled={turnOffDisabled}
        savingMode={savingMode}
        onClick={() => onSet(false)}
        background="rgba(239,68,68,0.12)"
        color="#EF4444"
        border="1px solid rgba(239,68,68,0.3)"
      />
      {isAdminSetting ? (
        <ModeButton
          label="Clear override (use server setting)"
          disabled={savingMode}
          savingMode={savingMode}
          onClick={() => onSet(null)}
          background="transparent"
          color={t.MUTED}
          border={`1px solid ${t.BORDER_SOLID}`}
        />
      ) : null}
    </div>
  );
}

function SingleOpenCohortSection({
  t,
  mode,
  savingMode,
  onSet,
}: {
  t: Tokens;
  mode: SingleOpenCohortMode | null;
  savingMode: boolean;
  onSet: (enabled: boolean | null) => void;
}) {
  return (
    <AdminSection t={t}>
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
          <ModeStatusRow t={t} mode={mode} />
          <ModeButtons t={t} mode={mode} savingMode={savingMode} onSet={onSet} />
        </>
      ) : (
        <p style={{ fontSize: 13, color: t.MUTED, margin: 0 }}>
          The current mode could not be read.
        </p>
      )}
    </AdminSection>
  );
}

// --- Weekly topic ----------------------------------------------------------

function WeeklyTopicSection({
  t,
  topic,
  defaultWeekStart,
  savingTopic,
  onSubmit,
}: {
  t: Tokens;
  topic: PeerProgrammingTopic | null;
  defaultWeekStart: string;
  savingTopic: boolean;
  onSubmit: (draft: TopicDraft) => Promise<void>;
}) {
  return (
    <AdminSection t={t}>
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
        onSubmit={onSubmit}
      />
    </AdminSection>
  );
}

// --- Weekly cohort assignment ---------------------------------------------

function WeeklyAssignmentSection({
  t,
  runningAssignment,
  lastRun,
  onRun,
}: {
  t: Tokens;
  runningAssignment: boolean;
  lastRun: AssignmentRunResult | null;
  onRun: (input: AssignmentInput) => Promise<void>;
}) {
  return (
    <AdminSection t={t}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: t.TITLE, margin: '0 0 12px' }}>
        Weekly cohort assignment
      </h2>
      <PeerProgrammingAdminAssignments
        busy={runningAssignment}
        lastResult={lastRun}
        onRun={onRun}
      />
    </AdminSection>
  );
}

// --- Cohorts ---------------------------------------------------------------

function CohortStatusBadge({ t, cohort }: { t: Tokens; cohort: AdminCohort }) {
  if (cohort.status === 'ended') {
    return (
      <span style={{ background: 'rgba(107,114,128,0.18)', color: t.MUTED, border: `1px solid ${t.BORDER_SOLID}`, fontSize: 10, padding: '1px 7px', borderRadius: 10 }}>
        Ended
      </span>
    );
  }
  if (cohort.fallbackOpen) {
    return (
      <span style={{ background: 'rgba(234,179,8,0.15)', color: '#EAB308', border: '1px solid rgba(234,179,8,0.3)', fontSize: 10, padding: '1px 7px', borderRadius: 10 }}>
        Open
      </span>
    );
  }
  return null;
}

function EndCohortButton({
  cohort,
  endingCohortId,
  onEnd,
}: {
  cohort: AdminCohort;
  endingCohortId: string | null;
  onEnd: (cohortId: string) => void;
}) {
  const ending = endingCohortId === cohort.id;
  return (
    <button
      type="button"
      disabled={ending}
      onClick={() => {
        if (window.confirm(`End Cohort ${cohort.cohortLabel}? Members can still read the conversation, but no one will be able to post. This cannot be undone here.`)) {
          onEnd(cohort.id);
        }
      }}
      style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 12px', cursor: ending ? 'progress' : 'pointer', whiteSpace: 'nowrap', opacity: ending ? 0.7 : 1 }}
    >
      {ending ? 'Ending…' : 'End cohort'}
    </button>
  );
}

function CohortRow({
  t,
  cohort,
  endingCohortId,
  onEnd,
}: {
  t: Tokens;
  cohort: AdminCohort;
  endingCohortId: string | null;
  onEnd: (cohortId: string) => void;
}) {
  const plural = cohort.memberCount !== 1 ? 's' : '';
  const hasMembers = cohort.members && cohort.members.length > 0;
  const canEnd = cohort.status === 'active' && !cohort.isStanding;
  return (
    <div
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
          <CohortStatusBadge t={t} cohort={cohort} />
        </div>
        <div style={{ fontSize: 12, color: t.MUTED, marginTop: 2 }}>
          Week of {cohort.weekStartDate} · {cohort.memberCount} member{plural}
        </div>
        {hasMembers ? (
          <div style={{ fontSize: 12, color: '#D1D5DB', marginTop: 4 }}>
            Members: {cohort.members?.map(memberName).join(', ')}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {canEnd ? (
          <EndCohortButton cohort={cohort} endingCohortId={endingCohortId} onEnd={onEnd} />
        ) : null}
        <Link
          href={`/apps/peer-programming?cohortId=${encodeURIComponent(cohort.id)}`}
          style={{ fontSize: 12, fontWeight: 700, color: t.ACCENT, textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Open room →
        </Link>
      </div>
    </div>
  );
}

function CohortsSection({
  t,
  cohorts,
  endingCohortId,
  onEnd,
}: {
  t: Tokens;
  cohorts: AdminCohort[];
  endingCohortId: string | null;
  onEnd: (cohortId: string) => void;
}) {
  return (
    <AdminSection t={t}>
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
            <CohortRow key={cohort.id} t={t} cohort={cohort} endingCohortId={endingCohortId} onEnd={onEnd} />
          ))}
        </div>
      )}
    </AdminSection>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
export function PeerProgrammingAdminShell() {
  const { theme } = useTheme();
  const t = getPeerProgrammingTokens(theme);
  const defaultWeekStart = useMemo(() => currentWeekStartDate(), []);
  const admin = usePeerProgrammingAdmin();

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
        <AdminHeaderCard t={t} />

        {admin.error ? <ErrorBanner message={admin.error} /> : null}
        {admin.notice ? <NoticeBanner message={admin.notice} /> : null}

        {admin.loading ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: t.MUTED, fontSize: 14 }}>
            Loading…
          </div>
        ) : (
          <>
            <FeedbackSection t={t} feedback={admin.feedback} />
            <SingleOpenCohortSection
              t={t}
              mode={admin.mode}
              savingMode={admin.savingMode}
              onSet={(enabled) => void admin.setSingleOpenCohort(enabled)}
            />
            <WeeklyTopicSection
              t={t}
              topic={admin.topic}
              defaultWeekStart={defaultWeekStart}
              savingTopic={admin.savingTopic}
              onSubmit={admin.submitTopic}
            />
            <WeeklyAssignmentSection
              t={t}
              runningAssignment={admin.runningAssignment}
              lastRun={admin.lastRun}
              onRun={admin.runAssignment}
            />
            <CohortsSection
              t={t}
              cohorts={admin.cohorts}
              endingCohortId={admin.endingCohortId}
              onEnd={(cohortId) => void admin.endCohortAction(cohortId)}
            />
          </>
        )}
      </div>
    </div>
  );
}
