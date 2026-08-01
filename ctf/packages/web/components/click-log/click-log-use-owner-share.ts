"use client";

import { useEffect, useState } from "react";

// Owner-share consent state for the ClickLog shell (extracted per rule 116 to keep the shell
// under the function-length limit). shareDefault mirrors the member's stored global preference
// (GET/PUT /api/click-log/preferences); formShare is the per-incident choice for the incident
// currently being logged, seeded from the default. toggleIncident flips a single logged
// incident's share flag (PATCH /api/click-log/:id).
export function useOwnerShare({
  onError,
  onBusy,
  refresh,
}: {
  onError: (message: string | null) => void;
  onBusy: (busy: boolean) => void;
  refresh: () => Promise<void>;
}) {
  const [shareDefault, setShareDefault] = useState(false);
  const [formShare, setFormShare] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch("/api/click-log/preferences");
        if (!res.ok) return;
        const data = (await res.json()) as { shareWithOwner?: boolean };
        if (!canceled && typeof data.shareWithOwner === "boolean") {
          setShareDefault(data.shareWithOwner);
          setFormShare(data.shareWithOwner);
        }
      } catch {
        // Preference fetch is non-critical — leave the opt-in default (not shared).
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  async function setDefault(next: boolean): Promise<void> {
    setShareDefault(next);
    setFormShare(next);
    try {
      const res = await fetch("/api/click-log/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ shareWithOwner: next }),
      });
      if (!res.ok) throw new Error("Failed to save sharing preference");
    } catch (e) {
      setShareDefault(!next);
      setFormShare(!next);
      onError(e instanceof Error ? e.message : "Failed to save sharing preference");
    }
  }

  async function toggleIncident(id: string, next: boolean): Promise<void> {
    onBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/click-log/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ sharedWithOwner: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to update sharing");
      }
      await refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to update sharing");
    } finally {
      onBusy(false);
    }
  }

  return { shareDefault, formShare, setFormShare, setDefault, toggleIncident };
}
