"use client";

import { useEffect, useState } from "react";
import { failureText } from "lib/errors/client-failure";

// Owner-share consent state for the ClickLog shell (extracted per rule 116 to keep the shell
// under the function-length limit). shareDefault mirrors the member's stored global preference
// (GET/PUT /api/click-log/preferences); formShare is the per-incident choice for the incident
// currently being logged, seeded from the default. toggleIncident flips a single logged
// incident's share flag (PATCH /api/click-log/:id).
const LOAD_DEFAULT_FAILED =
  "Your sharing default could not be loaded, so new incidents are not shared unless you turn sharing on.";

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
      // A failed load leaves the opt-in default (not shared) in place. The member is told, because
      // every new incident is sent with an explicit sharedWithOwner, so the server never falls back
      // to the stored default and a saved "on" would otherwise be ignored without a word.
      try {
        const res = await fetch("/api/click-log/preferences");
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (!canceled) onError(body.error ? `${LOAD_DEFAULT_FAILED} (${body.error})` : LOAD_DEFAULT_FAILED);
          return;
        }
        const data = (await res.json()) as { shareWithOwner?: boolean };
        if (!canceled && typeof data.shareWithOwner === "boolean") {
          setShareDefault(data.shareWithOwner);
          setFormShare(data.shareWithOwner);
        }
      } catch (caught) {
        const text = failureText(caught, {
          area: "click-log",
          op: "preferences.load",
          fallback: LOAD_DEFAULT_FAILED,
          audience: "member",
        });
        if (!canceled) onError(text);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [onError]);

  async function setDefault(next: boolean): Promise<void> {
    setShareDefault(next);
    setFormShare(next);
    try {
      const res = await fetch("/api/click-log/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ shareWithOwner: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to save sharing preference");
      }
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
