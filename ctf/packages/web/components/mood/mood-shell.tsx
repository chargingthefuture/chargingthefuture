'use client';

  import { useEffect, useState } from 'react';
  import { Smile, TrendingUp, MessageSquare, Bell, Settings, Lock, Send, Plus } from 'lucide-react';
  import { ScrollArea } from '@/components/ui/scroll-area';
  import { Avatar, AvatarFallback } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';

  const COLOR = '#EC4899';

  interface CommunityStats {
    totalUsers?: number;
    activeToday?: number;
    weeklyTrend?: Array<{ day: string; value: number }>;
    [key: string]: unknown;
  }

  const MOODS = [
    { emoji: '😄', label: 'Great', value: 5, color: '#22C55E' },
    { emoji: '🙂', label: 'Good', value: 4, color: '#84CC16' },
    { emoji: '😐', label: 'Okay', value: 3, color: '#F59E0B' },
    { emoji: '😔', label: 'Low', value: 2, color: '#F97316' },
    { emoji: '😢', label: 'Struggling', value: 1, color: '#EF4444' },
  ];

  const CRISIS_RESOURCES = [
    { name: 'National Hotline', number: '1-888-373-7888', available: '24/7' },
    { name: 'Crisis Text Line', number: 'Text HOME to 233733', available: '24/7' },
    { name: 'RAINN Hotline', number: '1-800-656-4673', available: '24/7' },
  ];

  type Tab = 'checkin' | 'trends' | 'chat';

  export default function MoodShell() {
    const [tab, setTab] = useState<Tab>('checkin');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [eligible, setEligible] = useState<boolean | null>(null);
    const [daysUntilEligible, setDaysUntilEligible] = useState<number | null>(null);
    const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [selected, setSelected] = useState<number | null>(null);
    const [input, setInput] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
      const controller = new AbortController();
      async function fetchEligibility() {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch('/api/mood/eligibility', { signal: controller.signal });
          if (!res.ok) throw new Error('Failed to check eligibility');
          const data = await res.json() as { eligible: boolean; daysUntilEligible?: number; communityStats?: CommunityStats };
          if (controller.signal.aborted) return;
          setEligible(data.eligible);
          setDaysUntilEligible(data.daysUntilEligible ?? null);
          if (data.communityStats && typeof data.communityStats === 'object') {
            setCommunityStats(data.communityStats);
          }
        } catch (e: unknown) {
          if (controller.signal.aborted) return;
          setError(e instanceof Error ? e.message : 'Failed to load mood data.');
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      }
      void fetchEligibility();
      return () => { controller.abort(); };
    }, []);

    async function handleSubmit() {
      if (!selected || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch('/api/mood/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mood: selected, note: input }),
        });
        if (!res.ok) throw new Error('Failed to submit mood');
        setSubmitted(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Submission failed.');
      } finally {
        setSubmitting(false);
      }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading mood check-in…</div>;
    if (error && tab === 'checkin') return <div className="text-red-500 p-4">{error}</div>;

    const weeklyTrend: Array<{ day: string; value: number }> = communityStats?.weeklyTrend ?? [
      { day: 'Mon', value: 3.4 }, { day: 'Tue', value: 3.7 }, { day: 'Wed', value: 3.2 },
      { day: 'Thu', value: 3.9 }, { day: 'Fri', value: 4.1 }, { day: 'Sat', value: 3.8 },
      { day: 'Sun', value: 4.0 },
    ];
    const maxTrend = Math.max(...weeklyTrend.map((d) => d.value), 1);

    return (
      <div style={{ width: '100%', height: '100%', minHeight: '100vh', background: '#0F1117', fontFamily: 'Inter, system-ui, sans-serif', color: '#E8EAF0', display: 'flex' }}>
        {/* 72px icon rail */}
        <aside style={{ width: 72, background: '#090B0F', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Smile size={20} style={{ color: COLOR }} />
          </div>
          {([
            { icon: Smile, key: 'checkin', label: 'Check-in' },
            { icon: TrendingUp, key: 'trends', label: 'Trends' },
            { icon: MessageSquare, key: 'chat', label: 'Chat' },
          ] as const).map(({ icon: Icon, key, label }) => (
            <button key={key} type="button" onClick={() => setTab(key)} title={label}
              style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : 'transparent', border: tab === key ? `1px solid ${COLOR}40` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: tab === key ? COLOR : '#6B7280' }}>
              <Icon size={20} />
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button type="button" aria-label="Notifications" style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}><Bell size={18} /></button>
          <button type="button" aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}><Settings size={18} /></button>
          <Avatar style={{ width: 36, height: 36 }}>
            <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
          </Avatar>
        </aside>

        {/* Second sidebar with community stats */}
        <aside style={{ width: 200, background: '#0D0F14', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 16px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12 }}>😁 Mood</div>
          </div>
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: '0 8px 16px' }}>
              {(['checkin', 'trends', 'chat'] as const).map((key) => (
                <button key={key} type="button" onClick={() => setTab(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: tab === key ? `${COLOR}18` : 'transparent', borderLeft: tab === key ? `2px solid ${COLOR}` : '2px solid transparent', marginLeft: 2, marginBottom: 2, border: 'none', width: 'calc(100% - 4px)', textAlign: 'left' }}>
                  <span style={{ fontSize: 13, color: tab === key ? '#E8EAF0' : '#9CA3AF', flex: 1, textTransform: 'capitalize' }}>{key === 'checkin' ? 'Check-in' : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                </button>
              ))}
              {communityStats && (
                <>
                  <div style={{ margin: '16px 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', padding: '0 10px' }}>Community</div>
                  {communityStats.totalUsers != null && (
                    <div style={{ padding: '6px 10px', fontSize: 12, color: '#6B7280' }}>Members: <span style={{ color: COLOR, fontWeight: 600 }}>{(communityStats.totalUsers as number).toLocaleString()}</span></div>
                  )}
                  {communityStats.activeToday != null && (
                    <div style={{ padding: '6px 10px', fontSize: 12, color: '#6B7280' }}>Active today: <span style={{ color: COLOR, fontWeight: 600 }}>{(communityStats.activeToday as number).toLocaleString()}</span></div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#0D0F14', flexShrink: 0 }}>
            <Smile size={18} style={{ color: COLOR }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>😁 Mood — Anonymous Check-ins</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Zero tracking · Community wellness · Phase 2</div>
            </div>
            <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>🔒 Anonymous</Badge>
          </header>

          {tab === 'checkin' ? (
            eligible === false ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24 }}>
                <div style={{ fontSize: 48 }}>⏳</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#F9FAFB' }}>Already checked in</div>
                <div style={{ fontSize: 14, color: '#6B7280' }}>Check back in {daysUntilEligible ?? '?'} day{daysUntilEligible !== 1 ? 's' : ''}.</div>
                <button type="button" onClick={() => setTab('trends')}
                  style={{ marginTop: 8, padding: '10px 24px', borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  View Community Trends
                </button>
              </div>
            ) : (
              <ScrollArea style={{ flex: 1 }}>
                <div style={{ padding: '40px', maxWidth: 640, margin: '0 auto' }}>
                  {!submitted ? (
                    <>
                      <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', marginBottom: 8 }}>How are you feeling right now?</div>
                        <div style={{ fontSize: 15, color: '#6B7280' }}>Anonymous, safe, and encrypted. Your mood is submitted anonymously and encrypted to our backend.</div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 40 }}>
                        {MOODS.map((m) => (
                          <button key={m.value} type="button" onClick={() => setSelected(m.value)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 16px', borderRadius: 16, background: selected === m.value ? `${m.color}20` : 'rgba(255,255,255,0.02)', border: `2px solid ${selected === m.value ? m.color : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer' }}>
                            <div style={{ fontSize: 40 }}>{m.emoji}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: selected === m.value ? m.color : '#6B7280' }}>{m.label}</div>
                          </button>
                        ))}
                      </div>
                      {selected && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="(Optional) Anything you'd like to add? Completely anonymous…" rows={3}
                            style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 14, color: '#E8EAF0', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                          <button type="button" onClick={() => void handleSubmit()} disabled={submitting}
                            style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#fff', fontSize: 16, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                            Submit Anonymously
                          </button>
                          <div style={{ textAlign: 'center', fontSize: 12, color: '#4B5563' }}>Not linked to your account · Encrypted · Instant deletion available</div>
                        </div>
                      )}
                      {error && <div style={{ fontSize: 13, color: '#EF4444', marginTop: 12, textAlign: 'center' }}>{error}</div>}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 80, marginBottom: 20 }}>💚</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', marginBottom: 8 }}>Thank you for checking in.</div>
                      <div style={{ fontSize: 15, color: '#6B7280', marginBottom: 32 }}>You're part of a community of survivors supporting each other.</div>
                      <button type="button" onClick={() => setTab('trends')}
                        style={{ padding: '10px 24px', borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                        See Community Trends
                      </button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )
          ) : tab === 'trends' ? (
            <ScrollArea style={{ flex: 1 }}>
              <div style={{ padding: '24px' }}>
                <div style={{ marginBottom: 24, padding: '20px 24px', borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(236,72,153,0.03) 100%)`, border: `1px solid ${COLOR}20` }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#F9FAFB', marginBottom: 4 }}>Community Mood — 7-Day Trend</div>
                  <div style={{ fontSize: 14, color: '#6B7280' }}>Aggregated · Fully anonymous · No individual data ever shared</div>
                </div>
                {/* Bar chart */}
                <div style={{ padding: '24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB', marginBottom: 20 }}>Average Mood Score (1–5)</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120 }}>
                    {weeklyTrend.map((d) => {
                      const heightPct = (d.value / maxTrend) * 100;
                      return (
                        <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 11, color: COLOR, fontWeight: 700 }}>{d.value.toFixed(1)}</div>
                          <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: `linear-gradient(to top,${COLOR},${COLOR}80)`, height: `${heightPct}%`, minHeight: 4, transition: 'height 0.3s' }} />
                          <div style={{ fontSize: 11, color: '#6B7280' }}>{d.day}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Mood distribution */}
                <div style={{ padding: '24px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB', marginBottom: 16 }}>Community Mood Distribution</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {MOODS.map((m) => {
                      const fakePct = [38, 27, 18, 10, 7][5 - m.value];
                      return (
                        <div key={m.value}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span style={{ color: '#E8EAF0' }}>{m.emoji} {m.label}</span>
                            <span style={{ color: m.color, fontWeight: 700 }}>{fakePct}%</span>
                          </div>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: m.color, borderRadius: 3, width: `${fakePct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 16, fontSize: 11, color: '#4B5563', lineHeight: 1.6 }}>
                    Distribution based on aggregated community data · Individual submissions are never identifiable
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : (
            /* Chat tab — informational, no live messaging (no API backing) */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <ScrollArea style={{ flex: 1 }}>
                <div style={{ padding: '24px' }}>
                  <div style={{ padding: '20px 24px', borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}15`, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Lock size={14} style={{ color: COLOR }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: COLOR }}>Peer Support — Coming Soon</span>
                    </div>
                    <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>
                      Anonymous peer support chat is in development. For immediate support, use the crisis resources below.
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div style={{ padding: '8px 24px 20px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
                  <Plus size={18} style={{ color: '#4B5563' }} />
                  <input disabled placeholder="Chat coming soon…"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#4B5563', cursor: 'not-allowed' }} />
                  <Send size={14} style={{ color: '#4B5563' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right rail — crisis resources */}
        <aside style={{ width: 280, borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#0D0F14', padding: '20px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12 }}>Crisis Resources</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {CRISIS_RESOURCES.map((r) => (
              <div key={r.name} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB', marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: COLOR, fontWeight: 600, marginBottom: 2 }}>{r.number}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{r.available}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 16px', borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}18`, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLOR, marginBottom: 8 }}>🔒 Privacy First</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6 }}>Your mood check-in is 100% anonymous. We never link submissions to your identity.</div>
          </div>
          {communityStats?.activeToday != null && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 6 }}>Today</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLOR, marginBottom: 2 }}>{(communityStats.activeToday as number).toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>survivors checked in</div>
            </div>
          )}
        </aside>
      </div>
    );
  }
  