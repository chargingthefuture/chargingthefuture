'use client';

  import { useEffect, useState } from 'react';
  import { Heart, Play, Pause, Bell, Settings, MessageSquare, Send, Plus, ArrowUpRight, Clock, Volume2 } from 'lucide-react';
  import { ScrollArea } from '@/components/ui/scroll-area';
  import { Avatar, AvatarFallback } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';

  const COLOR = '#14B8A6';
  const BG = '#0A0F0E';

  interface LibraryItem {
    id: string;
    title: string;
    category?: string;
    durationMinutes?: number;
    level?: string;
    plays?: number;
    rating?: number;
    emoji?: string;
    description?: string;
  }

  interface SupportMessage {
    id: string;
    from: 'hub' | 'user';
    text: string;
    action?: string;
  }

  const CATEGORIES = ['All', 'Breathing', 'Mindfulness', 'Grounding', 'Sleep', 'Morning', 'Affirmations'];

  type Tab = 'sessions' | 'playing' | 'chat';

  export function GentlePulseShell(_props: { userId?: string; isAdmin?: boolean }) {
    const [tab, setTab] = useState<Tab>('sessions');
    const [category, setCategory] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [playing, setPlaying] = useState<LibraryItem | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [progress] = useState(40);
    const [msgs, setMsgs] = useState<SupportMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
      const controller = new AbortController();
      async function fetchLibrary() {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch('/api/gentlepulse/library', { signal: controller.signal });
          if (!res.ok) throw new Error('Failed to load library');
          const data = (await res.json()) as { items?: LibraryItem[] } | LibraryItem[];
          const items = Array.isArray(data) ? data : (data.items ?? []);
          if (!controller.signal.aborted) setLibrary(items);
        } catch (e: unknown) {
          if (controller.signal.aborted) return;
          setError(e instanceof Error ? e.message : 'Failed to load GentlePulse library.');
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      }
      void fetchLibrary();
      return () => { controller.abort(); };
    }, []);

    async function sendMessage() {
      if (!input.trim() || sending) return;
      const userMsg: SupportMessage = { id: String(Date.now()), from: 'user', text: input.trim() };
      setMsgs((m) => [...m, userMsg]);
      setInput('');
      setSending(true);
      try {
        const res = await fetch('/api/gentlepulse/support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMsg.text }),
        });
        if (res.ok) {
          const data = (await res.json()) as { reply?: string; message?: string };
          const reply = data.reply ?? data.message;
          if (reply) {
            setMsgs((m) => [...m, { id: String(Date.now() + 1), from: 'hub', text: reply }]);
          }
        }
      } catch {
        // silent — message still visible to user
      } finally {
        setSending(false);
      }
    }

    const filtered = category === 'All' ? library : library.filter((s) => s.category === category);

    return (
      <div style={{ width: '100%', height: '100%', minHeight: '100vh', background: BG, fontFamily: 'Inter, system-ui, sans-serif', color: '#E8EAF0', display: 'flex' }}>
        {/* 72px icon rail */}
        <aside style={{ width: 72, background: '#060A09', borderRight: `1px solid ${COLOR}18`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Heart size={20} style={{ color: COLOR }} />
          </div>
          {([
            { icon: Heart, key: 'sessions', label: 'Sessions' },
            { icon: Play, key: 'playing', label: 'Now Playing' },
            { icon: MessageSquare, key: 'chat', label: 'Support' },
          ] as const).map(({ icon: Icon, key, label }) => (
            <button key={key} type="button" onClick={() => setTab(key)} title={label}
              style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : 'transparent', border: tab === key ? `1px solid ${COLOR}40` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: tab === key ? COLOR : '#4B5563' }}>
              <Icon size={20} />
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button type="button" aria-label="Notifications" style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#4B5563' }}><Bell size={18} /></button>
          <button type="button" aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#4B5563' }}><Settings size={18} /></button>
          <Avatar style={{ width: 36, height: 36 }}>
            <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
          </Avatar>
        </aside>

        {/* Category sidebar */}
        <aside style={{ width: 240, background: '#080D0C', borderRight: `1px solid ${COLOR}10`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 16px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 12 }}>💚 GentlePulse</div>
          </div>
          <ScrollArea style={{ flex: 1 }}>
            <div style={{ padding: '0 8px 16px' }}>
              {CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: category === c ? `${COLOR}18` : 'transparent', borderLeft: category === c ? `2px solid ${COLOR}` : '2px solid transparent', marginLeft: 2, marginBottom: 2, border: 'none', width: 'calc(100% - 4px)', textAlign: 'left' }}>
                  <span style={{ fontSize: 13, color: category === c ? '#E8EAF0' : '#6B7280', flex: 1 }}>{c}</span>
                </button>
              ))}
              <div style={{ margin: '16px 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', padding: '0 10px' }}>Your Progress</div>
              <div style={{ padding: '12px', margin: '0 8px 8px', borderRadius: 10, background: `${COLOR}08`, border: `1px solid ${COLOR}15` }}>
                <div style={{ fontSize: 11, color: '#4B5563' }}>Sessions available: <span style={{ color: COLOR, fontWeight: 700 }}>{library.length}</span></div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header style={{ height: 56, borderBottom: `1px solid ${COLOR}15`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#080D0C', flexShrink: 0 }}>
            <Heart size={18} style={{ color: COLOR }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>💚 GentlePulse — Guided Meditation</div>
              <div style={{ fontSize: 12, color: '#4B5563' }}>Trauma-informed · Expert-designed · Safe sanctuary</div>
            </div>
            <Badge style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}35`, fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>✓ Trauma-Informed</Badge>
          </header>

          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', fontSize: 14 }}>Loading sessions…</div>
          ) : error ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', fontSize: 14, padding: 24 }}>{error}</div>
          ) : tab === 'sessions' ? (
            <ScrollArea style={{ flex: 1 }}>
              <div style={{ padding: '24px' }}>
                <div style={{ marginBottom: 20, padding: '20px 24px', borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(20,184,166,0.03) 100%)`, border: `1px solid ${COLOR}20` }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#F9FAFB', marginBottom: 4 }}>Your Safe Space to Breathe</div>
                  <div style={{ fontSize: 14, color: '#6B7280' }}>{library.length} sessions · Trauma-informed therapists · Zero triggers · Always free</div>
                </div>
                {filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#4B5563', padding: '48px 0' }}>
                    <Heart size={48} style={{ color: COLOR, opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#6B7280' }}>No sessions in this category yet</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                    {filtered.map((s) => (
                      <div key={s.id} onClick={() => { setPlaying(s); setTab('playing'); }}
                        style={{ padding: '20px', borderRadius: 16, background: `rgba(20,184,166,0.04)`, border: `1px solid ${COLOR}20`, cursor: 'pointer' }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>{s.emoji ?? '🌿'}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>{s.title}</div>
                        {s.description && <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 12, lineHeight: 1.5 }}>{s.description}</div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                          {s.durationMinutes != null && <span><Clock size={11} style={{ display: 'inline' }} /> {s.durationMinutes} min</span>}
                          {s.rating != null && <span>⭐ {s.rating}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                          {s.category && <Badge style={{ background: `${COLOR}10`, color: COLOR, border: `1px solid ${COLOR}25`, fontSize: 10 }}>{s.category}</Badge>}
                          {s.level && <Badge style={{ background: 'rgba(255,255,255,0.04)', color: '#6B7280', border: '1px solid rgba(255,255,255,0.06)', fontSize: 10 }}>{s.level}</Badge>}
                        </div>
                        <button type="button"
                          style={{ width: '100%', padding: '8px', borderRadius: 8, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <Play size={13} /> Start
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : tab === 'playing' ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {playing ? (
                <div style={{ maxWidth: 480, width: '100%', padding: '40px', textAlign: 'center' }}>
                  <div style={{ fontSize: 80, marginBottom: 20 }}>{playing.emoji ?? '🌿'}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#F9FAFB', marginBottom: 8 }}>{playing.title}</div>
                  {playing.description && <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 32, lineHeight: 1.7 }}>{playing.description}</div>}
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', background: `linear-gradient(to right,${COLOR},${COLOR}88)`, borderRadius: 3, width: `${progress}%`, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4B5563' }}>
                      <span>2:00</span>
                      <span>{playing.durationMinutes != null ? `${playing.durationMinutes} min` : ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
                    <button type="button" aria-label="Volume"
                      style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}>
                      <Volume2 size={20} />
                    </button>
                    <button type="button" aria-label={isPaused ? 'Play' : 'Pause'} onClick={() => setIsPaused(!isPaused)}
                      style={{ width: 72, height: 72, borderRadius: '50%', background: COLOR, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      {isPaused ? <Play size={28} style={{ color: BG }} /> : <Pause size={28} style={{ color: BG }} />}
                    </button>
                    <button type="button" aria-label="Close" onClick={() => { setPlaying(null); setTab('sessions'); }}
                      style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', fontSize: 14 }}>
                      ✕
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: `${COLOR}80` }}>You are safe. You are enough. You are healing. 💚</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#4B5563' }}>
                  <Heart size={48} style={{ color: COLOR, opacity: 0.3, marginBottom: 12 }} />
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#6B7280' }}>Select a session to begin</div>
                  <button type="button" onClick={() => setTab('sessions')}
                    style={{ marginTop: 16, padding: '10px 24px', borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Browse Sessions
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Chat / Support tab */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <ScrollArea style={{ flex: 1 }}>
                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {msgs.length === 0 && (
                    <div style={{ padding: '20px 24px', borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}15`, fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>
                      GentlePulse support is here for you. Tell us how you're feeling or ask for a session recommendation.
                    </div>
                  )}
                  {msgs.map((msg) => (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: msg.from === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-end' }}>
                      {msg.from === 'hub' && (
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Heart size={14} style={{ color: COLOR }} />
                        </div>
                      )}
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{ padding: '12px 16px', borderRadius: msg.from === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: msg.from === 'user' ? COLOR : 'rgba(255,255,255,0.04)', border: msg.from === 'user' ? 'none' : `1px solid ${COLOR}15`, fontSize: 14, lineHeight: 1.6, color: msg.from === 'user' ? BG : '#E8EAF0' }}>
                          {msg.text}
                        </div>
                        {msg.action && (
                          <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '7px 14px', borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {msg.action} <ArrowUpRight size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div style={{ padding: '8px 24px 20px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: `rgba(20,184,166,0.04)`, border: `1px solid ${COLOR}20`, borderRadius: 14 }}>
                  <Plus size={18} style={{ color: '#4B5563' }} />
                  <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void sendMessage()}
                    placeholder="How can GentlePulse help you right now?"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#E8EAF0' }} />
                  <button type="button" onClick={() => void sendMessage()} disabled={sending}
                    style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : 'rgba(255,255,255,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Send size={14} style={{ color: input.trim() ? BG : '#4B5563' }} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside style={{ width: 280, borderLeft: `1px solid ${COLOR}10`, background: '#080D0C', padding: '20px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4B5563', textTransform: 'uppercase', marginBottom: 12 }}>Popular Now</div>
          {library.slice(0, 4).map((s) => (
            <div key={s.id} onClick={() => { setPlaying(s); setTab('playing'); }}
              style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px', borderRadius: 10, background: `${COLOR}06`, border: `1px solid ${COLOR}15`, marginBottom: 8, cursor: 'pointer' }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{s.emoji ?? '🌿'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EAF0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                {s.durationMinutes != null && <div style={{ fontSize: 11, color: '#4B5563' }}>{s.durationMinutes} min</div>}
              </div>
              <Play size={16} style={{ color: COLOR, flexShrink: 0 }} />
            </div>
          ))}
          {library.length === 0 && (
            <div style={{ fontSize: 13, color: '#4B5563', padding: '12px 0' }}>Sessions loading…</div>
          )}
          <div style={{ marginTop: 16, padding: '16px', borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}18` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLOR, marginBottom: 8 }}>Today's Affirmation</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.7, fontStyle: 'italic' }}>"You did not choose what happened to you. You DO choose what happens next."</div>
          </div>
        </aside>
      </div>
    );
  }
  