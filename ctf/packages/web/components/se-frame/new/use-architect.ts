'use client';

import { useCallback, useEffect, useState } from 'react';
import { SE_ARCHITECT_WORDS as W, seArchitectMessage, type SeArchitectItem } from '@ctf/shared';

// The member's own questions to the assistant and their answers, through the assistant's own routes
// (/api/comic/conversation, /api/comic/message, /api/comic/answers/[turnId]/rate). An answer appears
// only after a person approved or corrected it; until then the question shows as being checked.

const CSRF = { 'content-type': 'application/json', 'x-ctf-csrf': '1' };

async function messageOf(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === 'string' ? `${fallback} ${body.message}` : `${fallback} (HTTP ${res.status})`;
}

export function useArchitect() {
  const [items, setItems] = useState<SeArchitectItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/comic/conversation?limit=20', { cache: 'no-store' }).catch(() => null);
    if (!res) return setLoadError(`${W.loadFailed} The app could not be reached.`);
    if (!res.ok) return setLoadError(await messageOf(res, W.loadFailed));
    const body = (await res.json().catch(() => null)) as { items?: SeArchitectItem[] } | null;
    setLoadError(null);
    setItems(body?.items ?? []);
  }, []);

  useEffect(() => void load(), [load]);

  const ask = useCallback(
    async (question: string): Promise<string | null> => {
      const res = await fetch('/api/comic/message', {
        method: 'POST',
        headers: CSRF,
        body: JSON.stringify({ body: seArchitectMessage(question), channel: 'commons', consentGranted: true }),
      }).catch(() => null);
      if (!res) return `${W.failed} The app could not be reached.`;
      if (!res.ok) return messageOf(res, W.failed);
      await load();
      return null;
    },
    [load],
  );

  const rate = useCallback(async (turnId: string, rating: 'helpful' | 'not_helpful'): Promise<string | null> => {
    const res = await fetch(`/api/comic/answers/${encodeURIComponent(turnId)}/rate`, {
      method: 'POST',
      headers: CSRF,
      body: JSON.stringify({ rating }),
    }).catch(() => null);
    if (!res) return `${W.rateFailed} The app could not be reached.`;
    if (!res.ok) return messageOf(res, W.rateFailed);
    setItems((current) => current?.map((item) => (item.answerTurnId === turnId ? { ...item, currentUserRating: rating } : item)) ?? null);
    return null;
  }, []);

  return { items, loadError, ask, rate, reload: load };
}
