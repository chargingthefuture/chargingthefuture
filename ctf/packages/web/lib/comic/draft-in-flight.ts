// One AI draft per review item at a time. A RunPod cold start can take minutes, and every job sent
// is billed, so a second "Generate draft" press — or a press while the ask-time draft is still
// running — joins the draft already underway instead of sending the model a second job.
// Process-local: the web service runs as one instance, and a restart drops the drafts with it.

export type DraftOutcome = { attached: boolean; reason: string | null };

const draftsInFlight = new Map<string, Promise<DraftOutcome>>();

export function runDraftOnce(reviewId: string, run: () => Promise<DraftOutcome>): Promise<DraftOutcome> {
  const existing = draftsInFlight.get(reviewId);
  if (existing) return existing;
  const started = run().finally(() => {
    draftsInFlight.delete(reviewId);
  });
  draftsInFlight.set(reviewId, started);
  return started;
}
