// Every piece of state on the PeerProgramming admin screen and the actions on it, the same as the
// web's usePeerProgrammingAdmin (web components/peer-programming/pp-admin-shell.tsx).
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminMutate,
  loadCohorts,
  loadFeedback,
  loadMode,
  loadTopic,
  type AdminCohort,
  type AdminTopic,
  type AssignmentRunResult,
  type FeedbackItem,
  type MutationResult,
  type SingleOpenCohortMode,
  type TopicDraft,
} from './PeerProgrammingAdminApi';

export type AssignmentInput = { allowManualOverride: boolean; activeUserIds: string[] };

function modeToggleNotice(enabled: boolean | null): string {
  if (enabled === null) return 'Cleared the admin override. The mode now follows the server setting.';
  if (enabled) return 'Single standing Cohort 1 mode is on.';
  return 'Single standing Cohort 1 mode is off. Weekly cohorts resume.';
}

// Re-read after a write that succeeded; a failed re-read leaves the screen as it was.
async function quietly(task: () => Promise<unknown>): Promise<void> {
  try {
    await task();
  } catch {
    // no-trace: the write succeeded; a refresh failure is not fatal, the same as the web
  }
}

export function usePeerProgrammingAdmin() {
  const [topic, setTopic] = useState<AdminTopic | null>(null);
  const [cohorts, setCohorts] = useState<AdminCohort[]>([]);
  const [mode, setMode] = useState<SingleOpenCohortMode | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingTopic, setSavingTopic] = useState(false);
  const [runningAssignment, setRunningAssignment] = useState(false);
  const [lastRun, setLastRun] = useState<AssignmentRunResult | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [endingCohortId, setEndingCohortId] = useState<string | null>(null);
  const mounted = useRef(true);

  const readTopic = useCallback(async () => setTopic(await loadTopic()), []);
  const readCohorts = useCallback(async () => setCohorts(await loadCohorts()), []);
  const readMode = useCallback(async () => setMode(await loadMode()), []);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        await Promise.all([readTopic(), readCohorts(), readMode(), loadFeedback().then(setFeedback)]);
      } catch (caught) {
        if (mounted.current) setError(caught instanceof Error ? caught.message : 'Could not load the admin data.');
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [readTopic, readCohorts, readMode]);

  // One write: clear the banners, run it, show its failure or its notice, then re-read.
  const write = useCallback(async <T>(
    setBusy: (_busy: boolean) => void,
    action: () => Promise<MutationResult<T>>,
    onOk: (_data: T) => Promise<void>,
  ) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await action();
    if (result.ok) await onOk(result.data);
    else setError(result.message ?? null);
    if (mounted.current) setBusy(false);
  }, []);

  const submitTopic = useCallback((draft: TopicDraft) => write(setSavingTopic,
    () => adminMutate<{ topic: AdminTopic }>('/api/peer-programming/admin/topics', 'PUT', {
      weekStartDate: draft.weekStartDate,
      title: draft.title,
      guidance: draft.guidance,
      revisionNote: draft.revisionNote.length > 0 ? draft.revisionNote : null,
      publish: draft.publish,
    }),
    async () => {
      setNotice(draft.publish ? 'Topic published.' : 'Draft saved.');
      await quietly(readTopic);
    }), [write, readTopic]);

  const runAssignment = useCallback((input: AssignmentInput) => write(setRunningAssignment,
    () => adminMutate<Partial<AssignmentRunResult>>('/api/peer-programming/admin/assignments/run', 'POST', input),
    async (data) => {
      setLastRun({
        cohortsCreated: data.cohortsCreated ?? 0,
        notificationsCreated: data.notificationsCreated ?? 0,
        membersSelected: data.membersSelected ?? 0,
      });
      setNotice('Weekly assignment complete.');
      await quietly(readCohorts);
    }), [write, readCohorts]);

  const setSingleOpenCohort = useCallback((enabled: boolean | null) => write(setSavingMode,
    () => adminMutate<{ mode?: SingleOpenCohortMode }>('/api/peer-programming/admin/single-open-cohort', 'POST', { enabled }),
    async (data) => {
      if (data.mode) setMode(data.mode);
      setNotice(modeToggleNotice(enabled));
      await quietly(() => Promise.all([readMode(), readCohorts()]));
    }), [write, readMode, readCohorts]);

  const endCohort = useCallback((cohortId: string) => write(
    (busy) => setEndingCohortId(busy ? cohortId : null),
    () => adminMutate<{ cohort: AdminCohort }>('/api/peer-programming/admin/cohorts/end', 'POST', { cohortId }),
    async () => {
      setNotice('Cohort ended. Its conversation is now read-only.');
      await quietly(readCohorts);
    }), [write, readCohorts]);

  return {
    topic, cohorts, mode, feedback, loading, error, notice, savingTopic, runningAssignment, lastRun, savingMode,
    endingCohortId, submitTopic, runAssignment, setSingleOpenCohort, endCohort,
  };
}
