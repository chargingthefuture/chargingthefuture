
'use client';

import { useEffect, useState } from 'react';

interface CommunityStats {
  totalUsers: number;
  activeToday: number;
  [key: string]: number; // Allow for additional numeric stats
}
import { Smile, TrendingUp, MessageSquare, Bell, Settings, Lock, ArrowUpRight, Plus, Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const COLOR = '#EC4899';
const MOODS = [
  { emoji: '😄', label: 'Great', value: 5, color: '#22C55E' },
  { emoji: '🙂', label: 'Good', value: 4, color: '#84CC16' },
  { emoji: '😐', label: 'Okay', value: 3, color: '#F59E0B' },
  { emoji: '😔', label: 'Low', value: 2, color: '#F97316' },
  { emoji: '😢', label: 'Struggling', value: 1, color: '#EF4444' },
];

// LighthouseShell pattern: use client, loading/error/data state, API fetch, submission, empty/ineligible state
export default function MoodShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [daysUntilEligible, setDaysUntilEligible] = useState<number | null>(null);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchEligibility() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/mood/eligibility");
        if (!res.ok) throw new Error("Failed to check eligibility");
        const data = await res.json();
        setEligible(data.eligible);
        setDaysUntilEligible(data.daysUntilEligible ?? null);
        // Defensive: only assign if object and has at least totalUsers or activeToday
        if (data.communityStats && typeof data.communityStats === 'object') {
          setCommunityStats(data.communityStats as CommunityStats);
        } else {
          setCommunityStats(null);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load mood data.");
      } finally {
        setLoading(false);
      }
    }
    fetchEligibility();
  }, []);

  async function handleSubmit() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/mood/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: selected, note: input }),
      });
      if (!res.ok) throw new Error("Failed to submit mood");
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading mood check-in…</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  if (eligible === false) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Mood Check-in</h2>
        <p className="mb-4">You've already submitted your mood recently. Check back in {daysUntilEligible ?? '?'} days.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '100vh', background: '#0F1117', fontFamily: 'Inter, system-ui, sans-serif', color: '#E8EAF0', display: 'flex' }}>
      {/* Sidebar and stats (preserved from mockup) */}
      <aside style={{ width: 72, background: '#090B0F', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Smile size={20} style={{ color: COLOR }} />
        </div>
        {[{ icon: Smile, key: 'checkin', label: 'Check-in' }, { icon: TrendingUp, key: 'trends', label: 'Trends' }, { icon: MessageSquare, key: 'chat', label: 'Chat' }].map(({ icon: Icon, key, label }) => (
          <button key={key} aria-label={label} style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}><Icon size={20} /></button>
        ))}
        <div style={{ flex: 1 }} />
        <button aria-label="Notifications" style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}><Bell size={18} /></button>
        <button aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}><Settings size={18} /></button>
        <Avatar style={{ width: 36, height: 36 }}>
          <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
        </Avatar>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#0D0F14', flexShrink: 0 }}>
          <Smile size={18} style={{ color: COLOR }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>😁 Mood — Anonymous Check-ins</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Zero tracking · Community wellness · Phase 2</div>
          </div>
          <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>🔒 Anonymous</Badge>
        </header>

        <ScrollArea style={{ flex: 1 }}>
          <div style={{ padding: '40px', maxWidth: 640, margin: '0 auto' }}>
            {!submitted ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', marginBottom: 8 }}>How are you feeling right now?</div>
                  <div style={{ fontSize: 15, color: '#6B7280' }}>Anonymous, safe, and encrypted. Your mood is submitted anonymously and encrypted to our backend (<span style={{ fontFamily: 'monospace' }}>/api/mood/submissions</span>).</div>
                </div>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 40 }}>
                  {MOODS.map((m) => (
                    <button key={m.value} onClick={() => setSelected(m.value)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 16px', borderRadius: 16, background: selected === m.value ? `${m.color}20` : 'rgba(255,255,255,0.02)', border: `2px solid ${selected === m.value ? m.color : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ fontSize: 40 }}>{m.emoji}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: selected === m.value ? m.color : '#6B7280' }}>{m.label}</div>
                    </button>
                  ))}
                </div>
                {selected && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="(Optional) Anything you'd like to add? Completely anonymous…" rows={3} style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 14, color: '#E8EAF0', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                    <button onClick={handleSubmit} disabled={submitting} style={{ padding: '14px', borderRadius: 12, background: COLOR, border: 'none', color: '#fff', fontSize: 16, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>Submit Anonymously</button>
                    <div style={{ textAlign: 'center', fontSize: 12, color: '#4B5563' }}>Not linked to your account · Encrypted · Instant deletion available</div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 80, marginBottom: 20 }}>💚</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#F9FAFB', marginBottom: 8 }}>Thank you for checking in.</div>
                <div style={{ fontSize: 15, color: '#6B7280', marginBottom: 32 }}>You're part of a community of survivors supporting each other.</div>
                {/* Optionally show resources or stats here */}
                {communityStats && Object.keys(communityStats).length > 0 && (
                  <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 600, color: '#F9FAFB', fontSize: 16, marginBottom: 4 }}>Community Stats</div>
                    {Object.entries(communityStats).map(([key, value]) => (
                      <div key={key} style={{ color: '#A1A1AA', fontSize: 14 }}>
                        <span style={{ fontWeight: 500 }}>{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
