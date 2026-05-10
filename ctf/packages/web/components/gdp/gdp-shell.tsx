'use client';

import { useEffect, useState } from 'react';
import { Globe, BarChart2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const COLOR = '#06B6D4';

interface GdpSector { name: string; color?: string; value: string; members: number }
interface GdpCountry { country: string; flag: string; gdp: string; members: number }
interface GdpMetrics {
  currentValue?: string;
  delta?: string;
  target?: string;
  progress?: string;
  countries?: string;
  members?: string;
  memberStats?: { v: string; l: string; c?: string }[];
}
interface GdpReport { sectors: GdpSector[]; countries: GdpCountry[]; metrics: GdpMetrics }

type Tab = 'dashboard' | 'map';

export default function GdpShell(_: { isAdmin?: boolean }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GdpReport | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchReport() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/gdp/report/current', { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to load GDP report');
        const data = (await res.json()) as { report?: GdpReport };
        if (!controller.signal.aborted) {
          setReport(data.report ?? null);
        }
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load GDP data.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    void fetchReport();
    return () => { controller.abort(); };
  }, []);

  const sectors = report?.sectors ?? [];
  const countries = report?.countries ?? [];
  const metrics = report?.metrics ?? {};

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100vh', background: '#0F1117', fontFamily: 'Inter, system-ui, sans-serif', color: '#E8EAF0', display: 'flex' }}>

      {/* 72px icon rail */}
      <aside style={{ width: 72, background: '#090B0F', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Globe size={20} style={{ color: COLOR }} />
        </div>
        {([
          { icon: BarChart2, key: 'dashboard', label: 'Dashboard' },
          { icon: Globe, key: 'map', label: 'Map' },
        ] as const).map(({ icon: Icon, key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            title={label}
            style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : 'transparent', border: tab === key ? `1px solid ${COLOR}40` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: tab === key ? COLOR : '#6B7280' }}
          >
            <Icon size={20} />
          </button>
        ))}
      </aside>

      {/* Second sidebar */}
      <aside style={{ width: 240, background: '#0D0F14', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12 }}>🗺️ GDP Tracker</div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: '0 8px 16px' }}>
            {['Global Overview', 'By Sector', 'By Country', 'By Phase', 'Projections'].map((f, i) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: i === 0 ? `${COLOR}18` : 'transparent', borderLeft: i === 0 ? `2px solid ${COLOR}` : '2px solid transparent', marginLeft: 2, marginBottom: 2 }}>
                <span style={{ fontSize: 13, color: i === 0 ? '#E8EAF0' : '#9CA3AF', flex: 1 }}>{f}</span>
              </div>
            ))}
            {metrics.currentValue ? (
              <>
                <div style={{ margin: '16px 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', padding: '0 10px' }}>Live Ticker</div>
                <div style={{ padding: '12px', margin: '0 8px 8px', borderRadius: 10, background: `${COLOR}08`, border: `1px solid ${COLOR}15` }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: COLOR }}>{metrics.currentValue}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Current TI Skills Economy</div>
                  {metrics.delta ? <div style={{ fontSize: 12, color: '#22C55E' }}>{metrics.delta}</div> : null}
                </div>
                {[
                  { l: 'Target', v: metrics.target },
                  { l: 'Progress', v: metrics.progress },
                  { l: 'Countries', v: metrics.countries },
                  { l: 'Members', v: metrics.members },
                ].filter(({ v }) => Boolean(v)).map(({ l, v }) => (
                  <div key={l} style={{ padding: '6px 10px', fontSize: 12, color: '#6B7280' }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
                ))}
              </>
            ) : null}
          </div>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#0D0F14', flexShrink: 0 }}>
          <Globe size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>🗺️ Gross Domestic Product — TI Skills Economy</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {metrics.countries ? `${metrics.countries} countries · ` : ''}{metrics.members ? `${metrics.members} survivors` : 'Loading…'}
            </div>
          </div>
          <Badge style={{ background: '#22C55E20', color: '#22C55E', border: '1px solid #22C55E35', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>↑ Live</Badge>
        </header>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 14 }}>
            Loading GDP report…
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', fontSize: 14, padding: 24 }}>
            {error}
          </div>
        ) : !report ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#6B7280' }}>
            <Globe size={48} style={{ color: COLOR, opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>No GDP report published yet</div>
            <div style={{ fontSize: 13 }}>Check back soon.</div>
          </div>
        ) : tab === 'dashboard' ? (
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: '24px' }}>
              {/* Hero */}
              <div style={{ marginBottom: 24, padding: '28px 32px', borderRadius: 20, background: `linear-gradient(135deg,${COLOR}20 0%,rgba(6,182,212,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
                <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: COLOR, textTransform: 'uppercase', marginBottom: 8 }}>TI Skills Economy — Live</div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: '#F9FAFB', lineHeight: 1, marginBottom: 8 }}>{metrics.currentValue || '—'}</div>
                    <div style={{ fontSize: 16, color: '#9CA3AF' }}>
                      {metrics.target ? `of ${metrics.target} opportunity` : ''}
                      {metrics.progress ? ` · ${metrics.progress} reached` : ''}
                    </div>
                    {metrics.progress ? (
                      <div style={{ marginTop: 16, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: `linear-gradient(to right,${COLOR},#22D3EE)`, borderRadius: 4, width: metrics.progress }} />
                      </div>
                    ) : null}
                  </div>
                  {(metrics.memberStats ?? []).length > 0 ? (
                    <div style={{ display: 'flex', gap: 12 }}>
                      {(metrics.memberStats ?? []).map(({ v, l, c }) => (
                        <div key={l} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: c ?? COLOR }}>{v}</div>
                          <div style={{ fontSize: 11, color: '#6B7280' }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: sectors.length > 0 && countries.length > 0 ? '3fr 2fr' : '1fr', gap: 20 }}>
                {/* Sectors */}
                {sectors.length > 0 ? (
                  <div style={{ padding: '20px 24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 16 }}>GDP by Sector</div>
                    {sectors.map((s) => (
                      <div key={s.name} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ color: '#E8EAF0' }}>{s.name}</span>
                          <span style={{ color: s.color ?? COLOR, fontWeight: 700 }}>{s.value}</span>
                        </div>
                        <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: s.color ?? COLOR, borderRadius: 4, width: '60%', opacity: 0.85 }} />
                        </div>
                        <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{s.members.toLocaleString()} members</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Countries */}
                {countries.length > 0 ? (
                  <div style={{ padding: '20px 24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#F9FAFB', marginBottom: 16 }}>Top Countries</div>
                    {countries.map((c, i) => (
                      <div key={c.country} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ fontSize: 24, flexShrink: 0 }}>{c.flag}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, color: '#E8EAF0', fontWeight: 600 }}>{c.country}</span>
                            <span style={{ fontSize: 13, color: COLOR, fontWeight: 700 }}>{c.gdp}</span>
                          </div>
                          <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: COLOR, borderRadius: 2, width: `${100 - i * 15}%`, opacity: 0.7 }} />
                          </div>
                          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{c.members.toLocaleString()} members</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {sectors.length === 0 && countries.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 14, padding: '40px 0' }}>
                  No sector or country data available in this report.
                </div>
              ) : null}
            </div>
          </ScrollArea>
        ) : (
          /* Map tab — empty state */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <Globe size={64} style={{ color: COLOR, opacity: 0.3 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: '#6B7280' }}>World Map — coming soon</div>
            <div style={{ fontSize: 13, color: '#4B5563' }}>Live GDP distribution by country</div>
            {countries.length > 0 ? (
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {countries.slice(0, 5).map((c) => (
                  <span key={c.country} style={{ fontSize: 24 }}>{c.flag}</span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
