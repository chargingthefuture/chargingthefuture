const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? '';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';
const OLLAMA_TIMEOUT_MS = 30_000;

// Optional bearer token for reaching the Ollama host. Empty when the host is the
// private-network Render service (ctf-ollama), which needs no auth. When Ollama is
// moved to an external GPU host reachable over the internet, that host must sit
// behind a gateway/proxy that checks this token — Ollama itself has no auth — and
// OLLAMA_API_KEY is set on the web service so every request carries it. Backward
// compatible: unset → no Authorization header → today's behavior, unchanged.
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY ?? '';

function ollamaHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (OLLAMA_API_KEY.length > 0) {
    headers.Authorization = `Bearer ${OLLAMA_API_KEY}`;
  }
  return headers;
}

// When OLLAMA_BASE_URL points at a RunPod serverless endpoint
// (https://api.runpod.ai/v2/<id>), the host speaks RunPod's job API, not
// Ollama's native /api/chat. Detect that and route through the job API instead.
// OLLAMA_API_KEY carries the RunPod API key in that case.
const RUNPOD_API_HOST = 'api.runpod.ai';

function ollamaProviderIsRunpod(): boolean {
  try {
    return new URL(OLLAMA_BASE_URL).hostname.endsWith(RUNPOD_API_HOST);
  } catch {
    return false;
  }
}

export type OllamaMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OllamaChatResponse = {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
};

export type OllamaResult = {
  content: string;
  latencyMs: number;
};

export function isOllamaConfigured(): boolean {
  return OLLAMA_BASE_URL.length > 0;
}

// Lightweight liveness probe for the admin status panel. No inference, short timeout, never throws.
// A RunPod serverless endpoint answers `GET /health`; a native Ollama host answers `GET /api/tags`.
// Reuses ollamaHeaders() so the RunPod bearer (OLLAMA_API_KEY) is attached when needed.
export type OllamaPing = {
  configured: boolean;
  reachable: boolean;
  latencyMs: number | null;
  model: string;
  provider: 'runpod' | 'native' | null;
  // Why it is not reachable, so the admin can fix the right thing (e.g. "HTTP 401 — check
  // OLLAMA_API_KEY", "HTTP 404 — check OLLAMA_BASE_URL / endpoint id", "timeout (5s)"). Null when
  // reachable.
  detail: string | null;
};

// Non-2xx: name the likely fix so a real outage is distinguishable from a config mistake.
function pingStatusHint(status: number): string {
  if (status === 401 || status === 403) {
    return ' — check OLLAMA_API_KEY (the RunPod API key)';
  }
  if (status === 404) {
    return ' — check OLLAMA_BASE_URL / the endpoint id';
  }
  return '';
}

function pingCatchDetail(err: unknown): string {
  return err instanceof Error && err.name === 'AbortError'
    ? 'timeout (5s) — endpoint cold or unreachable'
    : 'network error reaching the endpoint';
}

export async function pingOllama(): Promise<OllamaPing> {
  if (!isOllamaConfigured()) {
    return { configured: false, reachable: false, latencyMs: null, model: OLLAMA_MODEL, provider: null, detail: 'OLLAMA_BASE_URL is not set' };
  }
  const provider: 'runpod' | 'native' = ollamaProviderIsRunpod() ? 'runpod' : 'native';
  const base = OLLAMA_BASE_URL.replace(/\/$/, '');
  const url = provider === 'runpod' ? `${base}/health` : `${base}/api/tags`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, { headers: ollamaHeaders(), signal: controller.signal });
    const latencyMs = Date.now() - startedAt;
    if (response.ok) {
      return { configured: true, reachable: true, latencyMs, model: OLLAMA_MODEL, provider, detail: null };
    }
    const hint = pingStatusHint(response.status);
    return { configured: true, reachable: false, latencyMs, model: OLLAMA_MODEL, provider, detail: `HTTP ${response.status}${hint}` };
  } catch (err) {
    const detail = pingCatchDetail(err);
    return { configured: true, reachable: false, latencyMs: null, model: OLLAMA_MODEL, provider, detail };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Shared abort-timeout log for the native and RunPod chat paths. Only logs on an AbortError so the
// caller's blanket rethrow keeps identical behavior; `tag` distinguishes the two log lines.
function logAbortTimeout(err: unknown, tag: string): void {
  if (err instanceof Error && err.name === 'AbortError') {
    console.error(`${tag} Request timed out`, { model: OLLAMA_MODEL, timeoutMs: OLLAMA_TIMEOUT_MS });
  }
}

export async function callOllamaChat(messages: OllamaMessage[]): Promise<OllamaResult> {
  if (!isOllamaConfigured()) {
    throw new Error('ollama_not_configured');
  }

  if (ollamaProviderIsRunpod()) {
    return callRunpodChat(messages);
  }

  const url = `${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`;
  const startedAt = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: ollamaHeaders(),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.4,
          num_predict: 600,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('[ollama] HTTP error', { status: response.status, model: OLLAMA_MODEL, latencyMs: Date.now() - startedAt });
      throw new Error(`ollama_http_error:${response.status}`);
    }

    const data = await response.json() as OllamaChatResponse;

    if (!data.message?.content) {
      console.error('[ollama] Empty response', { model: OLLAMA_MODEL, latencyMs: Date.now() - startedAt });
      throw new Error('ollama_empty_response');
    }

    return {
      content: data.message.content.trim(),
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    logAbortTimeout(err, '[ollama]');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Turn an error thrown by callOllamaChat into a short, admin-facing reason, so a failed draft can
// say WHY (timeout / model-not-found / auth / engine error) instead of a blanket "unreachable".
// Plain language for the review dashboard note; the raw code is still logged server-side. This is
// why the health probe (pingOllama) and a real draft can disagree: the probe only checks the
// endpoint is alive, while a draft must load and run the model, which can 404 (model not pulled) or
// time out on a cold start even though the endpoint answers the probe.
// Plain-language reason for an `ollama_http_error:<status>` code, split out so describeOllamaFailure
// stays readable. Identical text per status as before.
function describeHttpError(status: number): string {
  if (status === 404) {
    return 'The engine returned 404 — the model or endpoint was not found. Check the model is pulled on the endpoint (OLLAMA_MODEL) and OLLAMA_BASE_URL.';
  }
  if (status === 401 || status === 403) {
    return 'The engine rejected the request (auth) — check OLLAMA_API_KEY.';
  }
  if (status >= 500) {
    return `The engine returned an error (HTTP ${status}). Try again shortly.`;
  }
  return `The engine returned HTTP ${Number.isFinite(status) ? status : 'error'}.`;
}

export function describeOllamaFailure(err: unknown): string {
  if (err instanceof Error && err.name === 'AbortError') {
    return `The engine did not respond within ${Math.round(OLLAMA_TIMEOUT_MS / 1000)}s — the model may still be loading (a cold start). Try again in a moment.`;
  }
  const code = err instanceof Error ? err.message : '';
  if (code === 'ollama_not_configured') {
    return 'The drafting engine is not configured (OLLAMA_BASE_URL is not set).';
  }
  if (code.startsWith('ollama_http_error:')) {
    const status = Number(code.slice('ollama_http_error:'.length));
    return describeHttpError(status);
  }
  if (code === 'ollama_empty_response') {
    return 'The engine returned an empty response. Try again.';
  }
  if (code === 'ollama_runpod_no_job_id') {
    return 'The engine did not start a job. Try again.';
  }
  if (code.startsWith('ollama_runpod_')) {
    const state = code.slice('ollama_runpod_'.length).replace(/_/g, ' ');
    return `The engine job did not complete (${state}). Try again.`;
  }
  return 'Could not reach the engine (network error). Try again once it is back up.';
}

// Shape of RunPod's job-status payload (only the fields we read). The worker
// handler — in the dedicated RunPod worker repo (ctf/Runpod), see
// ctf/docs/developer/OLLAMA.md — returns { content, model } as the job output.
type RunpodJobResponse = {
  id?: string;
  status?: string;
  output?: { content?: string; model?: string } | null;
};

const RUNPOD_TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);
const RUNPOD_POLL_INTERVAL_MS = 1_500;

// Talk to a RunPod serverless endpoint: submit the chat as a job, then poll until
// it finishes. The whole exchange shares one OLLAMA_TIMEOUT_MS budget, so a slow
// cold start aborts the same way the native path does — the caller then falls back
// to the template draft and a human still answers. The endpoint base is
// OLLAMA_BASE_URL (e.g. https://api.runpod.ai/v2/<id>); OLLAMA_API_KEY is the
// RunPod API key, sent as the bearer by ollamaHeaders().
// Only pin the model when the deployment explicitly set OLLAMA_MODEL. Otherwise let the
// RunPod worker use its own baked default (e.g. qwen2.5:32b) rather than forcing the
// web-side fallback (llama3.2), which the worker may not have.
function runpodModelInput(): Record<string, string> {
  return process.env.OLLAMA_MODEL ? { model: process.env.OLLAMA_MODEL } : {};
}

// Poll a submitted RunPod job until it reaches a terminal status, returning the final job payload.
// Shares the caller's abort controller and timeout budget so a slow cold start aborts identically.
async function pollRunpodJob(
  base: string,
  initialJob: RunpodJobResponse,
  controller: AbortController,
  startedAt: number,
): Promise<RunpodJobResponse> {
  let job = initialJob;
  while (!RUNPOD_TERMINAL_STATUSES.has(job.status ?? '')) {
    if (!job.id) {
      throw new Error('ollama_runpod_no_job_id');
    }
    await new Promise((resolve) => setTimeout(resolve, RUNPOD_POLL_INTERVAL_MS));
    const statusResponse = await fetch(`${base}/status/${job.id}`, {
      method: 'GET',
      headers: ollamaHeaders(),
      signal: controller.signal,
    });
    if (!statusResponse.ok) {
      console.error('[ollama/runpod] status HTTP error', { status: statusResponse.status, latencyMs: Date.now() - startedAt });
      throw new Error(`ollama_http_error:${statusResponse.status}`);
    }
    job = (await statusResponse.json()) as RunpodJobResponse;
  }
  return job;
}

// Extract the completed job's content, throwing the same error codes as before when the job did not
// complete or produced no content.
function runpodJobContent(job: RunpodJobResponse, startedAt: number): string {
  if (job.status !== 'COMPLETED') {
    console.error('[ollama/runpod] job did not complete', { status: job.status, latencyMs: Date.now() - startedAt });
    throw new Error(`ollama_runpod_${(job.status ?? 'unknown').toLowerCase()}`);
  }
  const content = job.output?.content?.trim();
  if (!content) {
    console.error('[ollama/runpod] empty job output', { model: OLLAMA_MODEL, latencyMs: Date.now() - startedAt });
    throw new Error('ollama_empty_response');
  }
  return content;
}

async function callRunpodChat(messages: OllamaMessage[]): Promise<OllamaResult> {
  const base = OLLAMA_BASE_URL.replace(/\/$/, '');
  const startedAt = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const runResponse = await fetch(`${base}/run`, {
      method: 'POST',
      headers: ollamaHeaders(),
      body: JSON.stringify({
        input: {
          ...runpodModelInput(),
          messages,
          options: {
            temperature: 0.4,
            num_predict: 600,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!runResponse.ok) {
      console.error('[ollama/runpod] submit HTTP error', { status: runResponse.status, latencyMs: Date.now() - startedAt });
      throw new Error(`ollama_http_error:${runResponse.status}`);
    }

    const initialJob = (await runResponse.json()) as RunpodJobResponse;
    const job = await pollRunpodJob(base, initialJob, controller, startedAt);
    const content = runpodJobContent(job, startedAt);

    return {
      content,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    logAbortTimeout(err, '[ollama/runpod]');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const SURVIVOR_SYSTEM_PROMPT = `You are a knowledgeable, compassionate assistant for survivors on the ChargingTheFuture (CTF) platform. CTF is a survivor-centered ecosystem that helps people access housing, services, safety resources, and community support.

Guidelines:
- Provide clear, practical, survivor-safe guidance.
- Prioritize safety. Never share details that could expose a survivor's location or identity.
- Keep responses concise (3-6 sentences) and focused on the most immediate next step.
- When referencing resources, prefer CTF platform tools: Directory, LightHouse, Foundation, TrustTransport, and Feed community.
- Do not recommend unverified outside links or contacts.
- Use plain, accessible language without jargon.
- If a question involves immediate danger, lead with safety escalation guidance first.`;
