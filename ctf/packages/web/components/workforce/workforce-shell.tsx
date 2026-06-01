'use client';

import { useEffect, useState } from 'react';
import { BarChart2, Target, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WorkforceDashboard, WorkforceGroupedReportItem, WorkforceProfile } from '../../lib/workforce/types';
import { WorkforceIconRail } from './workforce-icon-rail';
import { WorkforceSidebar } from './workforce-sidebar';
import { WorkforceHeroStats } from './workforce-hero-stats';
import { WorkforceSkillDistribution } from './workforce-skill-distribution';
import { WorkforceSectorGaps } from './workforce-sector-gaps';
import { WorkforceProfilePanel } from './workforce-profile-panel';

const COLOR = '#B45309';

type Tab = 'dashboard';
type SidebarView = 'overview' | 'sector' | 'skill-level';

interface WorkforceData {
  dashboard: WorkforceDashboard | null;
  sectorItems: WorkforceGroupedReportItem[];
  skillItems: WorkforceGroupedReportItem[];
  profile: WorkforceProfile | null;
}

function WorkforceLoadingState() {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#0F1117',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: 'center', padding: '0 32px' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.22)',
            textTransform: 'uppercase',
            fontWeight: 500,
            lineHeight: 2,
          }}
        >
          Loading workforce data…
        </div>
      </div>
    </div>
  );
}

function WorkforceEmptyState() {
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
        <BarChart2 size={32} style={{ color: COLOR, opacity: 0.5 }} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#F9FAFB', marginBottom: 8 }}>
          No workforce data yet
        </div>
        <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7, marginBottom: 24 }}>
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
          { label: 'Total Members', color: COLOR },
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
            <div style={{ fontSize: 12, color: '#4B5563', textAlign: 'center' }}>{label}</div>
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
            color: COLOR,
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Target size={14} /> Sector Gaps
        </div>
        <div style={{ fontSize: 13, color: '#4B5563' }}>
          No sector data — gaps populate as workforce profiles are submitted and sectors assigned.
        </div>
      </div>
      <button
        type="button"
        style={{
          padding: '12px 28px',
          borderRadius: 12,
          background: COLOR,
          border: 'none',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Plus size={16} /> Invite Members to Onboard
      </button>
    </div>
  );
}

function WorkforceDashboardContent({
  dashboard,
  sectorItems,
  skillItems,
  activeView,
}: {
  dashboard: WorkforceDashboard | null;
  sectorItems: WorkforceGroupedReportItem[];
  skillItems: WorkforceGroupedReportItem[];
  activeView: SidebarView;
}) {
  const isEmpty = !dashboard || dashboard.workforceTotal === 0;

  if (isEmpty) {
    return <WorkforceEmptyState />;
  }

  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ padding: '24px' }}>
        <WorkforceHeroStats dashboard={dashboard} />

        {(activeView === 'overview' || activeView === 'skill-level') && skillItems.length > 0 ? (
          <WorkforceSkillDistribution skillItems={skillItems} />
        ) : null}

        {(activeView === 'overview' || activeView === 'sector') ? (
          <WorkforceSectorGaps sectorItems={sectorItems} />
        ) : null}
      </div>
    </ScrollArea>
  );
}

// isAdmin is accepted to match the call site signature; admin-specific UI is not yet implemented
export function WorkforceShell({ isAdmin }: { isAdmin?: boolean }) {
  void isAdmin;
  const [tab] = useState<Tab>('dashboard');
  const [view, setView] = useState<SidebarView>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WorkforceData>({
    dashboard: null,
    sectorItems: [],
    skillItems: [],
    profile: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [dashRes, sectorRes, skillRes, profileRes] = await Promise.all([
          fetch('/api/workforce/dashboard', { signal: controller.signal }),
          fetch('/api/workforce/reports/sector/all', { signal: controller.signal }),
          fetch('/api/workforce/reports/skill-level/all', { signal: controller.signal }),
          fetch('/api/workforce/profile', { signal: controller.signal }),
        ]);

        if (controller.signal.aborted) return;

        const dashJson = dashRes.ok
          ? ((await dashRes.json()) as { dashboard?: WorkforceDashboard })
          : null;
        const sectorJson = sectorRes.ok
          ? ((await sectorRes.json()) as { items?: WorkforceGroupedReportItem[] })
          : null;
        const skillJson = skillRes.ok
          ? ((await skillRes.json()) as { items?: WorkforceGroupedReportItem[] })
          : null;
        const profileJson = profileRes.ok
          ? ((await profileRes.json()) as { profile?: WorkforceProfile })
          : null;

        setData({
          dashboard: dashJson?.dashboard ?? null,
          sectorItems: sectorJson?.items ?? [],
          skillItems: skillJson?.items ?? [],
          profile: profileJson?.profile ?? null,
        });
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load workforce data.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchAll();
    return () => {
      controller.abort();
    };
  }, []);

  const { dashboard, sectorItems, skillItems, profile } = data;

  if (loading) {
    return <WorkforceLoadingState />;
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          background: '#0F1117',
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

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        background: '#0F1117',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#E8EAF0',
        display: 'flex',
      }}
    >
      <WorkforceIconRail activeTab={tab} onTabChange={() => undefined} />

      <WorkforceSidebar
        activeView={view}
        onViewChange={setView}
        dashboard={dashboard}
        sectorItems={sectorItems}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            height: 56,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: 16,
            background: '#0D0F14',
            flexShrink: 0,
          }}
        >
          <BarChart2 size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>
              Workforce Dashboard
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {dashboard
                ? `${dashboard.workforceTotal.toLocaleString()} members · ${dashboard.recruitedTotal.toLocaleString()} recruited`
                : 'Live workforce tracker'}
            </div>
          </div>
        </header>

        <WorkforceDashboardContent
          dashboard={dashboard}
          sectorItems={sectorItems}
          skillItems={skillItems}
          activeView={view}
        />
      </div>

      <WorkforceProfilePanel profile={profile} loading={loading} />
    </div>
  );
}
