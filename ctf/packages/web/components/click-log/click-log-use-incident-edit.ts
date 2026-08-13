"use client";

import { useState } from "react";
import type { IncidentEditFields } from "./click-log-incident-editor";

// Per-incident edit state and the PUT call, extracted from the shell (mirroring
// click-log-use-owner-share) so ClickLogShell stays under the rule-116 function-length limit.
// Only the note and tags are sent — the date and location are immutable, so the body never
// carries coordinates. "" tags from the pickers become null (= untagged) for the API.
export function useIncidentEdit({
  onError,
  onBusy,
  refresh,
}: {
  onError: (message: string | null) => void;
  onBusy: (busy: boolean) => void;
  refresh: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  async function save(id: string, fields: IncidentEditFields): Promise<void> {
    onBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/click-log/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          notes: fields.notes,
          problemTag: fields.problemTag || null,
          schemeTag: fields.schemeTag || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to update incident");
      }
      setEditingId(null);
      await refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to update incident");
    } finally {
      onBusy(false);
    }
  }

  return {
    editingId,
    start: (id: string) => setEditingId(id),
    cancel: () => setEditingId(null),
    save,
  };
}
