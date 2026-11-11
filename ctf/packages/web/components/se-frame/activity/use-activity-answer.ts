'use client';

import { useState } from 'react';
import type { SeActivityButton } from '@ctf/shared';
import { reportError } from 'lib/observability/report';

// One inline answer on a notice in Needs you: post to its route, then say what was done or why it
// failed. The notice is marked read once the answer is saved, so it leaves Needs you next visit.

export type AnswerStatus = { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

async function send(button: SeActivityButton & { path: string }): Promise<string | null> {
  try {
    const res = await fetch(button.path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: JSON.stringify(button.body),
    });
    if (res.ok) return null;
    const answer = (await res.json().catch(() => null)) as { message?: unknown } | null;
    return typeof answer?.message === 'string' ? `${button.failed} ${answer.message}` : `${button.failed} (HTTP ${res.status})`;
  } catch (error) {
    reportError(error, { area: 'activity', op: 'answer' });
    return `${button.failed} The request did not reach the server.`;
  }
}

export function useActivityAnswer(onSaved: (_keepShown: boolean) => void) {
  const [status, setStatus] = useState<AnswerStatus>({ kind: 'idle' });
  const answer = async (button: SeActivityButton) => {
    if (!button.path) {
      onSaved(false);
      return;
    }
    setStatus({ kind: 'busy', label: button.label });
    const error = await send({ ...button, path: button.path });
    setStatus(error ? { kind: 'error', text: error } : { kind: 'done', text: button.done });
    if (!error) onSaved(true);
  };
  return { status, answer };
}
