"use client";

import { useCallback, useEffect, useState } from "react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useTheme } from "@/hooks/useTheme";
import { getLevelUpTokens, type LevelUpTokens, type Cohort, type Enrollment, type PendingValidation, type NavKey, type Wallet, type Trainer, type Achievement, type WalletView, idempotencyKey } from "./lu-shared";
import { LevelUpSidebar } from "./lu-sidebar";
import { LevelUpBrowse } from "./lu-browse";
import { LevelUpProgress } from "./lu-progress";
import { LevelUpRightPanel } from "./lu-right-panel";
import { LevelUpLoading } from "./lu-loading";
import { LevelUpTrainers } from "./lu-trainers";
import { LevelUpAchievements } from "./lu-achievements";
import { LevelUpWallet } from "./lu-wallet";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";

const HEADINGS: Record<NavKey, string> = {
  browse: "Browse Cohorts",
  progress: "My Progress",
  trainers: "Trainers",
  achievements: "Achievements",
  wallet: "Credits Wallet",
};

const SUBHEADINGS: Record<NavKey, string> = {
  browse: "Enroll in a training program and grow your skills",
  progress: "Your LevelUp journey",
  trainers: "Survivor-advocates who lead the cohorts",
  achievements: "Badges you earn as you complete milestones",
  wallet: "Your balance and the credits you've earned",
};

async function fetchCohorts(track: string, signal: AbortSignal): Promise<Cohort[]> {
  const params = new URLSearchParams();
  if (track !== "All Tracks") params.set("track", track);
  const res = await fetch(`/api/level-up/cohorts?${params}`, { signal });
  if (!res.ok) throw new Error("Failed to load cohorts");
  const data = (await res.json()) as { cohorts?: Cohort[] } | Cohort[];
  return Array.isArray(data) ? data : (data.cohorts ?? []);
}

async function fetchWallet(signal: AbortSignal): Promise<Wallet | null> {
  const res = await fetch("/api/service-credits/wallet", { signal });
  if (!res.ok) return null;
  const wd = (await res.json()) as { wallet?: Wallet } | Wallet;
  return "wallet" in wd && wd.wallet ? (wd.wallet as Wallet) : (wd as Wallet);
}

async function fetchTrainers(signal: AbortSignal): Promise<Trainer[]> {
  const res = await fetch("/api/level-up/trainers", { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { trainers?: Trainer[] };
  return data.trainers ?? [];
}

async function fetchAchievements(signal: AbortSignal): Promise<Achievement[]> {
  const res = await fetch("/api/level-up/achievements", { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { achievements?: Achievement[] };
  return data.achievements ?? [];
}

async function fetchWalletView(signal: AbortSignal): Promise<WalletView | null> {
  const res = await fetch("/api/level-up/wallet", { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as { wallet?: WalletView };
  return data.wallet ?? null;
}

function ShellHeader({ nav, isAdmin, t, showAdminButton = false, onRefresh }: { nav: NavKey; isAdmin: boolean; t: LevelUpTokens; showAdminButton?: boolean; onRefresh?: () => Promise<void> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: t.TEXT_BODY }}>{HEADINGS[nav]}</h1>
        <div style={{ fontSize: 13, color: t.TEXT_SUBTLE, marginTop: 4 }}>
          {SUBHEADINGS[nav]}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onRefresh && <RefreshButton onRefresh={onRefresh} title="Refresh" />}
        {showAdminButton && <PluginAdminButton href="/admin/level-up" isAdmin={isAdmin} accent={t.ACCENT} />}
      </div>
    </div>
  );
}

function deriveView(cohorts: Cohort[], wallet: Wallet | null, track: string, search: string) {
  const filtered = cohorts.filter((c) => {
    const matchTrack = track === "All Tracks" || c.track === track;
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    return matchTrack && matchSearch;
  });
  return {
    filtered,
    balance: wallet?.availableBalance ?? 0,
    escrow: wallet?.levelUpEscrowedBalance ?? wallet?.walletEscrowBalance ?? 0,
    openCount: cohorts.filter((c) => c.status === "open").length,
  };
}

function CenteredNote({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color, fontSize: 14 }}>{children}</div>
  );
}

function ShellContent({
  nav,
  loading,
  error,
  browse,
  progress,
  trainers,
  achievements,
  wallet,
  t,
}: {
  nav: NavKey;
  loading: boolean;
  error: string | null;
  browse: React.ReactNode;
  progress: React.ReactNode;
  trainers: React.ReactNode;
  achievements: React.ReactNode;
  wallet: React.ReactNode;
  t: LevelUpTokens;
}) {
  if (loading) return <CenteredNote color={t.TEXT_SUBTLE}>Loading…</CenteredNote>;
  if (error) return <CenteredNote color="#EF4444">{error}</CenteredNote>;
  if (nav === "browse") return <>{browse}</>;
  if (nav === "progress") return <>{progress}</>;
  if (nav === "trainers") return <>{trainers}</>;
  if (nav === "achievements") return <>{achievements}</>;
  if (nav === "wallet") return <>{wallet}</>;
  return <CenteredNote color={t.TEXT_SUBTLE}>{HEADINGS[nav]} — coming soon</CenteredNote>;
}

export function LevelUpShell({ isAdmin = false, isTrainer = false }: { userId?: string; isAdmin?: boolean; isTrainer?: boolean; query?: { track?: string; status?: string; startDate?: string; cohortId?: string } }) {
  const [nav, setNav] = useState<NavKey>("browse");
  // Track filtering is pinned to "All Tracks" — the preset track chips were hidden because they were a
  // hardcoded list that did not reflect real cohorts (deferred to #1197). The track-filter plumbing
  // (fetchCohorts/deriveView) is kept so dynamic, data-driven filters can be restored later.
  const track = "All Tracks";
  const [search, setSearch] = useState("");
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  // NOTE: when a pending-validations feed is wired up here, it MUST be scoped server-side to the
  // cohorts this trainer is assigned to (mirroring getTrainerDashboardData's
  // `created_by_user_id = actorId` filter). Passing an unscoped list to the panel would disclose
  // other trainers' learners. It is a static empty list today, so there is no exposure yet.
  const [pendingValidations, setPendingValidations] = useState<PendingValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [walletView, setWalletView] = useState<WalletView | null>(null);
  const [sectionLoaded, setSectionLoaded] = useState<Record<string, boolean>>({});
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const t = getLevelUpTokens(theme);

  const load = useCallback(async (signal: AbortSignal, background = false) => {
    // A background reload (the header refresh button) keeps the current screen on
    // display instead of flashing the loading state.
    if (!background) setLoading(true);
    setError(null);
    try {
      const [cohortsData, walletData] = await Promise.all([fetchCohorts(track, signal), fetchWallet(signal)]);
      if (signal.aborted) return;
      setCohorts(cohortsData);
      setWallet(walletData);
    } catch (e: unknown) {
      if (signal.aborted) return;
      setError(e instanceof Error ? e.message : "Failed to load LevelUp.");
    } finally {
      if (!signal.aborted && !background) setLoading(false);
    }
  }, [track]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => { controller.abort(); };
  }, [load]);

  // Header refresh: re-pull cohorts + wallet in the background and mark the lazily loaded
  // sections (trainers, achievements, wallet view) for a re-fetch on their next render.
  const handleRefresh = useCallback(async () => {
    const controller = new AbortController();
    await load(controller.signal, true);
    setSectionLoaded({});
  }, [load]);

  useEffect(() => {
    if (nav !== "trainers" && nav !== "achievements" && nav !== "wallet") return;
    if (sectionLoaded[nav]) return;
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        if (nav === "trainers") {
          const data = await fetchTrainers(signal);
          if (!signal.aborted) setTrainers(data);
        } else if (nav === "achievements") {
          const data = await fetchAchievements(signal);
          if (!signal.aborted) setAchievements(data);
        } else if (nav === "wallet") {
          const data = await fetchWalletView(signal);
          if (!signal.aborted) setWalletView(data);
        }
        if (!signal.aborted) setSectionLoaded((prev) => ({ ...prev, [nav]: true }));
      } catch {
        // Section fetch failures fall back to that section's empty/unavailable state.
        if (!signal.aborted) setSectionLoaded((prev) => ({ ...prev, [nav]: true }));
      }
    })();
    return () => { controller.abort(); };
  }, [nav, sectionLoaded]);

  async function handleEnroll(cohort: Cohort) {
    if (enrollingId || enrolledIds.has(cohort.id)) return;
    setEnrollingId(cohort.id);
    setEnrollError(null);
    try {
      const res = await fetch("/api/level-up/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ cohortId: cohort.id, idempotencyKey: idempotencyKey(), depositCredits: cohort.requiredCredits ?? 0 }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string; message?: string };
        throw new Error(d.error ?? d.message ?? "Enrollment failed");
      }
      setEnrolledIds((prev) => new Set([...prev, cohort.id]));
      setEnrollments((prev) => [...prev, { cohortId: cohort.id, title: cohort.title, track: cohort.track, trainerName: cohort.trainerName, milestones: [], completedCount: 0 }]);
    } catch (e: unknown) {
      setEnrollError(e instanceof Error ? e.message : "Enrollment failed.");
    } finally {
      setEnrollingId(null);
    }
  }

  async function handleValidate(validation: PendingValidation) {
    try {
      const res = await fetch(`/api/level-up/milestones/${validation.milestoneId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          enrollmentId: validation.enrollmentId,
          cohortId: validation.cohortId,
          idempotencyKey: idempotencyKey(),
        }),
      });
      if (!res.ok) return;
      setPendingValidations((prev) => prev.filter((v) => v.milestoneId !== validation.milestoneId));
    } catch {
      // optimistic remove already applied on success path only
    }
  }

  const { filtered, balance, escrow, openCount } = deriveView(cohorts, wallet, track, search);

  if (loading && cohorts.length === 0 && !error) return <LevelUpLoading />;

  const content = (
    <>
      <ShellHeader nav={nav} isAdmin={isAdmin} t={t} showAdminButton={!isMobile} onRefresh={isMobile ? undefined : handleRefresh} />
      <ShellContent
        nav={nav}
        loading={loading}
        error={error}
        t={t}
        browse={(
          <LevelUpBrowse
            cohorts={filtered}
            openCount={openCount}
            enrolledCount={enrollments.length}
            escrow={escrow}
            search={search}
            onSearch={setSearch}
            enrollError={enrollError}
            enrolledIds={enrolledIds}
            enrollingId={enrollingId}
            onEnroll={(cohort) => void handleEnroll(cohort)}
          />
        )}
        progress={<LevelUpProgress enrollments={enrollments} onBrowse={() => setNav("browse")} />}
        trainers={sectionLoaded.trainers ? <LevelUpTrainers trainers={trainers} /> : <CenteredNote color={t.TEXT_SUBTLE}>Loading…</CenteredNote>}
        achievements={sectionLoaded.achievements ? <LevelUpAchievements achievements={achievements} /> : <CenteredNote color={t.TEXT_SUBTLE}>Loading…</CenteredNote>}
        wallet={sectionLoaded.wallet ? <LevelUpWallet wallet={walletView} /> : <CenteredNote color={t.TEXT_SUBTLE}>Loading…</CenteredNote>}
      />
    </>
  );

  if (isMobile) {
    const navItems: { key: NavKey; label: string }[] = [
      { key: "browse", label: "Browse" },
      { key: "progress", label: "Progress" },
      { key: "trainers", label: "Trainers" },
      { key: "achievements", label: "Achievements" },
      { key: "wallet", label: "Wallet" },
    ];
    return (
      <div style={{ minHeight: "100dvh", background: t.BG, fontFamily: "Inter, system-ui, sans-serif", color: t.TEXT_BODY }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>LevelUp</span>
            <PluginAdminButton href="/admin/level-up" isAdmin={isAdmin} accent={t.ACCENT} />
            <RefreshButton onRefresh={handleRefresh} title="Refresh" />
            <MobileTopActions />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px", overflowX: "auto" }}>
            {navItems.map(({ key, label }) => (
              <button key={key} onClick={() => setNav(key)} style={{ whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 8, background: nav === key ? t.ACCENT_TINT_BG : "transparent", border: `1px solid ${nav === key ? t.ACCENT_NAV_BORDER : t.BORDER_STRONG}`, color: nav === key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: 16 }}>{content}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: t.BG, fontFamily: "Inter, system-ui, sans-serif", color: t.TEXT_BODY, overflow: "hidden" }}>
      <LevelUpSidebar nav={nav} onNav={setNav} isAdmin={isAdmin} balance={balance} escrow={escrow} />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {content}
        </div>
        <LevelUpRightPanel
          enrollments={enrollments}
          pendingValidations={pendingValidations}
          isAdmin={isAdmin}
          isTrainer={isTrainer}
          onBrowse={() => setNav("browse")}
          onValidate={(validation) => void handleValidate(validation)}
        />
      </div>
    </div>
  );
}
