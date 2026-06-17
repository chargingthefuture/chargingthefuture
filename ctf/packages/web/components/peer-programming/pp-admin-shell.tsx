'use client';

// Peer Programming admin surface. Dark admin design system (rule 131), mirroring the
// designed admin shells (see unlock-admin-shell). Mobile-responsive single column.
//
// Binds only endpoints that exist today:
//   - GET  /api/peer-programming/admin/topics          (current published topic)
//   - PUT  /api/peer-programming/admin/topics          (upsert / publish a weekly topic)
//   - POST /api/peer-programming/admin/assignments/run (run weekly cohort assignment)
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Code2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { AssignmentRunResult, PeerProgrammingTopic } from './pp-admin-shared';
import { ppAdminMutate } from './pp-admin-shared';
import { PeerProgrammingAdminTopicForm } from './pp-admin-topic-form';
import { PeerProgrammingAdminAssignments } from './pp-admin-assignments';

// Admin design tokens (shared admin look from the design system). Peer Programming accent is mint.
const COLOR = '#6EE7B7';
const BG = '#0F1117';
const PANEL = '#0D0F14';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#6B7280';

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
  const isMobile = useIsMobile();
  const defaultWeekStart = useMemo(() => currentWeekStartDate(), []);

  const [topic, setTopic] = useState<PeerProgrammingTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingTopic, setSavingTopic] = useState(false);
  const [runningAssignment, setRunningAssignment] = useState(false);
  const [lastRun, setLastRun] = useState<AssignmentRunResult | null>(null);

  const loadTopic = useCallback(async () => {
    const res = await fetch('/api/peer-programming/admin/topics');
    if (!res.ok) {
      throw new Error('Could not load the weekly topic.');
    }
    const data = (await res.json()) as { ok: boolean; topic: PeerProgrammingTopic | null };
    setTopic(data.topic ?? null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadTopic();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load the admin data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadTopic]);

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
      }
      setRunningAssignment(false);
    },
    [],
  );

  return (
    <div
      style={{ minHeight: '100dvh', background: BG, color: TEXT, fontFamily: "'Inter',system-ui,sans-serif" }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 12,
            background: PANEL,
            border: `1px solid ${BORDER}`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: `${COLOR}20`,
              border: `1px solid ${COLOR}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Code2 size={18} color={COLOR} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Peer Programming Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Weekly topic &amp; cohort assignment</div>
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

        <div style={{ marginBottom: 16 }}>
          <Link
            href="/apps/peer-programming"
            style={{ fontSize: 13, fontWeight: 600, color: COLOR, textDecoration: 'none' }}
          >
            Open the cohort room →
          </Link>
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
          <div style={{ padding: '32px 16px', textAlign: 'center', color: SUBTLE, fontSize: 14 }}>
            Loading…
          </div>
        ) : (
          <>
            <section
              style={{
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                background: SURFACE,
                border: `1px solid ${BORDER}`,
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: TEXT, margin: 0 }}>Weekly topic</h2>
                {topic ? (
                  <p style={{ fontSize: 12, color: SUBTLE, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
                    Current published topic:{' '}
                    <span style={{ color: TEXT, fontWeight: 600 }}>{topic.title}</span> (week of{' '}
                    {topic.weekStartDate}, status {topic.status}).
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: SUBTLE, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
                    No topic is published for the current week. Fill in the form to set one.
                  </p>
                )}
              </div>
              <PeerProgrammingAdminTopicForm
                topic={topic}
                defaultWeekStart={defaultWeekStart}
                busy={savingTopic}
                isMobile={isMobile}
                onSubmit={submitTopic}
              />
            </section>

            <section
              style={{
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                background: SURFACE,
                border: `1px solid ${BORDER}`,
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 800, color: TEXT, margin: '0 0 12px' }}>
                Weekly cohort assignment
              </h2>
              <PeerProgrammingAdminAssignments
                busy={runningAssignment}
                lastResult={lastRun}
                onRun={runAssignment}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
