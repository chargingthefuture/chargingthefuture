'use client';

// Peer Programming admin surface. Replaces the former plain-text stub with a real,
// mobile-responsive admin UI consistent with the other /admin/{plugin} screens
// (generic admin aesthetic; see whatworks / skills-hunt admin shells).
//
// Binds only endpoints that exist today:
//   - GET  /api/peer-programming/admin/topics          (current published topic)
//   - PUT  /api/peer-programming/admin/topics          (upsert / publish a weekly topic)
//   - POST /api/peer-programming/admin/assignments/run (run weekly cohort assignment)
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/use-is-mobile';
import type { AssignmentRunResult, PeerProgrammingTopic } from './pp-admin-shared';
import { ppAdminMutate } from './pp-admin-shared';
import { PeerProgrammingAdminTopicForm } from './pp-admin-topic-form';
import { PeerProgrammingAdminAssignments } from './pp-admin-assignments';

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
    <main className={`mx-auto max-w-4xl space-y-6 ${isMobile ? 'px-4 py-6' : 'px-6 py-10'}`}>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Peer Programming Admin</h1>
        <p className="text-sm text-muted-foreground">
          Set the weekly topic guidance and run cohort assignment for this week&rsquo;s active
          members.
        </p>
        <p className="text-sm">
          <Link className="underline underline-offset-4" href="/apps/peer-programming">
            Open the cohort room
          </Link>
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <section className="space-y-4 rounded-lg border bg-card p-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Weekly topic</h2>
              {topic ? (
                <p className="text-sm text-muted-foreground">
                  Current published topic: <span className="font-medium">{topic.title}</span> (week
                  of {topic.weekStartDate}, status {topic.status}).
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
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

          <section className="space-y-4 rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">Weekly cohort assignment</h2>
            <PeerProgrammingAdminAssignments
              busy={runningAssignment}
              lastResult={lastRun}
              onRun={runAssignment}
            />
          </section>
        </>
      )}
    </main>
  );
}
