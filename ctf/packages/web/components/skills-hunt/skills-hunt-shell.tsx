"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  BG, COLOR, TABS, type Tab,
  type SkillsHuntRound, type SkillsHuntLeaderboardItem, type SkillsHuntAchievement,
  type SkillsHuntNotification, type SkillsHuntSubmission, type SkillsHuntMissionWithProgress,
} from "./sh-shared";
import { SkillsHuntIconRail } from "./sh-icon-rail";
import { SkillsHuntNotifications } from "./sh-notifications";
import { SkillsHuntSidebar } from "./sh-sidebar";
import { SkillsHuntScoutTab, type ScoutFormModel } from "./sh-scout-tab";
import { SkillsHuntLeaderboardTab } from "./sh-leaderboard-tab";
import { SkillsHuntMissionsTab } from "./sh-missions-tab";
import { SkillsHuntMyFindsTab } from "./sh-my-finds-tab";
import { SkillsHuntRightPanel } from "./sh-right-panel";
import { useNominationForm } from "./sh-use-nomination-form";

function CenteredNote({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color }}>{children}</div>
    </div>
  );
}

function ShellHeader({ activeRound }: { activeRound: SkillsHuntRound | null }) {
  return (
    <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
      <Search size={18} style={{ color: COLOR }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>Skills Hunt</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>
          {activeRound ? activeRound.name : "Nominate survivors · build the Directory · grow the economy"}
        </div>
      </div>
      {activeRound && (
        <span style={{ background: "#22C55E20", color: "#22C55E", border: "1px solid #22C55E35", fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>Round active</span>
      )}
    </header>
  );
}

interface ShellData {
  tab: Tab;
  setTab: (t: Tab) => void;
  noActiveRound: boolean;
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

function deriveShellState(args: {
  leaderboard: SkillsHuntLeaderboardItem[];
  serverCurrentUserEntry: SkillsHuntLeaderboardItem | null;
  userId?: string;
  rounds: SkillsHuntRound[];
  notifications: SkillsHuntNotification[];
}) {
  return {
    currentUserEntry: args.leaderboard.find((item) => item.userId === args.userId) ?? args.serverCurrentUserEntry,
    noActiveRound: args.rounds.length === 0,
    unreadCount: args.notifications.filter((n) => !n.isRead).length,
  };
}

function ShellContent(d: ShellData) {
  if (d.tab === "scout") {
    return <SkillsHuntScoutTab noActiveRound={d.noActiveRound} submitted={d.submitted} form={d.form} onReset={d.resetForm} onNavTab={d.setTab} />;
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
  const [achievements, setAchievements] = useState<SkillsHuntAchievement[]>([]);
  const [myFinds, setMyFinds] = useState<SkillsHuntSubmission[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [loadingFinds, setLoadingFinds] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

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
      setLoadingRounds(true);
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
        setGlobalError(e instanceof Error && e.message === "rounds" ? "Unable to load rounds." : "Something went wrong.");
      } finally {
        if (!controller.signal.aborted) setLoadingRounds(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

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
  }, [activeRound]);

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
  }, [tab, activeRound]);

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
  }, [tab, activeRound]);

  // Notifications: poll every 30s for unread (GetStream is out of scope; continuity §2.11).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/skills-hunt/notifications");
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { notifications: SkillsHuntNotification[] };
        setNotifications(data.notifications);
      } catch { /* ignore polling errors */ }
    }
    void load();
    const timer = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  async function markRead(notificationId: string) {
    try {
      await fetch(`/api/skills-hunt/notifications/${notificationId}/read`, { method: "POST", headers: { "x-ctf-csrf": "1" } });
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
    } catch { /* swallow — UX falls through to next poll */ }
  }

  if (loadingRounds) return <CenteredNote color="#6B7280">Loading Skills Hunt…</CenteredNote>;
  if (globalError) return <CenteredNote color="#EF4444">{globalError}</CenteredNote>;

  const { currentUserEntry, noActiveRound, unreadCount } = deriveShellState({ leaderboard, serverCurrentUserEntry, userId, rounds, notifications });
  const showModeratorTools = isAdmin || isModerator;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex" }}>
      <SkillsHuntIconRail tab={tab} onTab={setTab} notifOpen={notifOpen} onToggleNotif={() => setNotifOpen((o) => !o)} unreadCount={unreadCount} />
      {notifOpen && (
        <SkillsHuntNotifications notifications={notifications} onClose={() => setNotifOpen(false)} onMarkRead={(id) => void markRead(id)} />
      )}
      <SkillsHuntSidebar tab={tab} onTab={setTab} achievements={achievements} currentUserEntry={currentUserEntry} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ShellHeader activeRound={activeRound} />
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <ShellContent
            tab={tab} setTab={setTab} noActiveRound={noActiveRound} submitted={submitted} form={form} resetForm={resetForm}
            loadingLeaderboard={loadingLeaderboard} leaderboard={leaderboard} userId={userId}
            loadingMissions={loadingMissions} missions={missions}
            loadingFinds={loadingFinds} myFinds={myFinds}
          />
        </div>
      </div>
      <SkillsHuntRightPanel currentUserEntry={currentUserEntry} achievements={achievements} showModeratorTools={showModeratorTools} />
    </div>
  );
}
