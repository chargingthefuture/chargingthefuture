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
  type SkillsHuntNotification, type SkillsHuntSubmission, type SkillsHuntMissionWithProgress,
} from "./sh-shared";
import { SkillsHuntNotifications } from "./sh-notifications";
import { SkillsHuntScoutTab, type ScoutFormModel } from "./sh-scout-tab";
import { SkillsHuntLeaderboardTab } from "./sh-leaderboard-tab";
import { SkillsHuntMissionsTab } from "./sh-missions-tab";
import { SkillsHuntMyFindsTab } from "./sh-my-finds-tab";
import { useNominationForm } from "./sh-use-nomination-form";

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
  rounds: SkillsHuntRound[];
  onSelectRound: (id: string) => void;
  submitted: boolean;
  form: ScoutFormModel;
  resetForm: () => void;
  loadingLeaderboard: boolean;
  leaderboard: SkillsHuntLeaderboardItem[];
  userId?: string;
  loadingMissions: boolean;
  missions: SkillsHuntMissionWithProgress[];
  loadingFinds: boolean;
  myFinds: SkillsHuntSubmission[];
}

function roundsLoadErrorMessage(e: unknown): string {
  return e instanceof Error && e.message === "rounds" ? "Unable to load rounds." : "Something went wrong.";
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
    return <SkillsHuntScoutTab noActiveRound={d.noActiveRound} activeRound={d.activeRound} rounds={d.rounds} onSelectRound={d.onSelectRound} submitted={d.submitted} form={d.form} onReset={d.resetForm} onNavTab={d.setTab} />;
  }
  if (d.tab === "leaderboard") {
    return <SkillsHuntLeaderboardTab loading={d.loadingLeaderboard} leaderboard={d.leaderboard} userId={d.userId} />;
  }
  if (d.tab === "missions") {
    return <SkillsHuntMissionsTab noActiveRound={d.noActiveRound} loading={d.loadingMissions} missions={d.missions} onNavTab={d.setTab} />;
  }
  return <SkillsHuntMyFindsTab noActiveRound={d.noActiveRound} loading={d.loadingFinds} myFinds={d.myFinds} onNavTab={d.setTab} />;
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
  const [leaderboard, setLeaderboard] = useState<SkillsHuntLeaderboardItem[]>([]);
  const [serverCurrentUserEntry, setServerCurrentUserEntry] = useState<SkillsHuntLeaderboardItem | null>(null);
  const [missions, setMissions] = useState<SkillsHuntMissionWithProgress[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(false);
  const [notifications, setNotifications] = useState<SkillsHuntNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [, setAchievements] = useState<SkillsHuntAchievement[]>([]);
  const [myFinds, setMyFinds] = useState<SkillsHuntSubmission[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [loadingFinds, setLoadingFinds] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  // Bumped by the header refresh button; the data effects below re-run without the full-screen
  // loading state (only the initial load, refreshKey 0, shows AppLoading).
  const [refreshKey, setRefreshKey] = useState(0);
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);

  const { form, submitted, resetForm } = useNominationForm(activeRound);

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
        if (!roundsRes.ok) throw new Error("rounds");
        const roundsData = (await roundsRes.json()) as { rounds: SkillsHuntRound[] };
        setRounds(roundsData.rounds);
        setActiveRound(roundsData.rounds[0] ?? null);
        if (achRes.ok) {
          const achData = (await achRes.json()) as { achievements: SkillsHuntAchievement[] };
          setAchievements(achData.achievements);
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setGlobalError(roundsLoadErrorMessage(e));
      } finally {
        if (!controller.signal.aborted) setLoadingRounds(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    if (!activeRound) return;
    const controller = new AbortController();
    async function load() {
      setLoadingLeaderboard(true);
      try {
        const res = await fetch(`/api/skills-hunt/rounds/${activeRound!.id}/leaderboard`, { signal: controller.signal });
        if (controller.signal.aborted || !res.ok) return;
        const data = (await res.json()) as { items: SkillsHuntLeaderboardItem[]; currentUserEntry?: SkillsHuntLeaderboardItem | null };
        setLeaderboard(data.items);
        setServerCurrentUserEntry(data.currentUserEntry ?? null);
      } finally {
        if (!controller.signal.aborted) setLoadingLeaderboard(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [activeRound, refreshKey]);

  useEffect(() => {
    if (tab !== "my-finds" || !activeRound) return;
    const controller = new AbortController();
    async function load() {
      setLoadingFinds(true);
      try {
        const res = await fetch(`/api/skills-hunt/rounds/${activeRound!.id}/submissions`, { signal: controller.signal });
        if (controller.signal.aborted || !res.ok) return;
        const data = (await res.json()) as { items: SkillsHuntSubmission[] };
        setMyFinds(data.items);
      } finally {
        if (!controller.signal.aborted) setLoadingFinds(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [tab, activeRound, refreshKey]);

  useEffect(() => {
    if (tab !== "missions" || !activeRound) return;
    const controller = new AbortController();
    async function load() {
      setLoadingMissions(true);
      try {
        const res = await fetch(`/api/skills-hunt/rounds/${activeRound!.id}/missions`, { signal: controller.signal });
        if (controller.signal.aborted || !res.ok) return;
        const data = (await res.json()) as { items: SkillsHuntMissionWithProgress[] };
        setMissions(data.items);
      } finally {
        if (!controller.signal.aborted) setLoadingMissions(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [tab, activeRound, refreshKey]);

  // Notifications: poll every 30s for unread (GetStream is out of scope; continuity §2.11).
  useEffect(() => {
    let canceled = false;
    async function load() {
      try {
        const res = await fetch("/api/skills-hunt/notifications");
        if (canceled || !res.ok) return;
        const data = (await res.json()) as { notifications: SkillsHuntNotification[] };
        setNotifications(data.notifications);
      } catch { /* ignore polling errors */ }
    }
    void load();
    const timer = setInterval(load, 30_000);
    return () => { canceled = true; clearInterval(timer); };
  }, []);

  async function markRead(notificationId: string) {
    try {
      await fetch(`/api/skills-hunt/notifications/${notificationId}/read`, { method: "POST", headers: { "x-ctf-csrf": "1" } });
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
    } catch { /* swallow — UX falls through to next poll */ }
  }

  if (loadingRounds) return <AppLoading />;
  if (globalError) return <CenteredNote t={t} color="#EF4444">{globalError}</CenteredNote>;

  const { noActiveRound } = deriveShellState({ leaderboard, serverCurrentUserEntry, userId, rounds });
  const showModeratorTools = isAdmin || isModerator;

  const content = (
    <ShellContent
      tab={tab} setTab={setTab} noActiveRound={noActiveRound} submitted={submitted} form={form} resetForm={resetForm}
      activeRound={activeRound} rounds={rounds}
      onSelectRound={(id) => setActiveRound(rounds.find((r) => r.id === id) ?? null)}
      loadingLeaderboard={loadingLeaderboard} leaderboard={leaderboard} userId={userId}
      loadingMissions={loadingMissions} missions={missions}
      loadingFinds={loadingFinds} myFinds={myFinds}
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
          <SkillsHuntNotifications placement="mobile" notifications={notifications} onClose={() => setNotifOpen(false)} onMarkRead={(id) => void markRead(id)} />
        )}
        <div style={{ padding: 16 }}>{content}</div>
      </div>
    );
}
