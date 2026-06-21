'use client';

import { useEffect, useState } from 'react';

// At-a-glance status of the chat AI's answer-drafting engine (Ollama, hosted on a RunPod
// serverless GPU endpoint in production). Shown on the admin landing so the owner sees whether
// the assistant is live without clicking into the @comic admin page or inferring it from canned
// answers. Read-only: it calls the admin-gated /api/comic/admin/ai-status probe once on mount.
type ServiceStatus = { configured: boolean; reachable: boolean; latencyMs: number | null; model: string; detail?: string | null };
type AiStatusResponse = { ok: true; ollama: ServiceStatus };

function describe(status: ServiceStatus | null, failed: boolean): { text: string; color: string } {
  if (failed) return { text: 'status unavailable', color: '#6B7280' };
  if (!status) return { text: 'checking…', color: '#6B7280' };
  if (!status.configured) return { text: status.detail ?? 'not configured', color: '#6B7280' };
  // When the endpoint answers with an error (e.g. 401 bad key, 404 wrong id) or times out, show the
  // reason so the owner fixes the right thing instead of guessing the engine is merely asleep.
  if (!status.reachable) return { text: status.detail ? `not responding · ${status.detail}` : 'asleep or not responding', color: '#EF4444' };
  return { text: `reachable${status.latencyMs !== null ? ` · ${status.latencyMs}ms` : ''}`, color: '#22C55E' };
}

export function AdminAiStatusBadge() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/comic/admin/ai-status', { cache: 'no-store' });
        if (!res.ok) throw new Error('ai_status_request_failed');
        const data = (await res.json()) as AiStatusResponse;
        if (!cancelled) setStatus(data.ollama);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { text, color } = describe(status, failed);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
        background: '#0d0f14', border: '1px solid #1e2a3a', marginBottom: 16, fontSize: 13,
      }}
      role="status"
      aria-label="Chat AI engine status"
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: '#9ca3af' }}>Chat AI engine (RunPod / Ollama):</span>
      <span style={{ color, fontWeight: 700 }}>{text}</span>
      {status?.model ? (
        <span style={{ color: '#4b5563', marginLeft: 'auto', fontSize: 12 }}>{status.model}</span>
      ) : null}
    </div>
  );
}
