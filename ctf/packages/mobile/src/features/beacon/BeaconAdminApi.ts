// Beacon admin API client (mobile): the calls the Beacon Admin screen makes, with the same routes,
// bodies and failure wording as the web admin page (components/beacon/beacon-admin-shell.tsx).
// Every route here is admin-gated on the server, which is the real enforcement.
//
//   - GET    /api/beacon/admin            events newest first, each with its broadcast log.
//   - POST   /api/beacon                  create a draft { title, description }.
//   - DELETE /api/beacon/[id]             delete a draft (drafts only; the route refuses the rest).
//   - GET    /api/beacon/[id]/ingest      the broadcaster-app address and stream key, plus the host's
//                                          Stream credentials.
//   - POST   /api/beacon/[id]/go-live     takes the call out of backstage; posts "live now".
//   - POST   /api/beacon/[id]/end         ends the broadcast.
//   - POST   /api/beacon/[id]/moderate    mute / ban / slow_mode on the event chat.
//
// The stream key is a secret: it is shown masked and copied, and never logged or reported.
import { authedFetch } from '../../auth/authedFetch';
import { reportError } from '../../observability/report';

export type BeaconEventLogEntry = {
  atIso: string;
  command: string;
  ok: boolean;
  reason: string;
};

export type BeaconAdminEvent = {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'live' | 'ended';
  startedAtIso: string | null;
  endedAtIso: string | null;
  recordingUrl: string | null;
  createdAtIso: string;
  recordingLookup?: string;
  log?: BeaconEventLogEntry[];
};

export type BeaconIngest = {
  rtmpIngestUrl: string;
  streamKey: string;
  streamApiKey: string;
  streamCallType: string;
  streamCallId: string;
  streamUserId: string;
  hostToken: string;
};

export type BeaconModerationAction = 'mute' | 'ban' | 'slow_mode';

export type MutateResult<T> = { ok: boolean; data: T | null; message?: string };

// The web adminMutate: the route's message, else its code, else the status.
export async function adminMutate<T = unknown>(path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<MutateResult<T>> {
  try {
    const res = await authedFetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as (T & { message?: string; code?: string }) | null;
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, data: null, message: data?.message ?? data?.code ?? `Request failed (${res.status}).` };
  } catch (error) {
    reportError(error, { area: 'beacon', op: 'admin_mutate', extra: { path, method } });
    return { ok: false, data: null, message: 'Network error. Try again.' };
  }
}

export async function loadBeaconAdminEvents(): Promise<BeaconAdminEvent[]> {
  const res = await authedFetch('/api/beacon/admin', { method: 'GET' });
  if (!res.ok) throw new Error('Could not load events.');
  const data = (await res.json()) as { events?: BeaconAdminEvent[] };
  return data.events ?? [];
}

// Throws with the route's message, or the web's fallback line, when the ingest is unavailable.
export async function loadBeaconIngest(eventId: string): Promise<BeaconIngest> {
  const res = await authedFetch(`/api/beacon/${eventId}/ingest`, { method: 'GET' });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? 'Broadcast input is unavailable.');
  }
  return (await res.json()) as BeaconIngest;
}
