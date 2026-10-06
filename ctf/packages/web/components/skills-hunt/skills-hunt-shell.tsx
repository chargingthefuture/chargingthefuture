"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Search } from "lucide-react";
import { BackChevronButton } from "@/lib/nav/back-history";
import { useTheme } from "@/hooks/useTheme";
import { AppLoading } from "@/components/shared/app-loading";
import { PluginAdminButton } from "@/components/shared/plugin-admin-button";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { RefreshButton } from "@/components/shared/refresh-button";
import {
  getSkillsHuntTokens, TABS, type SkillsHuntTokens, type Tab,
  type SkillsHuntRound, type SkillsHuntLeaderboardItem, type SkillsHuntAchievement,
  type SkillsHuntSubmission, type SkillsHuntMissionWithCommunityProgress,
} from "./sh-shared";
import { SkillsHuntNotifications } from "./sh-notifications";
import { SkillsHuntScoutTab, type ScoutFormModel } from "./sh-scout-tab";
import { SkillsHuntLeaderboardTab } from "./sh-leaderboard-tab";
import { SkillsHuntMissionsTab } from "./sh-missions-tab";
import { SkillsHuntMyFindsTab } from "./sh-my-finds-tab";
import { useNominationForm } from "./sh-use-nomination-form";
import { routeFailureMessage, useRoundTabReads, useSkillsHuntNotifications } from "./sh-use-member-reads";
import { reportError } from "lib/observability/report";

function CenteredNote({ t, color, children }: { t: SkillsHuntTokens; color: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: t.BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color }}>{children}</div>
    </div>
  );
}

interface ShellData {
  tab: Tab;
  setTab: (t: Tab) => void;
  noActiveRound: boolean;
  activeRound: SkillsHuntRound | null;
  submitted: boolean;
  form: ScoutFormModel;
  resetForm: () => void;
  loadingLeaderboard: boolean;
  leaderboard: SkillsHuntLeaderboardItem[];
  leaderboardError: string | null;
  userId?: string;
  loadingMissions: boolean;
  missions: SkillsHuntMissionWithCommunityProgress[];
  missionsError: string | null;
  loadingFinds: boolean;
  myFinds: SkillsHuntSubmission[];
  findsError: string | null;
  refreshKey: number;
}

// A refused or failed rounds read carries the route's own message (thrown below); a network failure
// has no route message, so it gets a plain sentence instead.
class RoundsReadError extends Error {}

function roundsLoadErrorMessage(e: unknown): string {
  return e instanceof RoundsReadError ? e.message : "Unable to load rounds. Check your connection and try again.";
}

async function roundsReadError(res: Response): Promise<RoundsReadError> {
  return new RoundsReadError(await routeFailureMessage(res, `Unable to load rounds (HTTP ${res.status}).`));
}

function deriveShellState(args: {
  leaderboard: SkillsHuntLeaderboardItem[];
  serverCurrentUserEntry: SkillsHuntLeaderboardItem | null;
  userId?: string;
  rounds: SkillsHuntRound[];
}) {
  return {
    currentUserEntry: args.leaderboard.find((item) => item.userId === args.userId) ?? args.serverCurrentUserEntry,
    noActiveRound: args.rounds.length === 0,
  };
}

function ShellContent(d: ShellData) {
  if (d.tab === "scout") {
    return <SkillsHuntScoutTab noActiveRound={d.noActiveRound} activeRound={d.activeRound} submitted={d.submitted} form={d.form} onReset={d.resetForm} onNavTab={d.setTab} />;
  }
  if (d.tab === "leaderboard") {
    return <SkillsHuntLeaderboardTab loading={d.loadingLeaderboard} leaderboard={d.leaderboard} error={d.leaderboardError} userId={d.userId} />;
  }
  if (d.tab === "missions") {
    return <SkillsHuntMissionsTab noActiveRound={d.noActiveRound} loading={d.loadingMissions} missions={d.missions} error={d.missionsError} onNavTab={d.setTab} />;
  }
  return <SkillsHuntMyFindsTab noActiveRound={d.noActiveRound} loading={d.loadingFinds} myFinds={d.myFinds} error={d.findsError} refreshKey={d.refreshKey} onNavTab={d.setTab} />;
}

export function SkillsHuntShell({
  userId,
  isAdmin = false,
  isModerator = false,
}: {
  userId?: string;
  isAdmin?: boolean;
  isModerator?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("scout");
  const [rounds, setRounds] = useState<SkillsHuntRound[]>([]);
  const [activeRound, setActiveRound] = useState<SkillsHuntRound | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [, setAchievements] = useState<SkillsHuntAchievement[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  // Bumped by the header refresh button; the data effects below re-run without the full-screen
  // loading state (only the initial load, refreshKey 0, shows AppLoading).
  const [refreshKey, setRefreshKey] = useState(0);
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);

  const { form, submitted, resetForm } = useNominationForm(activeRound);
  const roundKey = activeRound?.id ?? null;

  const initialTabRead = useRef(false);
  useEffect(() => {
    if (initialTabRead.current) return;
    initialTabRead.current = true;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      if (p && TABS.some((t) => t.key === p)) setTab(p);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (refreshKey === 0) setLoadingRounds(true);
      setGlobalError(null);
      try {
        const [roundsRes, achRes] = await Promise.all([
          fetch("/api/skills-hunt/rounds?status=active", { signal: controller.signal }),
          fetch("/api/skills-hunt/achievements", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        if (!roundsRes.ok) throw await roundsReadError(roundsRes);
        const roundsData = (await roundsRes.json()) as { rounds: SkillsHuntRound[] };
        setRounds(roundsData.rounds);
        // Only one round is open at a time (owner decision, 2026-10-01; the server refuses a
        // second), so the open round is the round: every tab reads it and a nomination goes into it.
        // If more than one is somehow open, none is picked and the screen says so, rather than
        // guessing and filing a nomination under a round the scout never saw.
        setActiveRound(roundsData.rounds.length === 1 ? roundsData.rounds[0] : null);
        if (achRes.ok) {
          const achData = (await achRes.json()) as { achievements: SkillsHuntAchievement[] };
          setAchievements(achData.achievements);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        reportError(e, { area: "skills-hunt", op: "member_rounds_load" });
        setGlobalError(roundsLoadErrorMessage(e));
      } finally {
        if (!controller.signal.aborted) setLoadingRounds(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey]);

  const lists = useRoundTabReads(roundKey, tab, refreshKey);
  const { leaderboard, serverCurrentUserEntry } = lists;
  const notif = useSkillsHuntNotifications();

  if (loadingRounds) return <AppLoading />;
  if (globalError) return <CenteredNote t={t} color="#EF4444">{globalError}</CenteredNote>;
  if (rounds.length > 1) return <CenteredNote t={t} color={t.MUTED}>More than one round is open, and only one can be. An admin needs to close the others before nominations can continue.</CenteredNote>;

  const { noActiveRound } = deriveShellState({ leaderboard, serverCurrentUserEntry, userId, rounds });
  const showModeratorTools = isAdmin || isModerator;

  const content = (
    <ShellContent
      tab={tab} setTab={setTab} noActiveRound={noActiveRound} submitted={submitted} form={form} resetForm={resetForm}
      activeRound={activeRound}
      loadingLeaderboard={lists.loadingLeaderboard} leaderboard={leaderboard} leaderboardError={lists.leaderboardError} userId={userId}
      loadingMissions={lists.loadingMissions} missions={lists.missions} missionsError={lists.missionsError}
      loadingFinds={lists.loadingFinds} myFinds={lists.myFinds} findsError={lists.findsError} refreshKey={refreshKey}
    />
  );

    return (
      <div style={{ minHeight: "100vh", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: t.HEADER, borderBottom: `1px solid ${t.BORDER}` }}>
          {/* flexWrap: this row carries the plugin actions plus the three global ones, which
              together overflow a 390px phone — the last control was clipped off the right
              edge and the title collapsed to nothing. Wrapping reflows instead of cutting
              off; on a wider viewport it still renders as one line. */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 6, gap: 8, padding: "10px 14px" }}>
            <BackChevronButton accent={t.ACCENT} />
            <Search size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            {/* Title shrinks and truncates so the trailing controls stay on screen */}
            <span style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>SkillsHunt</span>
            <PluginAdminButton href="/admin/skills-hunt" isAdmin={showModeratorTools} accent={t.ACCENT} />
            <button type="button" onClick={() => setNotifOpen((o) => !o)} aria-label="Status" style={{ position: "relative", width: 38, height: 38, borderRadius: 10, background: t.INPUT_BG, border: `1px solid ${t.BORDER_STRONG}`, color: t.SUBTLE, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <Bell size={18} />
            </button>
            <RefreshButton onRefresh={() => setRefreshKey((k) => k + 1)} title="Refresh" />
            <MobileTopActions />
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 8px", overflowX: "auto" }}>
            {TABS.map((tabItem) => (
              <button key={tabItem.key} onClick={() => setTab(tabItem.key)} style={{ whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 8, background: tab === tabItem.key ? `${t.ACCENT}1A` : "transparent", border: `1px solid ${tab === tabItem.key ? t.ACCENT + "40" : t.BORDER_STRONG}`, color: tab === tabItem.key ? t.ACCENT : t.SUBTLE, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>{tabItem.label}</button>
            ))}
          </div>
        </div>
        {notifOpen && (
          <SkillsHuntNotifications placement="mobile" notifications={notif.notifications} error={notif.error} onClose={() => setNotifOpen(false)} onMarkRead={(id) => void notif.markRead(id)} />
        )}
        <div style={{ padding: 16 }}>{content}</div>
      </div>
    );
}
