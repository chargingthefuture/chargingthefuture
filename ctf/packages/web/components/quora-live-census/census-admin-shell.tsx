'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { CensusRunSummary } from 'lib/quora-live-census/repository';
import { getCensusTokens } from './census-theme';
import { buttonStyle, cardStyle, columnStyle, errorStyle, mutedStyle, pageStyle } from './census-styles';
import { CensusRunForm, CensusRunList } from './census-run-list';
import { CensusEntryList, CensusTally } from './census-run-panel';
import { CensusEntryForm, entryDraftToBody, type EntryDraft } from './census-entry-form';
import {
  createEntry,
  createRun,
  deleteEntry,
  fetchRun,
  fetchRuns,
  setRunStatus,
  type RunDetail,
} from './census-api';

// Admin surface for the live-account census: start a run, code accounts into it, read the stance
// breakdown, close it when finished, export it.
//
// Closing is what makes a run quotable, and a closed run refuses new entries — so a number that
// has been cited cannot quietly change underneath the citation.
export function CensusAdminShell() {
  const { theme } = useTheme();
  const t = getCensusTokens(theme);
  const [runs, setRuns] = useState<CensusRunSummary[] | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    const result = await fetchRuns();
    if (result.ok) {
      setRuns(result.value.runs);
      setError(null);
      return;
    }
    setError(result.message);
  }, []);

  const openRun = useCallback(async (runId: string) => {
    const result = await fetchRun(runId);
    if (result.ok) {
      setDetail(result.value);
      setError(null);
      return;
    }
    setError(result.message);
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const handleCreateRun = async (body: Record<string, unknown>): Promise<boolean> => {
    const result = await createRun(body);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    setError(null);
    await loadRuns();
    await openRun(result.value.run.id);
    return true;
  };

  const handleAddEntry = async (draft: EntryDraft): Promise<boolean> => {
    if (!detail) return false;
    const result = await createEntry(detail.run.id, entryDraftToBody(draft));
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    setError(null);
    await openRun(detail.run.id);
    return true;
  };

  const handleRemoveEntry = async (entryId: string) => {
    if (!detail) return;
    const result = await deleteEntry(detail.run.id, entryId);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    await openRun(detail.run.id);
  };

  const handleToggleStatus = async () => {
    if (!detail) return;
    const next = detail.run.status === 'closed' ? 'open' : 'closed';
    const result = await setRunStatus(detail.run.id, next);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    await Promise.all([openRun(detail.run.id), loadRuns()]);
  };

  return (
    <main style={pageStyle(t)}>
      <div style={columnStyle}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>Quora live account census</h1>
        <p style={{ fontSize: 13, color: t.MUTED, margin: '0 0 4px' }}>
          The other half of the deletion survey. That one records what was removed, which cannot
          show what remains; this records what is still standing on a stated date, by a stated
          method, coded by what each account actually says.
        </p>
        <p style={{ fontSize: 13, color: t.MUTED, margin: 0 }}>
          Quote closed runs only, and quote them as what this run looked at — never as a share of
          Quora.
        </p>

        {error ? <p role="alert" style={errorStyle(t)}>{error}</p> : null}

        {detail ? (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <button type="button" onClick={() => setDetail(null)} style={buttonStyle(t)}>
                <ArrowLeft size={15} aria-hidden="true" />
                All runs
              </button>
              <button type="button" onClick={() => void openRun(detail.run.id)} style={buttonStyle(t)}>
                <RefreshCw size={15} aria-hidden="true" />
                Refresh
              </button>
              <button type="button" onClick={() => void handleToggleStatus()} style={buttonStyle(t)}>
                {detail.run.status === 'closed' ? 'Reopen run' : 'Close run'}
              </button>
            </div>

            <section style={cardStyle(t)}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px', color: t.TITLE }}>
                {detail.run.observed_on} · {detail.run.status}
              </h2>
              <p style={{ fontSize: 13, color: t.TEXT, margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>
                <span style={{ color: t.MUTED }}>Searched: </span>
                {detail.run.topic_scope}
              </p>
              <p style={{ fontSize: 13, color: t.TEXT, margin: 0, whiteSpace: 'pre-wrap' }}>
                <span style={{ color: t.MUTED }}>Picked by: </span>
                {detail.run.sampling_method}
              </p>
              {detail.run.notes ? (
                <p style={{ fontSize: 13, color: t.TEXT, margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
                  {detail.run.notes}
                </p>
              ) : null}
            </section>

            <CensusTally tally={detail.tally} tokens={t} />

            {detail.run.status === 'closed' ? (
              <p style={mutedStyle(t)}>
                This run is closed, so it takes no new entries. Reopen it to correct something.
              </p>
            ) : (
              <CensusEntryForm tokens={t} disabled={false} onSubmit={handleAddEntry} />
            )}

            <CensusEntryList detail={detail} tokens={t} onRemove={(id) => void handleRemoveEntry(id)} />
          </>
        ) : (
          <>
            <CensusRunForm tokens={t} onCreate={handleCreateRun} />
            {runs === null ? (
              <p style={{ fontSize: 14, color: t.MUTED, marginTop: 14 }}>Loading…</p>
            ) : (
              <CensusRunList runs={runs} tokens={t} onOpen={(id) => void openRun(id)} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
