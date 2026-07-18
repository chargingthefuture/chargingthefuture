"use client";

import { useEffect, useState } from "react";
import type { UnlockStatus } from "../../lib/unlock/types";
import { toDisplayStatus } from "./unlock-shared";
import { UnlockLoading } from "./unlock-loading";
import { UnlockSubmissionView } from "./unlock-submission-view";
import { UnlockStatusView } from "./unlock-status-view";

export function UnlockShell({ isAdmin }: { isAdmin?: boolean } = {}) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<UnlockStatus | null>(null);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus(initial = false): Promise<void> {
    if (initial) setLoading(true);
    try {
      const res = await fetch("/api/unlock/status", { cache: "no-store" });
      if (!res.ok) throw new Error("Unlock status unavailable.");
      const data = (await res.json()) as { ok: boolean; status: UnlockStatus };
      setStatus(data.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock status unavailable.");
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus(true);
  }, []);

  async function submit(quoraProfileUrl: string): Promise<void> {
    const trimmed = quoraProfileUrl.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock/submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoraProfileUrl: trimmed }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Submission failed.");
      }
      setUrl("");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <UnlockLoading />;

  if (!status?.hasSubmission) {
    return (
      <UnlockSubmissionView
        url={url}
        onUrlChange={setUrl}
        onSubmit={() => void submit(url)}
        submitting={submitting}
        error={error}
        isAdmin={isAdmin}
      />
    );
  }

  return (
    <UnlockStatusView
      status={toDisplayStatus(status.reviewStatus)}
      resubmitUrl={url}
      onResubmitUrlChange={setUrl}
      onResubmit={() => void submit(url)}
      submitting={submitting}
      error={error}
      isAdmin={isAdmin}
    />
  );
}
