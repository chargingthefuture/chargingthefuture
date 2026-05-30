"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { BG, SUBTLE, TEXT, type Cohort, type Enrollment, type PendingValidation, type NavKey, type Wallet, idempotencyKey } from "./lu-shared";
import { LevelUpSidebar } from "./lu-sidebar";
import { LevelUpBrowse } from "./lu-browse";
import { LevelUpProgress } from "./lu-progress";
import { LevelUpRightPanel } from "./lu-right-panel";
import { LevelUpLoading } from "./lu-loading";

const HEADINGS: Record<NavKey, string> = {
  browse: "Browse Cohorts",
  progress: "My Progress",
  trainers: "My Trainers",
  achievements: "Achievements",
  wallet: "Credits Wallet",
};

async function fetchCohorts(track: string, signal: AbortSignal): Promise<Cohort[]> {
  const params = new URLSearchParams();
  if (track !== "All Tracks") params.set("track", track);
  const res = await fetch(`/api/levelup/cohorts?${params}`, { signal });
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

function ShellHeader({ nav, isAdmin }: { nav: NavKey; isAdmin: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT }}>{HEADINGS[nav]}</h1>
        <div style={{ fontSize: 13, color: SUBTLE, marginTop: 4 }}>
          {nav === "browse" ? "Enroll in a training program and grow your skills" : "Your LevelUp journey"}
        </div>
      </div>
      {nav === "browse" && (
        <button type="button" disabled={!isAdmin}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", color: SUBTLE, border: "1px solid #1E2A3A", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: isAdmin ? "pointer" : "not-allowed", opacity: isAdmin ? 1 : 0.5 }}>
          <Plus size={14} /> Create Cohort
        </button>
      )}
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
    escrow: wallet?.levelupEscrowedBalance ?? wallet?.walletEscrowBalance ?? 0,
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
}: {
  nav: NavKey;
  loading: boolean;
  error: string | null;
  browse: React.ReactNode;
  progress: React.ReactNode;
}) {
  if (loading) return <CenteredNote color={SUBTLE}>Loading…</CenteredNote>;
  if (error) return <CenteredNote color="#EF4444">{error}</CenteredNote>;
  if (nav === "browse") return <>{browse}</>;
  if (nav === "progress") return <>{progress}</>;
  return <CenteredNote color={SUBTLE}>{HEADINGS[nav]} — coming soon</CenteredNote>;
}

export function LevelupShell({ isAdmin = false }: { userId?: string; isAdmin?: boolean; query?: { track?: string; status?: string; startDate?: string; cohortId?: string } }) {
  const [nav, setNav] = useState<NavKey>("browse");
  const [track, setTrack] = useState("All Tracks");
  const [search, setSearch] = useState("");
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [pendingValidations, setPendingValidations] = useState<PendingValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
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
      if (!signal.aborted) setLoading(false);
    }
  }, [track]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => { controller.abort(); };
  }, [load]);

  async function handleEnroll(cohort: Cohort) {
    if (enrollingId || enrolledIds.has(cohort.id)) return;
    setEnrollingId(cohort.id);
    setEnrollError(null);
    try {
      const res = await fetch("/api/levelup/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  async function handleValidate(milestoneId: string) {
    try {
      await fetch(`/api/levelup/milestones/${milestoneId}/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setPendingValidations((prev) => prev.filter((v) => v.milestoneId !== milestoneId));
    } catch {
      // optimistic remove already applied on success path only
    }
  }

  const { filtered, balance, escrow, openCount } = deriveView(cohorts, wallet, track, search);

  if (loading && cohorts.length === 0 && !error) return <LevelUpLoading />;

  return (
    <div style={{ display: "flex", height: "100vh", background: BG, fontFamily: "Inter, system-ui, sans-serif", color: TEXT, overflow: "hidden" }}>
      <LevelUpSidebar nav={nav} onNav={setNav} isAdmin={isAdmin} balance={balance} escrow={escrow} />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          <ShellHeader nav={nav} isAdmin={isAdmin} />
          <ShellContent
            nav={nav}
            loading={loading}
            error={error}
            browse={(
              <LevelUpBrowse
                cohorts={filtered}
                openCount={openCount}
                enrolledCount={enrollments.length}
                balance={balance}
                escrow={escrow}
                track={track}
                onTrack={setTrack}
                search={search}
                onSearch={setSearch}
                enrollError={enrollError}
                enrolledIds={enrolledIds}
                enrollingId={enrollingId}
                onEnroll={(cohort) => void handleEnroll(cohort)}
              />
            )}
            progress={<LevelUpProgress enrollments={enrollments} onBrowse={() => setNav("browse")} />}
          />
        </div>
        <LevelUpRightPanel
          enrollments={enrollments}
          pendingValidations={pendingValidations}
          isAdmin={isAdmin}
          onBrowse={() => setNav("browse")}
          onValidate={(milestoneId) => void handleValidate(milestoneId)}
        />
      </div>
    </div>
  );
}
