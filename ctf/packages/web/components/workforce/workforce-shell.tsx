'use client';

import { useEffect, useState } from 'react';
import { BarChart2, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { WorkforceDashboard, WorkforceGroupedReportItem, WorkforceProfile } from '../../lib/workforce/types';

const COLOR = '#6366F1';

type SidebarView = 'overview' | 'sector' | 'skill-level';

interface WorkforceData {
  dashboard: WorkforceDashboard | null;
  sectorItems: WorkforceGroupedReportItem[];
  skillItems: WorkforceGroupedReportItem[];
  profile: WorkforceProfile | null;
}

function recruitmentPct(recruited: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((recruited / total) * 100);
}

export function WorkforceShell(_: { isAdmin?: boolean }) {
  const [view, setView] = useState<SidebarView>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WorkforceData>({ dashboard: null, sectorItems: [], skillItems: [], profile: null });

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

        const dashJson = dashRes.ok ? ((await dashRes.json()) as { dashboard?: WorkforceDashboard }) : null;
        const sectorJson = sectorRes.ok ? ((await sectorRes.json()) as { items?: WorkforceGroupedReportItem[] }) : null;
        const skillJson = skillRes.ok ? ((await skillRes.json()) as { items?: WorkforceGroupedReportItem[] }) : null;
        const profileJson = profileRes.ok ? ((await profileRes.json()) as { profile?: WorkforceProfile }) : null;

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
    return () => { controller.abort(); };
  }, []);

  const { dashboard, sectorItems, skillItems, profile } = data;

  const sidebarItems: { label: string; key: SidebarView; badge?: number }[] = [
    { label: 'Overview', key: 'overview' },
    { label: 'By Sector', key: 'sector' },
    { label: 'By Skill Level', key: 'skill-level' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100vh', background: '#0F1117', fontFamily: 'Inter, system-ui, sans-serif', color: '#E8EAF0', display: 'flex' }}>

      {/* 72px icon rail */}
      <aside style={{ width: 72, background: '#090B0F', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <BarChart2 size={20} style={{ color: COLOR }} />
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${COLOR}20`, border: `1px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR }}>
          <BarChart2 size={20} />
        </div>
      </aside>

      {/* Sidebar */}
      <aside style={{ width: 240, background: '#0D0F14', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12 }}>💼 Workforce</div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4B5563', pointerEvents: 'none' }} />
            <input
              placeholder="Search sectors…"
              readOnly
              style={{ width: '100%', padding: '7px 10px 7px 30px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 13, color: '#9CA3AF', outline: 'none', boxSizing: 'border-box', cursor: 'default' }}
            />
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: '0 8px 16px' }}>
            {sidebarItems.map(({ label, key }) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: view === key ? `${COLOR}18` : 'transparent', borderLeft: view === key ? `2px solid ${COLOR}` : '2px solid transparent', marginLeft: 2, marginBottom: 2, border: 'none', width: 'calc(100% - 4px)', textAlign: 'left' }}
              >
                <span style={{ fontSize: 13, color: view === key ? '#E8EAF0' : '#9CA3AF', flex: 1 }}>{label}</span>
              </button>
            ))}

            {dashboard ? (
              <>
                <div style={{ margin: '16px 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', padding: '0 10px' }}>Quick Stats</div>
                {[
                  { l: 'Total Profiles', v: dashboard.workforceTotal.toLocaleString() },
                  { l: 'Recruited', v: dashboard.recruitedTotal.toLocaleString() },
                  { l: 'Occupations', v: dashboard.occupationsTotal.toLocaleString() },
                ].map(({ l, v }) => (
                  <div key={l} style={{ padding: '7px 10px', fontSize: 12, color: '#6B7280' }}>
                    {l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#0D0F14', flexShrink: 0 }}>
          <BarChart2 size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>💼 Workforce Dashboard</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {dashboard ? `${dashboard.workforceTotal.toLocaleString()} profiles · ${dashboard.recruitedTotal.toLocaleString()} recruited` : 'Loading…'}
            </div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>Phase 1</Badge>
        </header>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 14 }}>
            Loading workforce data…
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', fontSize: 14, padding: 24 }}>
            {error}
          </div>
        ) : (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: 24 }}>
              {/* Summary stats */}
              {dashboard ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: 'Total Profiles', value: dashboard.workforceTotal.toLocaleString(), color: COLOR },
                    { label: 'Recruited', value: dashboard.recruitedTotal.toLocaleString(), color: '#22C55E' },
                    { label: 'Occupations', value: dashboard.occupationsTotal.toLocaleString(), color: '#F59E0B' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: 20, borderRadius: 16, background: `${color}08`, border: `1px solid ${color}20` }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
                      <div style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500 }}>{label}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Recruitment progress bar */}
              {dashboard && dashboard.workforceTotal > 0 ? (
                <div style={{ padding: '20px 24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>Recruitment Progress</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Overall progress toward recruited workforce</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#9CA3AF', marginBottom: 6 }}>
                    <span>Overall Progress</span>
                    <span style={{ color: COLOR, fontWeight: 600 }}>{recruitmentPct(dashboard.recruitedTotal, dashboard.workforceTotal)}%</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: `linear-gradient(to right,${COLOR},#818CF8)`, borderRadius: 4, width: `${recruitmentPct(dashboard.recruitedTotal, dashboard.workforceTotal)}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#4B5563' }}>
                    <span>Recruited: {dashboard.recruitedTotal.toLocaleString()}</span>
                    <span>Total: {dashboard.workforceTotal.toLocaleString()}</span>
                  </div>
                </div>
              ) : null}

              {/* Sector breakdown */}
              {(view === 'overview' || view === 'sector') && sectorItems.length > 0 ? (
                <div style={{ padding: '20px 24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>Sector Distribution</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Workforce vs. recruited by sector</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {sectorItems.map((item) => {
                      const gap = item.workforceTotal - item.recruitedTotal;
                      const filledPct = recruitmentPct(item.recruitedTotal, item.workforceTotal);
                      return (
                        <div key={item.bucket}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span style={{ color: '#E8EAF0' }}>{item.bucket}</span>
                            <span style={{ color: '#9CA3AF' }}>
                              {item.recruitedTotal.toLocaleString()} / {item.workforceTotal.toLocaleString()}
                              {gap > 0 ? <span style={{ color: '#EF4444', marginLeft: 8 }}>–{gap.toLocaleString()} gap</span> : null}
                            </span>
                          </div>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: COLOR, borderRadius: 3, width: `${filledPct}%` }} />
                          </div>
                          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{filledPct}% recruited</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Skill-level breakdown */}
              {(view === 'overview' || view === 'skill-level') && skillItems.length > 0 ? (
                <div style={{ padding: '20px 24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>Skill Level Breakdown</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Recruitment progress by skill level</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {skillItems.map((item) => {
                      const filledPct = recruitmentPct(item.recruitedTotal, item.workforceTotal);
                      return (
                        <div key={item.bucket} style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 13, color: '#9CA3AF', textTransform: 'capitalize', marginBottom: 8 }}>{item.bucket}</div>
                          <div style={{ height: 80, background: 'rgba(255,255,255,0.03)', borderRadius: 8, position: 'relative', overflow: 'hidden', marginBottom: 8 }}>
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: COLOR, height: `${filledPct}%`, borderRadius: '8px 8px 0 0', opacity: 0.85 }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#F9FAFB' }}>{filledPct}%</div>
                          </div>
                          <div style={{ fontSize: 12, color: '#9CA3AF' }}>{item.recruitedTotal.toLocaleString()} / {item.workforceTotal.toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {!dashboard && !loading ? (
                <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 14, padding: '40px 0' }}>
                  No workforce data available yet.
                </div>
              ) : null}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Right rail — user's own profile */}
      <aside style={{ width: 280, borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#0D0F14', padding: '20px 16px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase' }}>My Workforce Profile</div>
        {profile ? (
          <div style={{ padding: 16, borderRadius: 14, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>
              {profile.occupationName ?? 'No occupation set'}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10, textTransform: 'capitalize' }}>
              Skill level: <span style={{ color: COLOR }}>{profile.skillLevel}</span>
            </div>
            {profile.region ? (
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                Region: <span style={{ color: '#9CA3AF' }}>{profile.region}</span>
              </div>
            ) : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {profile.recruitedState ? (
                <Badge style={{ background: '#22C55E20', color: '#22C55E', border: '1px solid #22C55E35', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>✓ Recruited</Badge>
              ) : (
                <Badge style={{ background: 'rgba(255,255,255,0.05)', color: '#6B7280', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>Not yet recruited</Badge>
              )}
            </div>
          </div>
        ) : !loading ? (
          <div style={{ padding: 16, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>No profile set up yet</div>
            <div style={{ fontSize: 12, color: '#4B5563' }}>Complete your workforce profile to be included in the tracker.</div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
