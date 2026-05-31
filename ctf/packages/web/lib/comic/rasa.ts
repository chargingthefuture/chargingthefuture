// Interim Rasa client for the @comic assistant.
//
// Rasa is NOT deployed yet. Until `RASA_BASE_URL` is configured, `isRasaConfigured()` returns
// false, which the policy layer uses to FORCE human review of every @comic draft: with no real
// NLU confidence we cannot safely auto-publish, so the bot drafts via Ollama and the draft is
// enqueued to the review queue rather than returned to the asker.
//
// When Rasa lands, set `RASA_BASE_URL` and implement `parseMessage` to call the Rasa HTTP API
// (`/model/parse`) so the policy can branch on a real, calibratable confidence.

const RASA_BASE_URL = process.env.RASA_BASE_URL ?? '';
export const RASA_MODEL = process.env.RASA_MODEL ?? '';

export type RasaParseResult = {
  intent: string | null;
  confidence: number | null;
  entities: Array<{ entity: string; value: string }>;
};

export function isRasaConfigured(): boolean {
  return RASA_BASE_URL.trim().length > 0;
}

// Placeholder until Rasa is deployed. Returns null (no NLU signal) while unconfigured so the
// policy keeps forcing human review. Implement the real `/model/parse` call when RASA_BASE_URL
// is set.
export async function parseMessageWithRasa(body: string): Promise<RasaParseResult | null> {
  if (!isRasaConfigured() || body.trim().length === 0) {
    return null;
  }

  // Not implemented yet — Rasa service is not deployed. Returning null keeps the human-review
  // path active even if the env var is set before the service is actually reachable.
  // TODO(rasa): POST `body` to `${RASA_BASE_URL}/model/parse` and map intent/confidence/entities.
  return null;
}
