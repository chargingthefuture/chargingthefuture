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

export const SURVIVOR_SYSTEM_PROMPT = `You are a knowledgeable, compassionate assistant for survivors on the ChargingTheFuture (CTF) platform. CTF is a survivor-centered ecosystem that helps people access housing, services, safety resources, and community support.

Guidelines:
- Provide clear, practical, survivor-safe guidance.
- Prioritize safety. Never share details that could expose a survivor's location or identity.
- Keep responses concise (3-6 sentences) and focused on the most immediate next step.
- When referencing resources, prefer CTF platform tools: Directory, LightHouse, Foundation, TrustTransport, and Feed community.
- Do not recommend unverified outside links or contacts.
- Use plain, accessible language without jargon.
- If a question involves immediate danger, lead with safety escalation guidance first.`;
