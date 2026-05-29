'use client';

  import { useCallback, useEffect, useState } from 'react';
  import {
    Home, BookOpen, TrendingUp, Users, Trophy, Coins,
    Plus, CheckCircle, DollarSign, Target, Search, Clock,
    User, BookMarked, ChevronRight, BarChart2, Bell, Settings,
  } from 'lucide-react';
  import { ScrollArea } from '@/components/ui/scroll-area';
  import { Badge } from '@/components/ui/badge';

  const GREEN = '#22C55E';
  const BG = '#0F1117';
  const SURFACE = '#161B27';
  const BORDER = '#1E2A3A';
  const MUTED = '#4B5563';
  const TEXT = '#E2E8F0';
  const SUBTLE = '#94A3B8';

  const TRACK_COLORS: Record<string, string> = {
    Tech: '#3B82F6',
    Finance: '#F59E0B',
    Wellness: '#14B8A6',
    'Life Skills': '#A855F7',
  };

  const STATUS_COLOR: Record<string, string> = {
    open: GREEN,
    active: '#3B82F6',
    full: MUTED,
    completed: '#A855F7',
    cancelled: '#EF4444',
    draft: MUTED,
  };

  const TRACKS = ['All Tracks', 'Tech', 'Finance', 'Wellness', 'Life Skills'];

  interface Cohort {
    id: string;
    title: string;
    track?: string;
    trainerName?: string;
    seatsAvailable?: number;
    seats?: number;
    requiredCredits?: number;
    status?: string;
    milestoneCount?: number;
    tags?: string[];
    startDate?: string;
  }

  interface Milestone {
    id: string;
    name?: string;
    percentRelease?: number;
    requiredTask?: string;
    status?: string;
  }

  interface Enrollment {
    cohortId: string;
    title: string;
    track?: string;
    trainerName?: string;
    milestones: Milestone[];
    completedCount: number;
  }

  interface Wallet {
    availableBalance?: number;
    walletEscrowBalance?: number;
    levelupEscrowedBalance?: number;
  }

  interface PendingValidation {
    milestoneId: string;
    learnerName?: string;
    task?: string;
  }

  type NavKey = 'browse' | 'progress' | 'trainers' | 'achievements' | 'wallet';

  const NAV_ITEMS: { icon: React.ElementType; label: string; key: NavKey }[] = [
    { icon: BookOpen, label: 'Browse Cohorts', key: 'browse' },
    { icon: TrendingUp, label: 'My Progress', key: 'progress' },
    { icon: Users, label: 'My Trainers', key: 'trainers' },
    { icon: Trophy, label: 'Achievements', key: 'achievements' },
    { icon: Coins, label: 'Credits Wallet', key: 'wallet' },
  ];

  function idempotencyKey() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  export function LevelupShell({ isAdmin = false }: { userId?: string; isAdmin?: boolean; query?: { track?: string; status?: string; startDate?: string; cohortId?: string } }) {
    const [nav, setNav] = useState<NavKey>('browse');
    const [track, setTrack] = useState('All Tracks');
    const [search, setSearch] = useState('');
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [pendingValidations, setPendingValidations] = useState<PendingValidation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [enrollingId, setEnrollingId] = useState<string | null>(null);
    const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
    const [enrollError, setEnrollError] = useState<string | null>(null);

    const fetchCohorts = useCallback(async (signal: AbortSignal) => {
      const params = new URLSearchParams();
      if (track !== 'All Tracks') params.set('track', track);
      const res = await fetch(`/api/levelup/cohorts?${params}`, { signal });
      if (!res.ok) throw new Error('Failed to load cohorts');
      const data = await res.json() as { cohorts?: Cohort[] } | Cohort[];
      return Array.isArray(data) ? data : (data.cohorts ?? []);
    }, [track]);

    useEffect(() => {
      const controller = new AbortController();
      async function load() {
        setLoading(true);
        setError(null);
        try {
          const [cohortsData, walletRes] = await Promise.all([
            fetchCohorts(controller.signal),
            fetch('/api/service-credits/wallet', { signal: controller.signal }),
          ]);
          if (controller.signal.aborted) return;
          setCohorts(cohortsData);
          if (walletRes.ok) {
            const wd = await walletRes.json() as { wallet?: Wallet } | Wallet;
            setWallet(('wallet' in wd && wd.wallet) ? wd.wallet as Wallet : wd as Wallet);
          }
        } catch (e: unknown) {
          if (controller.signal.aborted) return;
          setError(e instanceof Error ? e.message : 'Failed to load LevelUp.');
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      }
      void load();
      return () => { controller.abort(); };
    }, [fetchCohorts]);

    async function handleEnroll(cohort: Cohort) {
      if (enrollingId || enrolledIds.has(cohort.id)) return;
      setEnrollingId(cohort.id);
      setEnrollError(null);
      try {
        const res = await fetch('/api/levelup/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cohortId: cohort.id,
            idempotencyKey: idempotencyKey(),
            depositCredits: cohort.requiredCredits ?? 0,
          }),
        });
        if (!res.ok) {
          const d = await res.json() as { error?: string; message?: string };
          throw new Error(d.error ?? d.message ?? 'Enrollment failed');
        }
        setEnrolledIds((prev) => new Set([...prev, cohort.id]));
        setEnrollments((prev) => [...prev, {
          cohortId: cohort.id,
          title: cohort.title,
          track: cohort.track,
          trainerName: cohort.trainerName,
          milestones: [],
          completedCount: 0,
        }]);
      } catch (e: unknown) {
        setEnrollError(e instanceof Error ? e.message : 'Enrollment failed.');
      } finally {
        setEnrollingId(null);
      }
    }

    async function handleValidateMilestone(milestoneId: string) {
      try {
        await fetch(`/api/levelup/milestones/${milestoneId}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        setPendingValidations((prev) => prev.filter((v) => v.milestoneId !== milestoneId));
      } catch {
        // silent — optimistic remove done
      }
    }

    const filtered = cohorts.filter((c) => {
      const matchTrack = track === 'All Tracks' || c.track === track;
      const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
      return matchTrack && matchSearch;
    });

    const balance = wallet?.availableBalance ?? 0;
    const escrow = wallet?.levelupEscrowedBalance ?? wallet?.walletEscrowBalance ?? 0;

    const openCount = cohorts.filter((c) => c.status === 'open').length;

    return (
      <div style={{ display: 'flex', height: '100vh', background: BG, fontFamily: "Inter, system-ui, sans-serif", color: TEXT, overflow: 'hidden' }}>

        {/* Sidebar — 220px */}
        <aside style={{ width: 220, background: SURFACE, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={15} color="#000" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>LevelUp</span>
            </div>
            <div style={{ fontSize: 11, color: SUBTLE }}>Training Cohort Marketplace</div>
          </div>

          {/* Nav */}
          <nav style={{ padding: '12px 8px', flex: 1 }}>
            {NAV_ITEMS.map(({ icon: Icon, label, key }) => (
              <button key={key} type="button" onClick={() => setNav(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer', background: nav === key ? `${GREEN}18` : 'transparent', color: nav === key ? GREEN : SUBTLE, fontSize: 13, fontWeight: nav === key ? 600 : 400, borderLeft: nav === key ? `3px solid ${GREEN}` : '3px solid transparent', border: 'none', width: '100%', textAlign: 'left' }}>
                <Icon size={15} />
                {label}
              </button>
            ))}

            {isAdmin && (
              <>
                <div style={{ marginTop: 24, padding: '0 10px 8px', fontSize: 11, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Trainer Tools</div>
                {[
                  { icon: Plus, label: 'Create Cohort' },
                  { icon: CheckCircle, label: 'Validate Milestones' },
                  { icon: DollarSign, label: 'Payout History' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer', color: SUBTLE, fontSize: 13 }}>
                    <Icon size={15} />
                    {label}
                  </div>
                ))}
              </>
            )}
          </nav>

          {/* Wallet badge */}
          <div style={{ margin: '0 12px 16px', padding: '12px', background: `${GREEN}10`, borderRadius: 10, border: `1px solid ${GREEN}30` }}>
            <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 4 }}>My Credit Balance</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: GREEN }}>{balance.toLocaleString()} SC</div>
            {escrow > 0 && <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>{escrow} SC in escrow</div>}
          </div>
        </aside>

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT }}>
                  {nav === 'browse' ? 'Browse Cohorts' : nav === 'progress' ? 'My Progress' : nav === 'wallet' ? 'Credits Wallet' : nav === 'achievements' ? 'Achievements' : 'My Trainers'}
                </h1>
                <div style={{ fontSize: 13, color: SUBTLE, marginTop: 4 }}>
                  {nav === 'browse' ? 'Enroll in a training program and grow your skills' : 'Your LevelUp journey'}
                </div>
              </div>
              {nav === 'browse' && (
                <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', color: SUBTLE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: isAdmin ? 'pointer' : 'not-allowed', opacity: isAdmin ? 1 : 0.5 }}>
                  <Plus size={14} />
                  Create Cohort
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: SUBTLE, fontSize: 14 }}>Loading…</div>
            ) : error ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#EF4444', fontSize: 14 }}>{error}</div>
            ) : nav === 'browse' ? (
              <>
                {/* Stats bar */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: 'Open Cohorts', value: String(openCount), icon: BookOpen, color: GREEN },
                    { label: 'Enrolled', value: String(enrollments.length), icon: Users, color: '#3B82F6' },
                    { label: 'My Balance', value: `${balance.toLocaleString()} SC`, icon: Coins, color: '#A855F7' },
                    { label: 'In Escrow', value: `${escrow.toLocaleString()} SC`, icon: CheckCircle, color: '#F59E0B' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} style={{ flex: 1, background: SURFACE, borderRadius: 10, padding: '14px 16px', border: `1px solid ${BORDER}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Icon size={14} color={color} />
                        <span style={{ fontSize: 12, color: SUBTLE }}>{label}</span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                  {TRACKS.map((t) => (
                    <button key={t} type="button" onClick={() => setTrack(t)}
                      style={{ padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: track === t ? GREEN : BORDER, color: track === t ? '#000' : SUBTLE }}>
                      {t}
                    </button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 12px' }}>
                    <Search size={13} color={MUTED} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cohorts…"
                      style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: TEXT, width: 140 }} />
                  </div>
                </div>

                {enrollError && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 13, color: '#EF4444' }}>
                    {enrollError}
                  </div>
                )}

                {/* Cohort grid */}
                {filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: SUBTLE }}>
                    <BookOpen size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
                    <div style={{ fontSize: 16, fontWeight: 600 }}>No cohorts found</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Try a different track or search term</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                    {filtered.map((cohort) => {
                      const trackColor = TRACK_COLORS[cohort.track ?? ''] ?? GREEN;
                      const statusKey = cohort.status ?? 'open';
                      const isFull = statusKey === 'full' || cohort.seatsAvailable === 0;
                      const isEnrolled = enrolledIds.has(cohort.id);
                      const isEnrolling = enrollingId === cohort.id;
                      return (
                        <div key={cohort.id}
                          style={{ background: SURFACE, borderRadius: 12, padding: '16px', border: `1px solid ${BORDER}`, cursor: 'default', opacity: isFull ? 0.7 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            {cohort.track && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: trackColor, background: `${trackColor}18`, padding: '3px 8px', borderRadius: 20 }}>{cohort.track}</span>
                            )}
                            <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR[statusKey] ?? GREEN, background: `${STATUS_COLOR[statusKey] ?? GREEN}15`, padding: '3px 8px', borderRadius: 20 }}>
                              {isFull ? 'Full' : statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
                            </span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8, lineHeight: 1.4 }}>{cohort.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: SUBTLE, marginBottom: 12 }}>
                            <User size={12} />
                            {cohort.trainerName ?? 'Trainer TBD'}
                            {cohort.milestoneCount != null && (
                              <><span style={{ color: MUTED }}>·</span>{cohort.milestoneCount} milestones</>
                            )}
                          </div>
                          {(cohort.tags ?? []).length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                              {(cohort.tags ?? []).map((tag) => (
                                <span key={tag} style={{ fontSize: 10, color: MUTED, background: BORDER, padding: '2px 8px', borderRadius: 10 }}>{tag}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                            <div>
                              <div style={{ fontSize: 11, color: SUBTLE }}>Seats</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: isFull ? MUTED : TEXT }}>
                                {isFull ? 'Full' : cohort.seatsAvailable != null ? `${cohort.seatsAvailable} left` : '—'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: SUBTLE }}>Cost</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: GREEN }}>{cohort.requiredCredits ?? '—'} SC</div>
                            </div>
                            <button type="button"
                              onClick={() => !isEnrolled && !isFull && void handleEnroll(cohort)}
                              disabled={isEnrolling || isEnrolled || isFull}
                              style={{ background: isEnrolled ? `${GREEN}30` : isFull ? BORDER : GREEN, color: isEnrolled ? GREEN : isFull ? MUTED : '#000', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: isEnrolled || isFull ? 'default' : 'pointer', opacity: isEnrolling ? 0.6 : 1 }}>
                              {isEnrolling ? '…' : isEnrolled ? '✓ Enrolled' : isFull ? 'Waitlist' : 'Enroll'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : nav === 'progress' ? (
              <div>
                {enrollments.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '48px 0', textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: `${GREEN}10`, border: `1px solid ${GREEN}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookMarked size={24} style={{ color: GREEN, opacity: 0.5 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Not enrolled yet</div>
                      <div style={{ fontSize: 13, color: SUBTLE, lineHeight: 1.6, maxWidth: 360 }}>Browse cohorts and enroll to start tracking your milestones. Service Credits are held in escrow until each milestone is verified by your trainer.</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 340 }}>
                      {['Choose a cohort', 'Pay credits into escrow', 'Complete milestones', 'Trainer validates & credits release'].map((step, i) => (
                        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}` }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${GREEN}15`, border: `1px solid ${GREEN}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: GREEN, flexShrink: 0 }}>{i + 1}</div>
                          <span style={{ fontSize: 12, color: SUBTLE }}>{step}</span>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setNav('browse')}
                      style={{ padding: '10px 24px', borderRadius: 8, background: GREEN, border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BookOpen size={14} /> Browse Cohorts
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {enrollments.map((enr) => {
                      const pct = enr.milestones.length > 0 ? Math.round((enr.completedCount / enr.milestones.length) * 100) : 0;
                      return (
                        <div key={enr.cohortId} style={{ background: SURFACE, borderRadius: 12, padding: '18px', border: `1px solid ${BORDER}` }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{enr.title}</div>
                          {enr.trainerName && <div style={{ fontSize: 12, color: SUBTLE, marginBottom: 12 }}>with {enr.trainerName}</div>}
                          {enr.milestones.length > 0 ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SUBTLE, marginBottom: 4 }}>
                                <span>Milestones</span>
                                <span style={{ color: pct === 100 ? GREEN : TEXT }}>{enr.completedCount}/{enr.milestones.length}</span>
                              </div>
                              <div style={{ height: 6, background: BORDER, borderRadius: 99 }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? GREEN : '#3B82F6', borderRadius: 99 }} />
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: SUBTLE }}>Enrolled — awaiting cohort start</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: SUBTLE, fontSize: 14 }}>
                {nav.charAt(0).toUpperCase() + nav.slice(1)} — coming soon
              </div>
            )}
          </div>

          {/* Right panel — 300px */}
          <aside style={{ width: 300, background: SURFACE, borderLeft: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={14} color={GREEN} />
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, flex: 1 }}>My Enrollments</div>
              <Badge style={{ background: `${GREEN}15`, color: GREEN, border: `1px solid ${GREEN}30`, fontSize: 10 }}>{enrollments.length}</Badge>
            </div>
            <ScrollArea style={{ flex: 1 }}>
              <div style={{ padding: '14px' }}>
                {enrollments.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 12px', gap: 10, textAlign: 'center' }}>
                    <BookMarked size={20} style={{ color: GREEN, opacity: 0.4 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Not enrolled yet</div>
                    <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.6 }}>Browse cohorts and enroll to track your milestones here.</div>
                    <button type="button" onClick={() => setNav('browse')}
                      style={{ width: '100%', padding: '8px', borderRadius: 8, background: GREEN, border: 'none', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>
                      Browse Cohorts
                    </button>
                  </div>
                ) : (
                  enrollments.map((enr) => {
                    const pct = enr.milestones.length > 0 ? Math.round((enr.completedCount / enr.milestones.length) * 100) : 0;
                    return (
                      <div key={enr.cohortId} style={{ background: BG, borderRadius: 10, padding: '14px', marginBottom: 12, border: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4, lineHeight: 1.4 }}>{enr.title}</div>
                        {enr.trainerName && <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 10 }}>with {enr.trainerName}</div>}
                        {enr.milestones.length > 0 ? (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: SUBTLE, marginBottom: 4 }}>
                              <span>Milestones</span>
                              <span style={{ color: pct === 100 ? GREEN : TEXT }}>{enr.completedCount}/{enr.milestones.length}</span>
                            </div>
                            <div style={{ height: 6, background: BORDER, borderRadius: 99 }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? GREEN : '#3B82F6', borderRadius: 99 }} />
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 8 }}>Awaiting cohort start</div>
                        )}
                        {pct === 100 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: GREEN, fontWeight: 600 }}>
                            <Trophy size={13} /> Completed — credits released!
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Trainer validation panel */}
                {isAdmin && pendingValidations.length > 0 && (
                  <div style={{ marginTop: 8, padding: '14px', background: `${GREEN}08`, borderRadius: 10, border: `1px solid ${GREEN}20` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: GREEN, marginBottom: 10 }}>
                      <CheckCircle size={13} /> Pending Validations
                    </div>
                    {pendingValidations.map((v) => (
                      <div key={v.milestoneId} style={{ marginBottom: 10, padding: '10px', background: SURFACE, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                        {v.learnerName && <div style={{ fontSize: 12, color: TEXT, fontWeight: 500 }}>{v.learnerName}</div>}
                        {v.task && <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 8 }}>{v.task}</div>}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" onClick={() => void handleValidateMilestone(v.milestoneId)}
                            style={{ flex: 1, background: GREEN, color: '#000', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            Approve
                          </button>
                          <button type="button"
                            style={{ flex: 1, background: BORDER, color: SUBTLE, border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, cursor: 'pointer' }}>
                            Review
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>
        </div>
      </div>
    );
  }
  
