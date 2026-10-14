// Foundation API client (mobile) — the instant 1:1 call routes and what the call screens need.
//
// Mirrors the web call flow (ctf/packages/web/components/foundation/foundation-instant-call.tsx and
// foundation-connect-now.tsx). Every call goes through authedFetch, which sends the Clerk token as a
// Bearer header; every POST sends `x-ctf-csrf: 1`, which the Foundation mutation routes require
// (ensureMutationCsrf in web lib/foundation/_lib.ts accepts a request with no Origin header).
//
//   - GET  /api/foundation/connections/incoming-call                 the one live ring to this member, if any
//   - GET  /api/foundation/connections/instant-calls/[callId]         call state, plus Stream credentials once answered
//   - POST /api/foundation/connections/instant-calls/[callId]/answer  callee answers
//   - POST /api/foundation/connections/instant-calls/[callId]/decline callee declines
//   - POST /api/foundation/connections/instant-calls/[callId]/end     either side hangs up (or the caller cancels)
//   - POST /api/foundation/connections/instant-calls/[callId]/extend  caller adds one block
//   - POST /api/foundation/connections/threads/[threadId]/instant-call { authorizedBlocks } — ring
import { authedFetch } from '../../auth/authedFetch';

export type RingStatus = 'none' | 'ringing' | 'answered' | 'declined' | 'timed_out' | 'ended';

// The fields of the server's call row (FoundationInstantCall in web lib/foundation/types.ts) the app reads.
export type InstantCall = {
  id: string;
  threadId: string;
  callerUserId: string;
  calleeUserId: string;
  ringStatus: RingStatus;
  streamCallId: string;
  answeredAtIso: string | null;
  authorizedBlocks: number | null;
  blocksCharged: number;
  paidThroughAtIso: string | null;
  rateCreditsLocked: number | null;
  intervalMinutesLocked: number | null;
  endedReason: string | null;
};

export type CallState = {
  call: InstantCall;
  role: 'caller' | 'callee';
  streamApiKey: string | null;
  streamUserId: string | null;
  streamToken: string | null;
  streamCallId: string;
};

export type CallResult = { ok: true; call: InstantCall } | { ok: false; error: string };

// The same default and ceiling as the web picker (FOUNDATION_INSTANT_CALL_DEFAULT_AUTHORIZED_BLOCKS and
// FOUNDATION_INSTANT_CALL_MAX_AUTHORIZED_BLOCKS in web lib/foundation/constants.ts).
export const DEFAULT_AUTHORIZED_BLOCKS = 6;
export const BLOCK_CAP_OPTIONS = [1, 2, 3, 4, 6, 8, 12, 24];

const JSON_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

// The four codes the web gives their own plain sentence; everything else shows the route's message,
// with the reference an unexpected failure carries so a screenshot ties to the server's error report.
const CODE_TEXT: Record<string, string> = {
  FOUNDATION_RATE_LIMIT_EXCEEDED: 'Too many call attempts — wait a moment and try again.',
  FOUNDATION_CALLEE_BUSY: 'This person already has an incoming call. Try again shortly.',
};

type ErrorBody = { code?: string; message?: string; reference?: string };

function textForBody(body: ErrorBody, fallback: string): string {
  if (body.code && CODE_TEXT[body.code]) return CODE_TEXT[body.code];
  if (body.code === 'FOUNDATION_CALL_INSUFFICIENT_FUNDS') {
    return body.message || 'You do not have enough ServiceCredits for this call.';
  }
  if (body.code === 'FOUNDATION_CALL_BLOCK_CAP_REACHED') {
    return body.message || 'You have reached the number of blocks you authorized for this call.';
  }
  const text = body.message || fallback;
  return body.reference ? `${text} [ref ${body.reference}]` : text;
}

export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    return textForBody((await res.json()) as ErrorBody, fallback);
  } catch {
    // no-trace: the body was not JSON (a proxy page or an empty answer); the status says what we know
    return `${fallback} (status ${res.status}).`;
  }
}

function networkText(fallback: string, error: unknown): string {
  return `${fallback}: ${error instanceof Error ? error.message : 'the request did not reach the server'}.`;
}

async function postCall(path: string, body: unknown, fallback: string): Promise<CallResult> {
  try {
    const res = await authedFetch(path, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: await readError(res, fallback) };
    const data = (await res.json()) as { call?: InstantCall };
    return data.call ? { ok: true, call: data.call } : { ok: false, error: `${fallback}: the answer had no call.` };
  } catch (error) {
    return { ok: false, error: networkText(fallback, error) };
  }
}

export type CallAction = 'answer' | 'decline' | 'end' | 'extend';

const ACTION_FALLBACK: Record<CallAction, string> = {
  answer: 'Could not update the call.',
  decline: 'Could not update the call.',
  end: 'Could not update the call.',
  extend: 'Could not extend the call.',
};

export function postCallAction(callId: string, action: CallAction): Promise<CallResult> {
  const path = `/api/foundation/connections/instant-calls/${encodeURIComponent(callId)}/${action}`;
  return postCall(path, undefined, ACTION_FALLBACK[action]);
}

// Opens (or reuses) the Direct Line thread with a provider, then rings it — the web startCall's two
// steps, so a closed thread is replaced the same way it is on the web.
export async function ringProvider(providerProfileId: string, authorizedBlocks: number): Promise<CallResult> {
  const fallback = 'Could not open a connection with this provider.';
  let threadId: string | undefined;
  try {
    const res = await authedFetch('/api/foundation/connections/threads', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ providerId: providerProfileId }),
    });
    if (!res.ok) return { ok: false, error: await readError(res, fallback) };
    threadId = ((await res.json()) as { thread?: { id?: string } }).thread?.id;
  } catch (error) {
    return { ok: false, error: networkText(fallback, error) };
  }
  if (!threadId) return { ok: false, error: 'Connection response was incomplete.' };
  const path = `/api/foundation/connections/threads/${encodeURIComponent(threadId)}/instant-call`;
  return postCall(path, { authorizedBlocks }, 'Could not start the call.');
}

// The one live ring to this member, or null. Throws on a failed read so the caller can retry.
export async function fetchIncomingRing(): Promise<InstantCall | null> {
  const res = await authedFetch('/api/foundation/connections/incoming-call', { method: 'GET' });
  if (!res.ok) throw new Error(await readError(res, 'Could not check for incoming calls.'));
  const data = (await res.json()) as { call?: InstantCall | null };
  return data.call ?? null;
}

// The call's state, or null when it no longer exists for this member (404). Throws on any other failure.
export async function fetchCallState(callId: string): Promise<CallState | null> {
  const res = await authedFetch(`/api/foundation/connections/instant-calls/${encodeURIComponent(callId)}`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res, 'Could not load the call.'));
  const data = (await res.json()) as Partial<CallState>;
  if (!data.call) throw new Error('The call state answered without a call.');
  return {
    call: data.call,
    role: data.role ?? 'callee',
    streamApiKey: data.streamApiKey ?? null,
    streamUserId: data.streamUserId ?? null,
    streamToken: data.streamToken ?? null,
    streamCallId: data.streamCallId || data.call.streamCallId,
  };
}

export function creditsLabel(count: number): string {
  return count === 1 ? '1 ServiceCredit' : `${count} ServiceCredits`;
}

export function blocksLabel(count: number): string {
  return count === 1 ? '1 block' : `${count} blocks`;
}

export function rateLabel(rateCredits: number, intervalMinutes: number): string {
  return `${creditsLabel(rateCredits)} / ${intervalMinutes} min`;
}

export async function subscribeExpoPush(token: string): Promise<void> {
  const res = await authedFetch('/api/foundation/push/subscribe', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind: 'expo', token, userAgent: 'Skills Economy Android app' }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Could not save your call alerts.'));
}

export async function unsubscribeExpoPush(token: string): Promise<void> {
  const res = await authedFetch('/api/foundation/push/unsubscribe', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ endpoint: token }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Could not turn off your call alerts.'));
}
