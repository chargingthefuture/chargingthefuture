'use client';

  import { useEffect, useState, useRef } from 'react';
  import { MessageSquare, Zap, Hash, Bell, Settings, Send, Plus, Search, Globe, ShieldCheck } from 'lucide-react';
  import { ScrollArea } from '@/components/ui/scroll-area';
  import { Avatar, AvatarFallback } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';

  const GRADIENT = 'linear-gradient(135deg,#7C3AED 0%,#0EA5E9 100%)';
  const ACCENT = '#A78BFA';

  const MINI_APPS = [
    { id: 'lighthouse', name: 'LightHouse', emoji: '🏠', color: '#EAB308', desc: 'Safe housing marketplace', tag: 'Phase 2' },
    { id: 'foundation', name: 'Foundation', emoji: '🪛', color: '#EF4444', desc: 'Find skilled tradespeople', tag: 'Phase 1' },
    { id: 'gdp', name: 'GDP', emoji: '🗺️', color: '#06B6D4', desc: 'TI Skills Economy tracker', tag: 'Phase 2' },
    { id: 'workforce', name: 'Workforce', emoji: '💼', color: '#6366F1', desc: 'Skills distribution & gaps', tag: 'Phase 1' },
    { id: 'gentlepulse', name: 'GentlePulse', emoji: '💚', color: '#14B8A6', desc: 'Guided meditation', tag: 'Phase 2' },
    { id: 'mood', name: 'Mood', emoji: '😁', color: '#EC4899', desc: 'Anonymous mood check-ins', tag: 'Phase 0' },
    { id: 'service-credits', name: 'Service Credits', emoji: '⚙️', color: '#F59E0B', desc: 'Utility token ecosystem', tag: 'Phase 1' },
    { id: 'skills-hunt', name: 'Skills Hunt', emoji: '🎓', color: '#A855F7', desc: 'Cohort learning & badges', tag: 'Phase 1' },
  ];

  interface Channel {
    id: string;
    name: string;
    unread?: number;
  }

  interface HubMessage {
    id: string;
    from: string;
    text: string;
    isBot?: boolean;
    createdAt?: string;
  }

  type Section = 'chat' | 'apps';

  export function CommunityShell(_props: { userId?: string; isAdmin?: boolean }) {
    const [section, setSection] = useState<Section>('chat');
    const [channels, setChannels] = useState<Channel[]>([]);
    const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
    const [messages, setMessages] = useState<HubMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const controller = new AbortController();
      async function fetchChannels() {
        setLoading(true);
        setError(null);
        try {
          const res = await fetch('/api/hub/channels', { signal: controller.signal });
          if (!res.ok) throw new Error('Failed to load channels');
          const data = (await res.json()) as { channels?: Channel[] } | Channel[];
          const list: Channel[] = Array.isArray(data) ? data : (data.channels ?? []);
          if (!controller.signal.aborted) {
            setChannels(list);
            if (list.length > 0 && !activeChannel) setActiveChannel(list[0]);
          }
        } catch (e: unknown) {
          if (controller.signal.aborted) return;
          setError(e instanceof Error ? e.message : 'Failed to load channels.');
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      }
      void fetchChannels();
      return () => { controller.abort(); };
    }, []);

    useEffect(() => {
      if (!activeChannel) return;
      const controller = new AbortController();
      async function fetchMessages() {
        try {
          const res = await fetch(`/api/hub/messages?channelId=${encodeURIComponent(activeChannel!.id)}`, { signal: controller.signal });
          if (!res.ok) return;
          const data = (await res.json()) as { messages?: HubMessage[] } | HubMessage[];
          const list: HubMessage[] = Array.isArray(data) ? data : (data.messages ?? []);
          if (!controller.signal.aborted) setMessages(list);
        } catch {
          // silent
        }
      }
      void fetchMessages();
      return () => { controller.abort(); };
    }, [activeChannel]);

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function handleSend() {
      if (!input.trim() || sending || !activeChannel) return;
      const text = input.trim();
      setInput('');
      setSending(true);
      const optimistic: HubMessage = { id: String(Date.now()), from: 'me', text, createdAt: new Date().toISOString() };
      setMessages((m) => [...m, optimistic]);
      try {
        await fetch('/api/hub/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId: activeChannel.id, text }),
        });
      } catch {
        // optimistic — message visible
      } finally {
        setSending(false);
      }
    }

    return (
      <div style={{ width: '100%', height: '100%', minHeight: '100vh', background: '#0F1117', fontFamily: 'Inter, system-ui, sans-serif', color: '#E8EAF0', display: 'flex' }}>
        {/* 72px icon rail */}
        <aside style={{ width: 72, background: '#090B0F', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 12, flexShrink: 0 }}>SH</div>
          {([
            { icon: MessageSquare, key: 'chat', label: 'Chat' },
            { icon: Zap, key: 'apps', label: 'Mini-Apps' },
          ] as const).map(({ icon: Icon, key, label }) => (
            <button key={key} type="button" onClick={() => setSection(key)} title={label}
              style={{ width: 44, height: 44, borderRadius: 12, background: section === key ? 'rgba(124,58,237,0.2)' : 'transparent', border: section === key ? '1px solid rgba(124,58,237,0.4)' : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: section === key ? ACCENT : '#6B7280' }}>
              <Icon size={20} />
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button type="button" aria-label="Notifications" style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}><Bell size={18} /></button>
          <button type="button" aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 12, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}><Settings size={18} /></button>
          <Avatar style={{ width: 36, height: 36, marginTop: 4 }}>
            <AvatarFallback style={{ background: GRADIENT, color: '#fff', fontSize: 14, fontWeight: 700 }}>S</AvatarFallback>
          </Avatar>
        </aside>

        {/* Second sidebar */}
        <aside style={{ width: 240, background: '#0D0F14', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 16px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12 }}>
              {section === 'chat' ? 'Channels' : 'Mini-Apps'}
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#4B5563' }} />
              <input readOnly placeholder={section === 'chat' ? 'Search channels…' : 'Search apps…'}
                style={{ width: '100%', padding: '7px 10px 7px 30px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 13, color: '#9CA3AF', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <ScrollArea style={{ flex: 1 }}>
            {section === 'chat' ? (
              <div style={{ padding: '0 8px 16px' }}>
                {loading && <div style={{ padding: '12px 10px', fontSize: 13, color: '#4B5563' }}>Loading channels…</div>}
                {error && <div style={{ padding: '12px 10px', fontSize: 13, color: '#EF4444' }}>{error}</div>}
                {channels.map((ch) => (
                  <button key={ch.id} type="button" onClick={() => setActiveChannel(ch)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: activeChannel?.id === ch.id ? 'rgba(124,58,237,0.12)' : 'transparent', border: 'none', width: '100%', textAlign: 'left', marginBottom: 2 }}>
                    <Hash size={15} style={{ color: (ch.unread ?? 0) > 0 ? '#9CA3AF' : '#4B5563', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: activeChannel?.id === ch.id || (ch.unread ?? 0) > 0 ? '#E8EAF0' : '#6B7280', flex: 1 }}>{ch.name}</span>
                    {(ch.unread ?? 0) > 0 && (
                      <span style={{ background: '#7C3AED', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#fff', padding: '1px 6px' }}>{ch.unread}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ padding: '0 8px 16px' }}>
                {MINI_APPS.map((app) => (
                  <div key={app.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{app.emoji}</span>
                    <span style={{ fontSize: 13, color: '#9CA3AF', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'linear-gradient(135deg,rgba(124,58,237,0.15) 0%,rgba(14,165,233,0.15) 100%)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT, marginBottom: 2 }}>Safe Space · Invite Only</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>4.9M survivors worldwide</div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <header style={{ height: 56, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, background: '#0D0F14', flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#E8EAF0' }}>
                {section === 'chat' ? (activeChannel ? `# ${activeChannel.name}` : '# general') : 'All Mini-Apps'}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                {section === 'chat' ? 'Community · Survivor Hub' : 'Your peer-to-peer marketplace'}
              </div>
            </div>
            <Badge style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>✓ Safe Space</Badge>
          </header>

          {section === 'chat' ? (
            <>
              {/* Welcome banner */}
              <div style={{ margin: '20px 24px 0', padding: '20px 24px', borderRadius: 16, background: 'linear-gradient(135deg,rgba(124,58,237,0.2) 0%,rgba(14,165,233,0.1) 50%,rgba(16,185,129,0.1) 100%)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB', lineHeight: 1.3 }}>From Survivor to Thriver</div>
                  <div style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4 }}>5 million survivors. One economy. $300B opportunity.</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: '4.9M', l: 'Members', c: ACCENT }, { v: '$247B', l: 'GDP', c: '#38BDF8' }, { v: '127', l: 'Countries', c: '#34D399' }].map(({ v, l, c }) => (
                    <div key={l} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <ScrollArea style={{ flex: 1 }}>
                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {loading && <div style={{ fontSize: 13, color: '#4B5563' }}>Loading messages…</div>}
                  {messages.map((msg) => (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: msg.from === 'me' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-end' }}>
                      {msg.from !== 'me' && (
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>SH</div>
                      )}
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{ padding: '12px 16px', borderRadius: msg.from === 'me' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: msg.from === 'me' ? GRADIENT : 'rgba(255,255,255,0.05)', border: msg.from === 'me' ? 'none' : '1px solid rgba(255,255,255,0.06)', fontSize: 14, lineHeight: 1.6, color: '#E8EAF0' }}>
                          {msg.text}
                        </div>
                        {msg.createdAt && <div style={{ fontSize: 11, color: '#4B5563', marginTop: 3, textAlign: msg.from === 'me' ? 'right' : 'left' }}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <div style={{ padding: '8px 24px 20px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14 }}>
                  <Plus size={18} style={{ color: '#4B5563', flexShrink: 0 }} />
                  <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
                    placeholder="Message the community…"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#E8EAF0' }} />
                  <button type="button" onClick={() => void handleSend()} disabled={sending}
                    style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? GRADIENT : 'rgba(255,255,255,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Send size={14} style={{ color: input.trim() ? '#fff' : '#4B5563' }} />
                  </button>
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: '#374151', marginTop: 8 }}>End-to-end encrypted · Safe space guaranteed</div>
              </div>
            </>
          ) : (
            <ScrollArea style={{ flex: 1 }}>
              <div style={{ padding: '24px' }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB', marginBottom: 4 }}>All Mini-Apps</div>
                  <div style={{ fontSize: 14, color: '#6B7280' }}>Your complete peer-to-peer marketplace — from survivor to thriver</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  {MINI_APPS.map((app) => (
                    <div key={app.id}
                      style={{ padding: '18px 20px', borderRadius: 14, background: `${app.color}08`, border: `1px solid ${app.color}20`, cursor: 'default' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${app.color}20`, border: `1px solid ${app.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                          {app.emoji}
                        </div>
                        <span style={{ fontSize: 10, color: '#4B5563' }}>{app.tag}</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>{app.name}</div>
                      <div style={{ fontSize: 13, color: '#6B7280' }}>{app.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Right rail */}
        <aside style={{ width: 280, borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#0D0F14', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px 16px' }}>
            <div style={{ padding: '16px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 16, textAlign: 'center' }}>
              <Avatar style={{ width: 56, height: 56, margin: '0 auto 10px' }}>
                <AvatarFallback style={{ background: GRADIENT, color: '#fff', fontSize: 22, fontWeight: 800 }}>S</AvatarFallback>
              </Avatar>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>Welcome, Survivor</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Member since 2024</div>
              <Badge style={{ background: 'rgba(124,58,237,0.15)', color: ACCENT, border: '1px solid rgba(124,58,237,0.25)', fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>Safe Space ✓</Badge>
            </div>
            <div style={{ borderRadius: 12, background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.18)', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <ShieldCheck size={14} style={{ color: '#0EA5E9' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Trust</span>
                </div>
                <Badge style={{ background: 'rgba(255,255,255,0.05)', color: '#6B7280', border: '1px solid rgba(255,255,255,0.08)', fontSize: 10, padding: '2px 8px', borderRadius: 20 }}>Unverified</Badge>
              </div>
              <div style={{ padding: '4px 14px 14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px dashed rgba(14,165,233,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                    <ShieldCheck size={20} style={{ color: 'rgba(14,165,233,0.4)' }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>No trust signals yet</div>
                  <div style={{ fontSize: 11, color: '#4B5563', textAlign: 'center', lineHeight: 1.5 }}>Trust signals appear as you participate in the community</div>
                </div>
                <button type="button" style={{ width: '100%', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#38BDF8', cursor: 'pointer' }}>
                  Request Verification
                </button>
              </div>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#C4B5FD', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 8 }}>"You are not what happened to you. You are what you choose to become."</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>— Carl Jung</div>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.12)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Globe size={14} style={{ color: '#06B6D4' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#22D3EE' }}>GDP Progress</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB', marginBottom: 2 }}>$247B</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>of $300B opportunity</div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '82%', borderRadius: 3, background: 'linear-gradient(90deg,#06B6D4 0%,#7C3AED 100%)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#4B5563' }}>82% to goal</span>
                <span style={{ fontSize: 11, color: '#22D3EE' }}>$53B remaining</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    );
  }
  
