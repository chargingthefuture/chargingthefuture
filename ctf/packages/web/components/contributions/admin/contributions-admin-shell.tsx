'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type {
  ContributionSubmissionAdminView,
  ContributionsCycle,
  ContributionsRuntimeConfig,
} from '@/lib/contributions/types';
import { FONT_FAMILY, getContributionsTokens } from '../contributions-shared';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import {
  createCycle,
  fetchConfig,
  fetchCycles,
  fetchSubmissions,
  nonMonetaryUnitValueFromCreditsPerAction,
  reviewSubmission,
  updateConfig,
  updateCycle,
  type AdminTab,
  type QueueFilter,
} from './contributions-admin-shared';
import { ContributionsAdminQueue } from './contributions-admin-queue';
import { ContributionsAdminDrive } from './contributions-admin-drive';
import { ContributionsAdminSettings, type SettingsSaveInput } from './contributions-admin-settings';

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'queue', label: 'Submission queue' },
  { key: 'drive', label: 'Drive management' },
  { key: 'settings', label: 'Settings' },
];

export function ContributionsAdminShell() {
  const { theme } = useTheme();
  const t = getContributionsTokens(theme);

  const [tab, setTab] = useState<AdminTab>('queue');
  const [submissions, setSubmissions] = useState<ContributionSubmissionAdminView[]>([]);
  const [config, setConfig] = useState<ContributionsRuntimeConfig | null>(null);
  const [currentCycle, setCurrentCycle] = useState<ContributionsCycle | null>(null);

  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [savingDrive, setSavingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const reloadSubmissions = useCallback(async (currentFilter: QueueFilter) => {
    try {
      setSubmissions(await fetchSubmissions(currentFilter));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the queue.');
    }
  }, []);

  const pickCurrentCycle = useCallback((cycles: ContributionsCycle[]): ContributionsCycle | null => {
    const now = Date.now();
    const active = cycles.find((c) => Date.parse(c.startsAt) <= now && Date.parse(c.endsAt) > now);
    return active ?? cycles[0] ?? null;
  }, []);

  useEffect(() => {
    let canceled = false;
    async function load() {
      try {
        const [subs, cfg, cycles] = await Promise.all([fetchSubmissions('all'), fetchConfig(), fetchCycles()]);
        if (canceled) {
          return;
        }
        setSubmissions(subs);
        setConfig(cfg);
        setCurrentCycle(pickCurrentCycle(cycles));
      } catch (e) {
        if (!canceled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load the admin dashboard.');
        }
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, [pickCurrentCycle]);

  const onFilter = useCallback(
    (next: QueueFilter) => {
      setFilter(next);
      void reloadSubmissions(next);
    },
    [reloadSubmissions],
  );

  const onReview = useCallback(
    async (submissionId: string, input: { action: 'confirm' | 'reject'; confirmedAmountUsd?: number; reviewNote?: string }) => {
      setReviewing(submissionId);
      setLoadError(null);
      try {
        await reviewSubmission(submissionId, input);
        await reloadSubmissions(filter);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Review failed.');
      } finally {
        setReviewing(null);
      }
    },
    [filter, reloadSubmissions],
  );

  const onSaveDrive = useCallback(
    async (input: { cycleId: string | null; startsAt: string; endsAt: string; fiatGoalUsd: number; quoraCommentGoal: number; githubStarGoal: number }) => {
      setSavingDrive(true);
      setDriveError(null);
      try {
        const saved = input.cycleId
          ? await updateCycle(input.cycleId, {
              startsAt: input.startsAt || undefined,
              endsAt: input.endsAt || undefined,
              fiatGoalUsd: input.fiatGoalUsd,
              quoraCommentGoal: input.quoraCommentGoal,
              githubStarGoal: input.githubStarGoal,
            })
          : await createCycle({
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              fiatGoalUsd: input.fiatGoalUsd,
              quoraCommentGoal: input.quoraCommentGoal,
              githubStarGoal: input.githubStarGoal,
            });
        setCurrentCycle(saved);
      } catch (e) {
        setDriveError(e instanceof Error ? e.message : 'Could not save the drive.');
      } finally {
        setSavingDrive(false);
      }
    },
    [],
  );

  const onSaveSettings = useCallback(
    async (input: SettingsSaveInput) => {
      setSavingSettings(true);
      setSettingsError(null);
      try {
        const saved = await updateConfig({
          creditsPerUsd: input.creditsPerUsd,
          nonMonetaryUnitValueUsd: nonMonetaryUnitValueFromCreditsPerAction(input.creditsPerAction, input.creditsPerUsd),
          perUserCycleCreditCap: input.perUserCycleCreditCap,
          bannerEnabled: input.bannerEnabled,
          signalInstructions: input.signalInstructions,
        });
        setConfig(saved);
      } catch (e) {
        setSettingsError(e instanceof Error ? e.message : 'Could not save settings.');
      } finally {
        setSavingSettings(false);
      }
    },
    [],
  );

  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  const content = (
    <>
      {tab === 'queue' && (
        <ContributionsAdminQueue
          t={t}
          config={config}
          submissions={submissions}
          filter={filter}
          onFilter={onFilter}
          search={search}
          onSearch={setSearch}
          reviewing={reviewing}
          onReview={onReview}
          isMobile={true}
        />
      )}
      {tab === 'drive' && (
        <ContributionsAdminDrive t={t} cycle={currentCycle} saving={savingDrive} error={driveError} onSave={onSaveDrive} isMobile={true} />
      )}
      {tab === 'settings' &&
        (config ? (
          <ContributionsAdminSettings t={t} config={config} saving={savingSettings} error={settingsError} onSave={onSaveSettings} isMobile={true} />
        ) : (
          <div style={{ flex: 1, padding: 24, fontSize: 13, color: t.MUTED }}>Loading settings…</div>
        ))}
    </>
  );

  return (
      <div style={{ width: '100%', minHeight: '100dvh', background: t.BG, fontFamily: FONT_FAMILY, color: t.TEXT, display: 'flex', flexDirection: 'column' }}>
        <MobileScreenHeader title="Contributions Admin" accent={t.ACCENT} icon={<Gift size={18} color={t.ACCENT} />} actions={<PluginUserShellButton href="/apps/contributions" accent={t.ACCENT} />} />
        <div style={{ padding: '12px 16px 10px', background: t.SURFACE, borderBottom: `1px solid ${t.BORDER_SOLID}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: t.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={13} color="#fff" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>Contributions Admin</span>
          </div>
        </div>
        <div style={{ display: 'flex', borderBottom: `1px solid ${t.BORDER_SOLID}`, flexShrink: 0 }}>
          {TABS.map(({ key }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{ flex: 1, padding: '10px 0', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === key ? 700 : 400, color: tab === key ? t.ACCENT : t.MUTED, borderBottom: tab === key ? `2px solid ${t.ACCENT}` : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              {key === 'queue' ? 'Queue' : key === 'drive' ? 'Drive' : 'Settings'}
              {key === 'queue' && pendingCount > 0 && <span style={{ background: '#F59E0B', color: '#000', fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 99, lineHeight: '14px' }}>{pendingCount}</span>}
            </button>
          ))}
        </div>
        {loadError && <div style={{ padding: '8px 14px', fontSize: 12, color: '#EF4444' }}>{loadError}</div>}
        {content}
      </div>
    );
}
