
'use client';

import { useEffect, useState } from 'react';
import { Globe, TrendingUp, BarChart2, Bell, Settings, MessageSquare, Badge } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const COLOR = '#06B6D4';

export default function GdpShell(_props: { isAdmin?: boolean }) {
  // LighthouseShell pattern: use client, loading/error/data state, API fetch, empty state, real data mapping
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchReport() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/gdp/report/current", { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load GDP report");
        const data = await res.json();
        if (!controller.signal.aborted) {
          setReport(data.report ?? null);
        }
      } catch (e: any) {
        if (controller.signal.aborted) {
          // Ignore aborts
          return;
        }
        // Only set error if not aborted
        setError(e.message || "Failed to load GDP data.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    fetchReport();
    return () => {
      controller.abort();
    };
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading GDP report…</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!report) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">GDP Tracker</h2>
        <p className="mb-4">No GDP report has been published yet. Check back soon.</p>
      </div>
    );
  }

  // Map API data to UI (fallback to mockup structure if missing)
  const sectors = report.sectors || [];
  const countries = report.countries || [];
  const metrics = report.metrics || {};

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100vh', background: '#0F1117', fontFamily: 'Inter, system-ui, sans-serif', color: '#E8EAF0', display: 'flex' }}>
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
            <div style={{ margin: '16px 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', padding: '0 10px' }}>Live Ticker</div>
            <div style={{ padding: '12px', margin: '0 8px 8px', borderRadius: 10, background: `${COLOR}08`, border: `1px solid ${COLOR}15` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: COLOR }}>{metrics.currentValue || '$0'}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Current TI Skills Economy</div>
              <div style={{ fontSize: 12, color: '#22C55E' }}>{metrics.delta || ''}</div>
            </div>
            {[{ l: 'Target', v: metrics.target || '$300B' }, { l: 'Progress', v: metrics.progress || '0%' }, { l: 'Countries', v: metrics.countries || '0' }, { l: 'Members', v: metrics.members || '0' }].map(({ l, v }) => (
              <div key={l} style={{ padding: '6px 10px', fontSize: 12, color: '#6B7280' }}>{l}: <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span></div>
            ))}
          </div>
        </ScrollArea>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}><Settings size={18} /></button>
          <Avatar style={{ width: 36, height: 36 }}>
            <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
          </Avatar>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#0D0F14', flexShrink: 0 }}>
          <Globe size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>🗺️ Gross Domestic Product — TI Skills Economy</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Real-time · {metrics.countries || '0'} countries · {metrics.members || '0'} survivors building {metrics.target || '$300B'}</div>
          </div>
          <Badge style={{ background: '#22C55E20', color: '#22C55E', border: '1px solid #22C55E35', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>↑ Live</Badge>
        </header>

        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: '24px' }}>
            {/* Hero */}
            <div style={{ marginBottom: 24, padding: '28px 32px', borderRadius: 20, background: `linear-gradient(135deg,${COLOR}20 0%,rgba(6,182,212,0.05) 100%)`, border: `1px solid ${COLOR}25` }}>
              <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: COLOR, textTransform: 'uppercase', marginBottom: 8 }}>TI Skills Economy — Live</div>
                  <div style={{ fontSize: 48, fontWeight: 900, color: '#F9FAFB', lineHeight: 1, marginBottom: 8 }}>{metrics.currentValue || '$0'}</div>
                  <div style={{ fontSize: 16, color: '#9CA3AF' }}>of {metrics.target || '$300B'} opportunity · {metrics.progress || '0%'} reached</div>
                  <div style={{ marginTop: 16, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: `linear-gradient(to right,${COLOR},#22D3EE)`, borderRadius: 4, width: metrics.progress || '0%' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(metrics.memberStats || []).map(({ v, l, c }: any, i: number) => (
                    <div key={i} style={{ padding: '12px 16px', borderRadius: 12, background: `${c || COLOR}10`, color: c || COLOR, fontWeight: 700, fontSize: 18 }}>{v}<div style={{ fontSize: 12, color: '#E8EAF0' }}>{l}</div></div>
                  ))}
                </div>
              </div>
            </div>
            {/* Sectors */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#E8EAF0', marginBottom: 12 }}>Sectors</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {sectors.map((s: any) => (
                  <div key={s.name} style={{ flex: '1 1 180px', minWidth: 160, padding: '18px', borderRadius: 14, background: `${s.color || COLOR}08`, border: `1px solid ${(s.color || COLOR)}20` }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: s.color || COLOR }}>{s.name}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#F9FAFB', margin: '8px 0' }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: '#6B7280' }}>{s.members} members</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Countries */}
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#E8EAF0', marginBottom: 12 }}>Top Countries</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {countries.map((c: any) => (
                  <div key={c.country} style={{ flex: '1 1 140px', minWidth: 120, padding: '14px', borderRadius: 12, background: '#0D0F14', border: '1px solid #222', color: '#E8EAF0' }}>
                    <div style={{ fontSize: 24 }}>{c.flag}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{c.country}</div>
                    <div style={{ fontSize: 13, color: COLOR }}>{c.gdp} GDP</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{c.members} members</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
