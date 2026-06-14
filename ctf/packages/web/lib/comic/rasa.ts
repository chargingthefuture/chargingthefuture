// Rasa NLU client for the @comic "AI Assistant".
//
// `ctf-rasa` is a private, self-hosted Rasa 3.x NLU service (see ctf/ops/rasa/ and
// ctf/docs/developer/RASA.md). It exposes the stateless `POST /model/parse` endpoint, which
// classifies an inbound question into one of the comic intent categories and returns a
// calibratable confidence. This module wraps that endpoint defensively (timeout + try/catch),
// mirroring lib/chatbot/ollama.ts.
//
// SAFETY POSTURE — UNCHANGED. Rasa here only supplies a REAL intent + confidence to label each
// @comic turn (for the reviewer's display and for better training data). It does NOT gate
// auto-publish: `policy.forceHumanReview()` still forces EVERY answer through human review. The
// integration is also graceful: if `RASA_BASE_URL` is unset, `isRasaConfigured()` is false and no
// Rasa call is made; if the service errors or times out, the parse returns nulls and routing
// continues unchanged.

const RASA_BASE_URL = process.env.RASA_BASE_URL ?? '';
// Informational label only; the served model is whatever was baked into the ctf-rasa image. Not
// required for the integration to function.
export const RASA_MODEL = process.env.RASA_MODEL ?? '';
const RASA_TIMEOUT_MS = 8_000;

// Coarse intent + confidence for a single @comic turn. Both null when Rasa is unconfigured or the
// parse fails for any reason — callers must treat null as "no NLU signal" and degrade gracefully.
export type ComicIntentResult = {
  intent: string | null;
  confidence: number | null;
};

// Richer parse shape (adds entities) for callers that want the full NLU payload. Entities are not
// consumed by the comic backend yet but are surfaced here for forward compatibility.
export type RasaParseResult = {
  intent: string | null;
  confidence: number | null;
  entities: Array<{ entity: string; value: string }>;
};

// Shape of the relevant fields of Rasa's `POST /model/parse` response. Everything is optional so a
// malformed/partial payload degrades to nulls rather than throwing.
type RasaParseResponse = {
  intent?: {
    name?: string | null;
    confidence?: number | null;
  } | null;
  entities?: Array<{
    entity?: string | null;
    value?: unknown;
  }> | null;
};

export function isRasaConfigured(): boolean {
  return RASA_BASE_URL.trim().length > 0;
}

// Lightweight liveness probe for admin status panels. Hits the same `POST /model/parse` the app
// uses (with a trivial text), so "reachable" reflects the real path. Short timeout; never throws.
export async function pingRasa(): Promise<{ configured: boolean; reachable: boolean; latencyMs: number | null }> {
  if (!isRasaConfigured()) {
    return { configured: false, reachable: false, latencyMs: null };
  }
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${RASA_BASE_URL.replace(/\/$/, '')}/model/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'ping' }),
      signal: controller.signal,
    });
    return { configured: true, reachable: response.ok, latencyMs: Date.now() - startedAt };
  } catch {
    return { configured: true, reachable: false, latencyMs: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

function toFiniteNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeIntentName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapEntities(
  entities: RasaParseResponse['entities'],
): Array<{ entity: string; value: string }> {
  if (!Array.isArray(entities)) {
    return [];
  }
  const mapped: Array<{ entity: string; value: string }> = [];
  for (const item of entities) {
    const entity = normalizeIntentName(item?.entity);
    if (entity === null) {
      continue;
    }
    mapped.push({ entity, value: String(item?.value ?? '') });
  }
  return mapped;
}

// Call Rasa `POST /model/parse` with the raw question text. Returns the full parse (intent +
// confidence + entities) or null on any failure. Defensive throughout: aborts on timeout and never
// throws to the caller.
export async function parseMessageWithRasa(body: string): Promise<RasaParseResult | null> {
  if (!isRasaConfigured() || body.trim().length === 0) {
    return null;
  }

  const url = `${RASA_BASE_URL.replace(/\/$/, '')}/model/parse`;
  const startedAt = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RASA_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('[comic/rasa] HTTP error', { status: response.status, latencyMs: Date.now() - startedAt });
      return null;
    }

    const data = (await response.json()) as RasaParseResponse;

    return {
      intent: normalizeIntentName(data.intent?.name),
      confidence: toFiniteNumberOrNull(data.intent?.confidence),
      entities: mapEntities(data.entities),
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[comic/rasa] Request timed out', { timeoutMs: RASA_TIMEOUT_MS });
    } else {
      console.error('[comic/rasa] Parse failed', err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Convenience wrapper used by the message router: returns just `{ intent, confidence }`, both null
// on any failure (unconfigured, network error, timeout, malformed payload). The router stores these
// on the user turn so the reviewer sees a real NLU label. NEVER throws.
export async function parseComicIntent(text: string): Promise<ComicIntentResult> {
  const parsed = await parseMessageWithRasa(text);
  if (parsed === null) {
    return { intent: null, confidence: null };
  }
  return { intent: parsed.intent, confidence: parsed.confidence };
}
