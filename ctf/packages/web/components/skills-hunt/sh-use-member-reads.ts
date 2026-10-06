"use client";

import { useEffect, useRef, useState } from "react";
import { reportError } from "lib/observability/report";
import { startVisibleInterval } from "../../lib/shared/visible-interval";
import type {
  SkillsHuntLeaderboardItem, SkillsHuntMissionWithCommunityProgress, SkillsHuntNotification, SkillsHuntSubmission, Tab,
} from "./sh-shared";

// The member screen's reads, each with its own error state. A failed read used to leave its list
// empty, so the tab showed its empty state instead: a scout whose finds failed to load was told they
// had nominated nobody. Now each tab gets the route's own message (member routes answer in plain
// words) and shows it in place of the empty state, and the failure is reported (rule 137).

// The message to show for a refused or failed answer: the route's own `message` when it sent one,
// otherwise the fallback, which names what failed and the HTTP status.
export async function routeFailureMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (body && typeof body.message === "string" && body.message.trim()) return body.message;
  return fallback;
}

function failedReadMessage(res: Response, what: string): Promise<string> {
  return routeFailureMessage(res, `Unable to load ${what} (HTTP ${res.status}).`);
}

// One GET, re-run when `url` or `refreshKey` changes. A null `url` skips the read and keeps what was
// last loaded, so switching away from a tab and back does not blank it.
export function useSkillsHuntRead<T>(url: string | null, refreshKey: number, what: string, op: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    async function load(target: string) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(target, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          const message = await failedReadMessage(res, what);
          reportError(new Error(`${what} read answered ${res.status}: ${message}`), { area: "skills-hunt", op });
          if (!controller.signal.aborted) setError(message);
          return;
        }
        const body = (await res.json()) as T;
        if (!controller.signal.aborted) setData(body);
      } catch (err) {
        if (controller.signal.aborted) return;
        reportError(err, { area: "skills-hunt", op });
        setError(`Unable to load ${what}. Check your connection and try again.`);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load(url);
    return () => controller.abort();
  }, [url, refreshKey, what, op]);

  return { data, loading, error };
}

function roundUrl(roundKey: string | null, path: string, enabled: boolean): string | null {
  return enabled && roundKey ? `/api/skills-hunt/rounds/${roundKey}/${path}` : null;
}

function itemsOf<T>(data: { items: T[] } | null): T[] {
  return data?.items ?? [];
}

type LeaderboardBody = { items: SkillsHuntLeaderboardItem[]; currentUserEntry?: SkillsHuntLeaderboardItem | null };

// The open round's three lists. The leaderboard loads whenever there is a round; My Finds and
// Missions load only while their tab is showing.
export function useRoundTabReads(roundKey: string | null, tab: Tab, refreshKey: number) {
  const board = useSkillsHuntRead<LeaderboardBody>(roundUrl(roundKey, "leaderboard", true), refreshKey, "the leaderboard", "member_leaderboard_load");
  const finds = useSkillsHuntRead<{ items: SkillsHuntSubmission[] }>(roundUrl(roundKey, "submissions", tab === "my-finds"), refreshKey, "your finds", "member_finds_load");
  const missions = useSkillsHuntRead<{ items: SkillsHuntMissionWithCommunityProgress[] }>(roundUrl(roundKey, "missions", tab === "missions"), refreshKey, "missions", "member_missions_load");
  return {
    leaderboard: itemsOf(board.data),
    serverCurrentUserEntry: board.data?.currentUserEntry ?? null,
    loadingLeaderboard: board.loading,
    leaderboardError: board.error,
    myFinds: itemsOf(finds.data),
    loadingFinds: finds.loading,
    findsError: finds.error,
    missions: itemsOf(missions.data),
    loadingMissions: missions.loading,
    missionsError: missions.error,
  };
}

// Notifications: poll every 30s for unread (GetStream is out of scope; continuity §2.11). A failed
// poll or mark-read is shown in the Status panel; the poll's failure is reported once per outage
// rather than on every tick.
export function useSkillsHuntNotifications() {
  const [notifications, setNotifications] = useState<SkillsHuntNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollFailing = useRef(false);

  useEffect(() => {
    let canceled = false;
    function pollFailed(err: unknown, message: string) {
      if (!pollFailing.current) reportError(err, { area: "skills-hunt", op: "notifications_poll" });
      pollFailing.current = true;
      setError(message);
    }
    async function load() {
      try {
        const res = await fetch("/api/skills-hunt/notifications");
        if (canceled) return;
        if (!res.ok) {
          const message = await failedReadMessage(res, "status updates");
          if (!canceled) pollFailed(new Error(`notifications read answered ${res.status}: ${message}`), message);
          return;
        }
        const data = (await res.json()) as { notifications: SkillsHuntNotification[] };
        if (canceled) return;
        pollFailing.current = false;
        setError(null);
        setNotifications(data.notifications);
      } catch (err) {
        if (!canceled) pollFailed(err, "Unable to load status updates. Check your connection.");
      }
    }
    void load();
    // A background tab skips its ticks and catches up when shown.
    const stopPoll = startVisibleInterval(() => void load(), 30_000);
    return () => { canceled = true; stopPoll(); };
  }, []);

  // Marked read on screen only once the route has recorded it; otherwise the item would turn
  // unread again on the next poll with no explanation.
  async function markRead(notificationId: string) {
    try {
      const res = await fetch(`/api/skills-hunt/notifications/${notificationId}/read`, { method: "POST", headers: { "x-ctf-csrf": "1" } });
      if (!res.ok) {
        const message = await routeFailureMessage(res, `Unable to mark this update as read (HTTP ${res.status}).`);
        reportError(new Error(`notification mark-read answered ${res.status}: ${message}`), { area: "skills-hunt", op: "notification_mark_read" });
        setError(message);
        return;
      }
      setError(null);
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
    } catch (err) {
      reportError(err, { area: "skills-hunt", op: "notification_mark_read" });
      setError("Unable to mark this update as read. Check your connection and try again.");
    }
  }

  return { notifications, error, markRead };
}
