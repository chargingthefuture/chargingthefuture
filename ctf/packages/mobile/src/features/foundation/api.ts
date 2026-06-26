// All calls go through authedFetch so the Clerk bearer token is attached and the
// base URL comes from runtime config (APP_URL) — same pattern as socketrelay/currency.
import { authedFetch, authedFetchJson } from '../../auth/authedFetch';

const BASE = '/api/foundation';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

// A skill a provider has opted to be contacted about (their own Directory skill flagged offered).
export interface OfferedSkill {
  id: string;
  name: string;
}

export interface Provider {
  profileId: string;
  providerUserId: string;
  displayName: string;
  headline?: string;
  bio?: string;
  // Skills this provider is willing to be contacted about. Always an array; empty when none.
  offeredSkills?: OfferedSkill[];
  // Read-only mirror of the provider's instant 1:1 call ("Connect now") settings (issue #808).
  // instantCallEnabled is their opt-in; instantCallRateCredits is whole ServiceCredits per block (only
  // meaningful when enabled); instantCallIntervalMinutes is the block length in minutes. These describe
  // availability only — the call lifecycle and any charge run server-side.
  instantCallEnabled?: boolean;
  instantCallRateCredits?: number | null;
  instantCallIntervalMinutes?: number;
  // score is internal — not rendered
}

// One of the member's own Directory skills, with whether they currently offer it through Foundation.
export interface OfferableSkill {
  id: string;
  name: string;
  offered: boolean;
}

export interface ProvidersSearchResult {
  ok: boolean;
  items: Provider[];
  total: number;
  pagination?: { page: number; pageSize: number };
  // The signed-in viewer's own user id, returned so the client can suppress the "Connect now"
  // action on the viewer's own provider card (you cannot ring yourself). Issue #808.
  viewerUserId?: string;
}

export interface QuoteHistoryItem {
  id: string;
  // The connection thread this quote belongs to. Carried so a Quotes row can re-open its Direct
  // Line (the chat channel is keyed by thread). Mirrors the web quote-history row's threadId.
  threadId?: string;
  providerId?: string;
  providerName?: string;
  status: string;
  createdAt?: string;
}

export interface QuoteHistoryResult {
  items: QuoteHistoryItem[];
}

// Stream credentials a member needs to connect to one connection thread's Direct Line channel.
// Mirrors the web DirectLineCredentials shape returned by the token route.
export interface DirectLineCredentials {
  streamApiKey: string;
  streamToken: string;
  streamUserId: string;
  streamChannelId: string;
}

// A failed Direct Line open, surfaced to the UI with a plain message. `code` is the server's
// FOUNDATION_* error code (kept for branching); `message` is the sentence shown to the member.
export interface DirectLineError {
  code: string | null;
  message: string;
}

export async function fetchProviders(
  query = '',
  page = 1,
  skillId?: string | null,
): Promise<ProvidersSearchResult> {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set('q', query);
  if (skillId) params.set('skillId', skillId);
  return authedFetchJson<ProvidersSearchResult>(`${BASE}/providers/search?${params.toString()}`);
}

// The signed-in member's own Directory skills, each flagged whether they currently offer it through
// Foundation. GET /api/foundation/provider/skills.
export async function fetchOfferableSkills(): Promise<OfferableSkill[]> {
  const data = await authedFetchJson<{ ok: boolean; skills: OfferableSkill[] }>(`${BASE}/provider/skills`);
  return data.skills ?? [];
}

// Replace the member's set of offered skills with `skillIds`. PUT /api/foundation/provider/skills.
// Returns the accepted (validated) offered skill ids.
export async function setOfferedSkills(skillIds: string[]): Promise<string[]> {
  const data = await authedFetchJson<{ ok: boolean; offeredSkillIds: string[] }>(`${BASE}/provider/skills`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ skillIds }),
  });
  return data.offeredSkillIds ?? [];
}

export async function fetchQuoteHistory(): Promise<QuoteHistoryResult> {
  return authedFetchJson<QuoteHistoryResult>(`${BASE}/quotes/history`);
}

export async function createConnectionThread(providerId: string): Promise<{ threadId: string; ok: boolean }> {
  return authedFetchJson<{ threadId: string; ok: boolean }>(`${BASE}/connections/threads`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ providerId }),
  });
}

// Re-mint fresh Stream credentials for an existing connection thread's Direct Line. Mirrors the web
// DirectLineFromThread call to GET /api/foundation/connections/threads/:threadId/token: the chat
// channel is created at Request-Quote time, and this hands the member credentials to connect to that
// already-existing channel. The server only succeeds when the caller is a participant of the thread,
// and it governs whether the thread is writable (a closed/terminal thread is read-only server-side) —
// the client does not invent any lifecycle gating. On failure this throws a DirectLineError-shaped
// reason (thrown via Object so the caller can read `code` to branch the message).
export async function fetchThreadDirectLineCredentials(threadId: string): Promise<DirectLineCredentials> {
  const res = await authedFetch(`${BASE}/connections/threads/${encodeURIComponent(threadId)}/token`);
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    code?: string;
    streamApiKey?: string;
    streamToken?: string;
    streamUserId?: string;
    streamChannelId?: string;
  };

  if (
    res.ok &&
    body.ok &&
    body.streamApiKey &&
    body.streamToken &&
    body.streamUserId &&
    body.streamChannelId
  ) {
    return {
      streamApiKey: body.streamApiKey,
      streamToken: body.streamToken,
      streamUserId: body.streamUserId,
      streamChannelId: body.streamChannelId,
    };
  }

  const error: DirectLineError = {
    code: body.code ?? null,
    message:
      body.code === 'FOUNDATION_NOT_THREAD_PARTICIPANT'
        ? "You don't have access to this Direct Line."
        : body.code === 'FOUNDATION_STREAM_UNAVAILABLE'
          ? 'The Direct Line is temporarily unavailable. Try again shortly.'
          : 'Could not open this Direct Line.',
  };
  throw error;
}

export async function requestQuote(threadId: string, serviceType = 'general'): Promise<{ ok: boolean }> {
  return authedFetchJson<{ ok: boolean }>(`${BASE}/quotes`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ threadId, serviceType }),
  });
}

// ---------------------------------------------------------------------------
// Instant 1:1 call ("Connect now") — ring/answer lifecycle + per-block billing
// (issue #808 tasks 3 and 4). Mobile is a display + REST client only: every
// charge and state transition runs server-side; the app shows the returned
// state and joins the audio room. The ring is delivered in-app by polling the
// endpoints below (Expo native push is a deferred follow-up), mirroring the web
// fallback. All POSTs carry the x-ctf-csrf header (JSON_HEADERS).
// ---------------------------------------------------------------------------

// Where a ringing/in-call call is in its lifecycle. Mirrors the web
// FoundationCallRingStatus: a ring moves ringing -> answered | declined |
// timed_out -> ended. 'answered' is the in-call state; 'ended' is terminal.
export type FoundationCallRingStatus =
  | 'none'
  | 'ringing'
  | 'answered'
  | 'declined'
  | 'timed_out'
  | 'ended';

// One member's view of an instant call (mirror of the web FoundationInstantCall).
// The caller tapped "Connect now"; the callee is the provider being rung. Per-block
// billing fields: authorizedBlocks is the buyer-set cap chosen at ring; blocksCharged
// is how many blocks have been paid; paidThroughAtIso is when the current prepaid
// block runs out (drives the countdown); rateCreditsLocked / intervalMinutesLocked
// are the rate + block length snapshotted at answer; endedReason explains a
// non-hang-up end ('caller_insufficient_funds', 'paid_window_elapsed',
// 'block_cap_reached').
export interface FoundationInstantCall {
  id: string;
  threadId: string;
  callerUserId: string;
  calleeUserId: string;
  ringStatus: FoundationCallRingStatus;
  streamCallId: string;
  ringExpiresAtIso: string | null;
  answeredAtIso: string | null;
  endedAtIso: string | null;
  endedByUserId: string | null;
  firstBlockCharged: boolean;
  rateCreditsLocked: number | null;
  intervalMinutesLocked: number | null;
  authorizedBlocks: number | null;
  blocksCharged: number;
  paidThroughAtIso: string | null;
  lastTransferId: string | null;
  endedReason: string | null;
  createdAtIso: string;
}

// What the client needs to join the audio room for an answered call, plus the
// caller/callee role. Mirrors the web FoundationInstantCallJoin. The GET state
// endpoint returns these fields flattened alongside the call (not nested), so the
// response type carries them directly. Stream fields are null until answered (and
// stay null when the Stream integration is not configured, e.g. demo/local).
export interface FoundationInstantCallStateResponse {
  ok: boolean;
  call?: FoundationInstantCall;
  role?: 'caller' | 'callee';
  streamApiKey?: string | null;
  streamUserId?: string | null;
  streamToken?: string | null;
  streamChannelId?: string;
}

// The incoming-ring inbox: the one live ring (if any) currently being placed to
// the signed-in member, or null when there is none.
export interface FoundationIncomingCallResponse {
  ok: boolean;
  call?: FoundationInstantCall | null;
}

// A lifecycle mutation response (ring/answer/decline/end/extend) carries the
// reconciled call row.
export interface FoundationInstantCallActionResponse {
  ok: boolean;
  call?: FoundationInstantCall;
}

// A failed call action, surfaced to the UI with a plain message. `code` is the
// server's FOUNDATION_* error code (kept for branching); `message` is shown.
export interface FoundationCallError {
  code: string | null;
  message: string;
}

// Map the server's FOUNDATION_* error codes (and the wrapped Error message that
// authedFetchJson throws on a non-2xx) to a clear, plain sentence. authedFetchJson
// throws an Error whose message is the server `message` when present, so this both
// recognizes a known code and falls back to the thrown text.
function describeCallError(error: unknown, fallback: string): FoundationCallError {
  const raw = error instanceof Error ? error.message : '';
  // The thrown message is the server's human-readable `message`; if it looks like a
  // real sentence, prefer it. Known codes get a guaranteed-clear sentence regardless.
  if (raw.includes('FOUNDATION_CALL_INSUFFICIENT_FUNDS') || /not have enough ServiceCredits/i.test(raw)) {
    return { code: 'FOUNDATION_CALL_INSUFFICIENT_FUNDS', message: 'You do not have enough ServiceCredits to start this call.' };
  }
  if (raw.includes('FOUNDATION_CALLEE_BUSY') || /already has an incoming call/i.test(raw)) {
    return { code: 'FOUNDATION_CALLEE_BUSY', message: 'This person already has an incoming call. Try again shortly.' };
  }
  if (raw.includes('FOUNDATION_CALL_BLOCK_CAP_REACHED') || /reached the number of blocks/i.test(raw)) {
    return { code: 'FOUNDATION_CALL_BLOCK_CAP_REACHED', message: 'You have reached the number of blocks you authorized for this call.' };
  }
  if (raw.includes('FOUNDATION_CALL_BILLING_MISCONFIGURED') || /not set up for paid calls/i.test(raw)) {
    return { code: 'FOUNDATION_CALL_BILLING_MISCONFIGURED', message: 'This provider is not set up for paid calls right now.' };
  }
  if (raw.includes('FOUNDATION_RATE_LIMIT_EXCEEDED') || /too many call attempts/i.test(raw)) {
    return { code: 'FOUNDATION_RATE_LIMIT_EXCEEDED', message: 'Too many call attempts. Wait a moment and try again.' };
  }
  return { code: null, message: raw && raw.trim().length > 0 ? raw : fallback };
}

// Place an instant-call ring to the provider on this Direct Line thread. The buyer
// pre-authorizes a maximum number of blocks (the per-session spend cap). Ringing
// moves no money; the server rejects the ring up front if the caller cannot afford
// the first block. POST .../threads/{threadId}/instant-call.
export async function ringInstantCall(
  threadId: string,
  authorizedBlocks?: number,
): Promise<FoundationInstantCallActionResponse> {
  const body = authorizedBlocks === undefined ? undefined : JSON.stringify({ authorizedBlocks });
  return authedFetchJson<FoundationInstantCallActionResponse>(
    `${BASE}/connections/threads/${threadId}/instant-call`,
    { method: 'POST', headers: JSON_HEADERS, body },
  );
}

// Poll the state of an instant call the member participates in. When answered, the
// response also carries the Stream audio-join credentials. GET
// .../instant-calls/{callId}.
export async function getInstantCallState(callId: string): Promise<FoundationInstantCallStateResponse> {
  return authedFetchJson<FoundationInstantCallStateResponse>(`${BASE}/connections/instant-calls/${callId}`);
}

// Answer a ringing call (callee only). This both moves the call to 'answered' and
// takes the first per-block charge from the caller, server-side. POST
// .../instant-calls/{callId}/answer.
export async function answerInstantCall(callId: string): Promise<FoundationInstantCallActionResponse> {
  return authedFetchJson<FoundationInstantCallActionResponse>(
    `${BASE}/connections/instant-calls/${callId}/answer`,
    { method: 'POST', headers: JSON_HEADERS },
  );
}

// Decline a ringing call (callee only). POST .../instant-calls/{callId}/decline.
export async function declineInstantCall(callId: string): Promise<FoundationInstantCallActionResponse> {
  return authedFetchJson<FoundationInstantCallActionResponse>(
    `${BASE}/connections/instant-calls/${callId}/decline`,
    { method: 'POST', headers: JSON_HEADERS },
  );
}

// End an in-progress (or ringing) call. Either party may end. POST
// .../instant-calls/{callId}/end.
export async function endInstantCall(callId: string): Promise<FoundationInstantCallActionResponse> {
  return authedFetchJson<FoundationInstantCallActionResponse>(
    `${BASE}/connections/instant-calls/${callId}/end`,
    { method: 'POST', headers: JSON_HEADERS },
  );
}

// Pay for one more block (caller only). The server charges the next block at the
// locked rate and advances the paid window; on insufficient funds the call ends
// cleanly and this throws with that reason; past the cap it throws block-cap.
// POST .../instant-calls/{callId}/extend.
export async function extendInstantCall(callId: string): Promise<FoundationInstantCallActionResponse> {
  return authedFetchJson<FoundationInstantCallActionResponse>(
    `${BASE}/connections/instant-calls/${callId}/extend`,
    { method: 'POST', headers: JSON_HEADERS },
  );
}

// The signed-in member's incoming-ring inbox (callee side). Returns the one live
// ring being placed to them, or null. GET .../connections/incoming-call.
export async function getIncomingCall(): Promise<FoundationIncomingCallResponse> {
  return authedFetchJson<FoundationIncomingCallResponse>(`${BASE}/connections/incoming-call`);
}

export { describeCallError };
