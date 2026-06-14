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
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[ollama] Request timed out', { model: OLLAMA_MODEL, timeoutMs: OLLAMA_TIMEOUT_MS });
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Shape of RunPod's job-status payload (only the fields we read). The worker
// handler (ctf/ops/runpod-ollama/handler.py or the equivalent in the worker repo)
// returns { content, model } as the job output.
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
          // Only pin the model when the deployment explicitly set OLLAMA_MODEL. Otherwise let the
          // RunPod worker use its own baked default (e.g. qwen2.5:32b) rather than forcing the
          // web-side fallback (llama3.2), which the worker may not have.
          ...(process.env.OLLAMA_MODEL ? { model: process.env.OLLAMA_MODEL } : {}),
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

    let job = (await runResponse.json()) as RunpodJobResponse;

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

    if (job.status !== 'COMPLETED') {
      console.error('[ollama/runpod] job did not complete', { status: job.status, latencyMs: Date.now() - startedAt });
      throw new Error(`ollama_runpod_${(job.status ?? 'unknown').toLowerCase()}`);
    }

    const content = job.output?.content?.trim();
    if (!content) {
      console.error('[ollama/runpod] empty job output', { model: OLLAMA_MODEL, latencyMs: Date.now() - startedAt });
      throw new Error('ollama_empty_response');
    }

    return {
      content,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[ollama/runpod] Request timed out', { model: OLLAMA_MODEL, timeoutMs: OLLAMA_TIMEOUT_MS });
    }
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
