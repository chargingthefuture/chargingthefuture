'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart2, Target } from 'lucide-react';
import { BackChevronButton } from '@/lib/nav/back-history';
import { useTheme } from '@/hooks/useTheme';
import { AppLoading } from '@/components/shared/app-loading';
import { getWorkforceTokens, type WorkforceTokens } from './workforce-shared';
import type {
  WorkforceDashboard,
  WorkforceGroupedReportItem,
  WorkforceOccupationGapItem,
  WorkforceProfile,
} from '../../lib/workforce/types';
import { WorkforceHeroStats } from './workforce-hero-stats';
import { WorkforceSkillDistribution } from './workforce-skill-distribution';
import { WorkforceSectorGaps } from './workforce-sector-gaps';
import { WorkforceTrainingGaps } from './workforce-training-gaps';
import { WorkforceBucketDrilldown } from './workforce-bucket-drilldown';
import { WorkforceOccupations } from './workforce-occupations';
import { WorkforceCommunityPlanning } from './workforce-community-planning';
import { PluginAdminButton } from '@/components/shared/plugin-admin-button';
import { MobileTopActions } from '@/components/shared/mobile-top-actions';
import { RefreshButton } from '@/components/shared/refresh-button';

type SidebarView = 'overview' | 'sector' | 'skill-level' | 'occupations' | 'community-planning';

interface WorkforceData {
  dashboard: WorkforceDashboard | null;
  sectorItems: WorkforceGroupedReportItem[];
  skillItems: WorkforceGroupedReportItem[];
  occupationItems: WorkforceOccupationGapItem[];
  profile: WorkforceProfile | null;
}

function WorkforceLoadingState() {
  return <AppLoading />;
}

function WorkforceEmptyState({ t }: { t: WorkforceTokens }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BarChart2 size={32} style={{ color: t.ACCENT, opacity: 0.5 }} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: t.TITLE, marginBottom: 8 }}>
          No workforce data yet
        </div>
        <div style={{ fontSize: 14, color: t.MUTED, lineHeight: 1.7, marginBottom: 24 }}>
          Once profiles are submitted and sectors assigned, workforce distribution and gap analysis will appear here.
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          width: '100%',
          maxWidth: 700,
        }}
      >
        {[
          { label: 'Total Members', color: t.ACCENT },
          { label: 'Recruited', color: '#22C55E' },
          { label: 'Not Recruited', color: '#F59E0B' },
          { label: 'Sector Gaps', color: '#EF4444' },
        ].map(({ label, color }) => (
          <div
            key={label}
            style={{
              padding: '20px',
              borderRadius: 16,
              background: `${color}06`,
              border: `1px dashed ${color}25`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ width: 32, height: 8, borderRadius: 4, background: `${color}20` }} />
            <div style={{ fontSize: 12, color: t.FAINT, textAlign: 'center' }}>{label}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          padding: '16px 24px',
          borderRadius: 12,
          background: 'rgba(99,102,241,0.06)',
          border: '1px dashed rgba(99,102,241,0.2)',
          width: '100%',
          maxWidth: 700,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: t.ACCENT,
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Target size={14} /> Sector Gaps
        </div>
        <div style={{ fontSize: 13, color: t.FAINT }}>
          No sector data — gaps populate as workforce profiles are submitted and sectors assigned.
        </div>
      </div>
    </div>
  );
}

function WorkforceWarningBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.35)',
        color: '#F59E0B',
        fontSize: 13,
        marginBottom: 16,
      }}
    >
      {message}
    </div>
  );
}

// Empty only when there is genuinely nothing to track: no taxonomy sectors/occupations and nobody
// in the Directory. Demand alone (population model) is enough to render the dashboard.
function isDashboardEmptyData(dashboard: WorkforceDashboard): boolean {
  return dashboard.sectorsTotal === 0 && dashboard.occupationsTotal === 0 && dashboard.totalMembers === 0;
}

function WorkforceSkillSection({
  activeView,
  skillItems,
}: {
  activeView: SidebarView;
  skillItems: WorkforceGroupedReportItem[];
}) {
  const showDistribution = (activeView === 'overview' || activeView === 'skill-level') && skillItems.length > 0;
  return (
    <>
      {showDistribution ? <WorkforceSkillDistribution skillItems={skillItems} /> : null}

      {/* Skill-level drilldown: expand a level to see the matched members (the V2 drilldown). */}
      {activeView === 'skill-level' ? (
        <div style={{ marginTop: 16 }}>
          <WorkforceBucketDrilldown kind="skill-level" title="Members by skill level" items={skillItems} />
        </div>
      ) : null}
    </>
  );
}

function WorkforceSectorSection({
  activeView,
  sectorItems,
  occupationItems,
}: {
  activeView: SidebarView;
  sectorItems: WorkforceGroupedReportItem[];
  occupationItems: WorkforceOccupationGapItem[];
}) {
  const showTraining = activeView === 'overview' || activeView === 'sector';
  return (
    <>
      {/* Overview keeps the aggregate sector bars; the Sectors view uses the expandable drilldown so
          members are reachable. */}
      {activeView === 'overview' ? <WorkforceSectorGaps sectorItems={sectorItems} /> : null}
      {activeView === 'sector' ? (
        <WorkforceBucketDrilldown kind="sector" title="Members by sector" items={sectorItems} />
      ) : null}

      {showTraining ? (
        <div style={{ marginTop: 16 }}>
          <WorkforceTrainingGaps occupationItems={occupationItems} />
        </div>
      ) : null}
    </>
  );
}

function WorkforceDashboardContent({
  t,
  dashboard,
  sectorItems,
  skillItems,
  occupationItems,
  activeView,
  warning,
}: {
  t: WorkforceTokens;
  dashboard: WorkforceDashboard | null;
  sectorItems: WorkforceGroupedReportItem[];
  skillItems: WorkforceGroupedReportItem[];
  occupationItems: WorkforceOccupationGapItem[];
  activeView: SidebarView;
  warning: string | null;
}) {
  if (!dashboard || isDashboardEmptyData(dashboard)) {
    return <WorkforceEmptyState t={t} />;
  }

  return (
    <div style={{ flex: 1 }}>
      <div style={{ padding: '24px' }}>
        {warning ? <WorkforceWarningBanner message={warning} /> : null}
        <WorkforceHeroStats dashboard={dashboard} />

        <WorkforceSkillSection activeView={activeView} skillItems={skillItems} />

        <WorkforceSectorSection
          activeView={activeView}
          sectorItems={sectorItems}
          occupationItems={occupationItems}
        />
      </div>
    </div>
  );
}

function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

// A 401/403 on ANY endpoint means the session is no longer valid (e.g. it expired after the page
// loaded). Callers surface a re-auth prompt rather than a soft "couldn't load" warning.
function anyAuthFailure(responses: Response[]): boolean {
  return responses.some((r) => r.status === 401 || r.status === 403);
}

async function readItems<T>(res: Response): Promise<T[]> {
  if (!res.ok) return [];
  const json = (await res.json()) as { items?: T[] };
  return json.items ?? [];
}

// A 404 on the profile is normal (the member has not claimed a Directory profile); any other
// non-OK profile status yields null too, and is noted separately in failedSectionsMessage.
async function readProfile(res: Response): Promise<WorkforceProfile | null> {
  if (!res.ok) return null;
  const json = (await res.json()) as { profile?: WorkforceProfile };
  return json.profile ?? null;
}

// Surface a non-blocking notice if a secondary panel failed to load, instead of silently showing it
// empty (which reads as "no data").
function failedSectionsMessage(
  sectorRes: Response,
  skillRes: Response,
  occRes: Response,
  profileRes: Response,
): string | null {
  const failed: string[] = [];
  if (!sectorRes.ok) failed.push('sector gaps');
  if (!skillRes.ok) failed.push('skill levels');
  if (!occRes.ok) failed.push('training gaps');
  if (!profileRes.ok && profileRes.status !== 404) failed.push('your profile');
  return failed.length > 0 ? `Some sections could not be loaded: ${failed.join(', ')}.` : null;
}

async function loadWorkforceData(
  signal?: AbortSignal,
): Promise<{ data: WorkforceData; warning: string | null }> {
  const [dashRes, sectorRes, skillRes, occRes, profileRes] = await Promise.all([
    fetch('/api/workforce/dashboard', { signal }),
    fetch('/api/workforce/reports/sector/all', { signal }),
    fetch('/api/workforce/reports/skill-level/all', { signal }),
    fetch('/api/workforce/reports/occupations?limit=10', { signal }),
    fetch('/api/workforce/profile', { signal }),
  ]);

  if (anyAuthFailure([dashRes, sectorRes, skillRes, occRes, profileRes])) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  // The dashboard is the core of the page; if it fails there is nothing meaningful to show, so
  // surface the error state rather than silently falling through to the empty state.
  if (!dashRes.ok) {
    throw new Error(`Dashboard request failed (${dashRes.status}).`);
  }

  const dashJson = (await dashRes.json()) as { dashboard?: WorkforceDashboard };
  const data: WorkforceData = {
    dashboard: dashJson.dashboard ?? null,
    sectorItems: await readItems<WorkforceGroupedReportItem>(sectorRes),
    skillItems: await readItems<WorkforceGroupedReportItem>(skillRes),
    occupationItems: await readItems<WorkforceOccupationGapItem>(occRes),
    profile: await readProfile(profileRes),
  };
  return { data, warning: failedSectionsMessage(sectorRes, skillRes, occRes, profileRes) };
}

export function WorkforceShell({ isAdmin }: { isAdmin?: boolean }) {
  const [view, setView] = useState<SidebarView>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [data, setData] = useState<WorkforceData>({
    dashboard: null,
    sectorItems: [],
    skillItems: [],
    occupationItems: [],
    profile: null,
  });
  const { theme } = useTheme();
  const t = getWorkforceTokens(theme);

  // Shared by the initial-load effect and the header refresh button; a refresh (initial=false)
  // re-pulls the data without flashing the full-screen loading state.
  const fetchAll = useCallback(async (initial: boolean, signal?: AbortSignal) => {
    if (initial) setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const { data: loaded, warning: warn } = await loadWorkforceData(signal);
      if (isAborted(signal)) return;
      setData(loaded);
      setWarning(warn);
    } catch (e: unknown) {
      if (isAborted(signal)) return;
      setError(e instanceof Error ? e.message : 'Failed to load workforce data.');
    } finally {
      if (!isAborted(signal) && initial) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAll(true, controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchAll]);

  const { dashboard, sectorItems, skillItems, occupationItems } = data;

  if (loading) {
    return <WorkforceLoadingState />;
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100dvh',
          background: t.BG,
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Inter', system-ui, sans-serif",
          color: '#EF4444',
          fontSize: 14,
          padding: 24,
        }}
      >
        {error}
      </div>
    );
  }

  const content = view === 'occupations' ? (
    <WorkforceOccupations />
  ) : view === 'community-planning' ? (
    <WorkforceCommunityPlanning />
  ) : (
    <WorkforceDashboardContent
      t={t}
      dashboard={dashboard}
      sectorItems={sectorItems}
      skillItems={skillItems}
      occupationItems={occupationItems}
      activeView={view}
      warning={warning}
    />
  );

    const views: { key: SidebarView; label: string }[] = [
      { key: 'overview', label: 'Overview' },
      { key: 'sector', label: 'Sectors' },
      { key: 'skill-level', label: 'Skill Level' },
      { key: 'occupations', label: 'Occupations' },
      { key: 'community-planning', label: 'Community' },
    ];
    // The whole document scrolls here, like every other screen: the shell is only
    // *at least* one viewport tall and nothing inside it owns a scrollbar. Pinning the
    // shell to exactly 100dvh and scrolling an inner box instead leaves the document
    // itself unscrollable, which is what broke Safari's "Full Page" screenshot on this
    // screen — it captured one viewport and stopped. The header stays put via
    // position: sticky, the same way the shared MobileScreenHeader does.
    // ctf-self-responsive opts out of the global mobile de-flex so this stays a flex column.
    return (
      <div className="ctf-self-responsive" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ background: t.HEADER, borderBottom: `1px solid ${t.BORDER}`, flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
          {/* flexWrap: this row carries the plugin actions plus the three global ones, which
              together overflow a 390px phone — the last control was clipped off the right
              edge and the title collapsed to nothing. Wrapping reflows instead of cutting
              off; on a wider viewport it still renders as one line. */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 6, gap: 8, padding: '10px 14px' }}>
            <BackChevronButton accent={t.ACCENT} />
            <BarChart2 size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Workforce</span>
            <PluginAdminButton href="/admin/workforce" isAdmin={isAdmin} accent={t.ACCENT} />
            <RefreshButton onRefresh={() => fetchAll(false)} title="Refresh" />
            <MobileTopActions />
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px', overflowX: 'auto' }}>
            {views.map(({ key, label }) => (
              <button key={key} onClick={() => setView(key)} style={{ whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 8, background: view === key ? `${t.ACCENT}20` : 'transparent', border: `1px solid ${view === key ? t.ACCENT + '40' : t.BORDER_STRONG}`, color: view === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {content}
        </div>
      </div>
    );

}
