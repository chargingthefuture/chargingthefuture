'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart2, ChevronLeft, Target, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { AppLoading } from '@/components/shared/app-loading';
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
  return <AppLoading />;
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
  const isMobile = useIsMobile();

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

  const content = (
    <WorkforceDashboardContent
      dashboard={dashboard}
      sectorItems={sectorItems}
      skillItems={skillItems}
      activeView={view}
    />
  );

  if (isMobile) {
    const views: { key: SidebarView; label: string }[] = [
      { key: 'overview', label: 'Overview' },
      { key: 'sector', label: 'Sectors' },
      { key: 'skill-level', label: 'Skill Level' },
    ];
    // ctf-self-responsive opts out of the global mobile de-flex so this flex
    // column keeps a real height — the dashboard's ScrollArea needs it to scroll.
    return (
      <div className="ctf-self-responsive" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0F1117', fontFamily: "'Inter', system-ui, sans-serif", color: '#E8EAF0' }}>
        <div style={{ background: '#0D0F14', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
            <Link href="/apps" aria-label="Back to apps" style={{ width: 38, height: 38, borderRadius: 10, background: `${COLOR}20`, border: `1px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR, textDecoration: 'none', flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <BarChart2 size={18} style={{ color: COLOR, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB', flex: 1 }}>Workforce</span>
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px', overflowX: 'auto' }}>
            {views.map(({ key, label }) => (
              <button key={key} onClick={() => setView(key)} style={{ whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 8, background: view === key ? `${COLOR}20` : 'transparent', border: `1px solid ${view === key ? COLOR + '40' : 'rgba(255,255,255,0.08)'}`, color: view === key ? COLOR : '#9CA3AF', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {content}
        </div>
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

        {content}
      </div>

      <WorkforceProfilePanel profile={profile} loading={loading} />
    </div>
  );
}
