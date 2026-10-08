// Foundation API client (mobile) — provider search, quotes, the Direct Line and the member's own
// provider settings. The same routes, bodies and error wording as the web Foundation screens
// (components/foundation/*.tsx); the instant-call routes are in FoundationApi.ts.
//
//   - GET  /api/foundation/providers/search?q=&skillId=          providers who offer a skill
//   - GET  /api/foundation/quotes/history                         the member's quotes
//   - POST /api/foundation/connections/threads { providerId }    open a connection (Direct Line)
//   - POST /api/foundation/quotes { threadId, serviceType }       request a quote on it
//   - POST /api/foundation/quotes/[id]/state                      respond with a price, or mark done
//   - GET  /api/foundation/connections/threads/[id]/token         Direct Line chat credentials
//   - GET/PUT /api/foundation/provider/skills | description | instant-call   the Offer tab
//   - GET  /api/currencies                                        currency list for the price form
import { authedFetch } from '../../auth/authedFetch';

const JSON_HEADERS = { 'Content-Type': 'application/json', 'x-ctf-csrf': '1' };

export type OfferedSkill = { id: string; name: string };

export type ProviderView = {
  profileId: string;
  providerUserId: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  offeredSkills: OfferedSkill[];
  instantCallEnabled: boolean;
  instantCallRateCredits: number | null;
  instantCallIntervalMinutes: number;
  shortDescription: string | null;
};

export type QuoteState = 'requested' | 'provider_responded' | 'closed';

export type QuoteView = {
  id: string;
  threadId: string;
  providerUserId: string;
  serviceType: string;
  lifecycleState: QuoteState;
  quotedAmount: number | null;
  quotedCurrency: string | null;
  settledAtIso: string | null;
  createdAtIso: string;
};

export type ChatCredentials = { streamApiKey: string; streamToken: string; streamUserId: string; streamChannelId: string };

// The web FOUNDATION_ERROR_MESSAGES: fixed text for the codes whose server message is written for a log.
const FOUNDATION_ERROR_MESSAGES: Record<string, string> = {
  FOUNDATION_POLICY_DENIED: "You can't request a quote from your own profile.",
  FOUNDATION_PROVIDER_NOT_FOUND: "This provider's profile could not be found.",
  FOUNDATION_RATE_LIMIT_EXCEEDED: "You're sending requests too quickly — wait a moment and try again.",
  FOUNDATION_CSRF_DENIED: 'Your session needs a refresh — reload the page and try again.',
};

type FailureBody = { code?: string; message?: string; reason?: string; detail?: string; reference?: string; ok?: boolean };

async function readBody(res: Response): Promise<FailureBody> {
  try {
    return (await res.json()) as FailureBody;
  } catch {
    // no-trace: the body was not JSON; the caller falls back to its own sentence
    return {};
  }
}

// The web foundationErrorMessage: the fixed text for a known code, else the route's words, else the
// screen's sentence, with the route's reference appended.
export async function foundationErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await readBody(res);
  const text = (body.code && FOUNDATION_ERROR_MESSAGES[body.code]) || body.message || fallback;
  return body.reference ? `${text} [ref ${body.reference}]` : text;
}

// The web responseFailureText for a member: the route's words, else the sentence, with the reference.
export async function responseFailureText(res: Response, fallback: string): Promise<string> {
  const body = await readBody(res);
  const text = body.message || body.reason || body.detail || fallback;
  return body.reference ? `${text} [ref ${body.reference}]` : text;
}

export async function searchProviders(searchTerm: string, skillId: string | null): Promise<{ items: ProviderView[]; viewerUserId: string | null }> {
  const params: string[] = [];
  if (searchTerm) params.push(`q=${encodeURIComponent(searchTerm)}`);
  if (skillId) params.push(`skillId=${encodeURIComponent(skillId)}`);
  const res = await authedFetch(`/api/foundation/providers/search?${params.join('&')}`, { method: 'GET' });
  if (!res.ok) throw new Error(await foundationErrorMessage(res, 'Could not search providers.'));
  const data = (await res.json()) as { items?: ProviderView[]; viewerUserId?: string };
  return { items: data.items ?? [], viewerUserId: data.viewerUserId ?? null };
}

export async function fetchQuotes(): Promise<QuoteView[]> {
  const res = await authedFetch('/api/foundation/quotes/history', { method: 'GET' });
  if (!res.ok) throw new Error(await foundationErrorMessage(res, 'Could not load your quotes.'));
  const data = (await res.json()) as { items?: QuoteView[] };
  return data.items ?? [];
}

function post(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST'): Promise<Response> {
  return authedFetch(path, { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
}

type ThreadAnswer = {
  thread?: { id?: string; streamChannelId?: string };
  streamApiKey?: string;
  streamUserId?: string;
  streamToken?: string;
};

function chatCredentialsOf(data: ThreadAnswer): ChatCredentials | null {
  const channelId = data.thread?.streamChannelId;
  if (!data.streamApiKey || !data.streamUserId || !data.streamToken || !channelId) return null;
  return { streamApiKey: data.streamApiKey, streamUserId: data.streamUserId, streamToken: data.streamToken, streamChannelId: channelId };
}

// The web requestQuote's two steps. Returns the Direct Line credentials when the thread POST issued
// them, so the member lands in the chat; null when it did not (the screen then opens Quotes).
export async function requestQuote(provider: ProviderView): Promise<ChatCredentials | null> {
  const threadRes = await post('/api/foundation/connections/threads', { providerId: provider.profileId });
  if (!threadRes.ok) throw new Error(await foundationErrorMessage(threadRes, 'Could not open a connection with this provider.'));
  const threadData = (await threadRes.json()) as ThreadAnswer;
  const threadId = threadData.thread?.id;
  if (!threadId) throw new Error('Connection response was incomplete.');
  const serviceType = provider.headline?.trim() || 'General trade service';
  const quoteRes = await post('/api/foundation/quotes', { threadId, serviceType });
  if (!quoteRes.ok) throw new Error(await foundationErrorMessage(quoteRes, 'Could not submit the quote request.'));
  return chatCredentialsOf(threadData);
}

// true on success, or the text to show (the web QuoteTransitionResult).
export async function transitionQuote(quoteId: string, body: Record<string, unknown>, fallback: string): Promise<true | string> {
  let res: Response;
  try {
    res = await post(`/api/foundation/quotes/${encodeURIComponent(quoteId)}/state`, body);
  } catch {
    // no-trace: the request never answered; the member sees the form's own sentence
    return fallback;
  }
  if (!res.ok) return responseFailureText(res, fallback);
  return true;
}

const DIRECT_LINE_FAILURE = 'Could not open this Direct Line.';

type TokenAnswer = FailureBody & Partial<ChatCredentials>;

// The web directLineFailureText.
function directLineFailureText(body: TokenAnswer): string {
  if (body.code === 'FOUNDATION_NOT_THREAD_PARTICIPANT') return "You don't have access to this Direct Line.";
  if (body.code === 'FOUNDATION_STREAM_UNAVAILABLE') return 'The Direct Line is temporarily unavailable. Try again shortly.';
  const text = body.message?.trim() || DIRECT_LINE_FAILURE;
  return body.reference ? `${text} [ref ${body.reference}]` : text;
}

function tokenCredentials(body: TokenAnswer): ChatCredentials | null {
  if (!body.ok || !body.streamApiKey || !body.streamToken || !body.streamUserId || !body.streamChannelId) return null;
  return { streamApiKey: body.streamApiKey, streamToken: body.streamToken, streamUserId: body.streamUserId, streamChannelId: body.streamChannelId };
}

export async function fetchDirectLine(threadId: string): Promise<ChatCredentials> {
  let res: Response;
  try {
    res = await authedFetch(`/api/foundation/connections/threads/${encodeURIComponent(threadId)}/token`, { method: 'GET' });
  } catch {
    // no-trace: the request never answered; the member sees the screen's own sentence
    throw new Error(DIRECT_LINE_FAILURE);
  }
  const body = (await readBody(res)) as TokenAnswer;
  const credentials = res.ok ? tokenCredentials(body) : null;
  if (credentials) return credentials;
  throw new Error(directLineFailureText(body));
}

export type OfferableSkill = { id: string; name: string; offered: boolean };

export async function fetchOfferableSkills(): Promise<OfferableSkill[]> {
  const res = await authedFetch('/api/foundation/provider/skills', { method: 'GET' });
  if (!res.ok) throw new Error('Could not load your skills.');
  return ((await res.json()) as { skills?: OfferableSkill[] }).skills ?? [];
}

export async function saveOfferedSkills(skillIds: string[]): Promise<string[] | null> {
  const res = await post('/api/foundation/provider/skills', { skillIds }, 'PUT');
  if (!res.ok) throw new Error('Could not save. Please try again.');
  return ((await readBody(res)) as { offeredSkillIds?: string[] }).offeredSkillIds ?? null;
}

export async function fetchDescription(): Promise<{ shortDescription: string | null; maxLength?: number }> {
  const res = await authedFetch('/api/foundation/provider/description', { method: 'GET' });
  if (!res.ok) throw new Error('Could not load your listing description.');
  return (await res.json()) as { shortDescription: string | null; maxLength?: number };
}

export async function saveDescription(shortDescription: string): Promise<string | null> {
  const res = await post('/api/foundation/provider/description', { shortDescription }, 'PUT');
  const data = (await readBody(res)) as FailureBody & { shortDescription?: string | null };
  if (!res.ok) throw new Error(data.message || 'Could not save. Please try again.');
  return data.shortDescription ?? null;
}

export type InstantCallSetting = { enabled: boolean; rateCredits: number | null; intervalMinutes: number };

export async function fetchInstantCallSetting(): Promise<InstantCallSetting | null> {
  const res = await authedFetch('/api/foundation/provider/instant-call', { method: 'GET' });
  if (!res.ok) throw new Error('Could not load your instant-call settings.');
  return ((await res.json()) as { instantCall?: InstantCallSetting }).instantCall ?? null;
}

export async function saveInstantCallSetting(setting: InstantCallSetting): Promise<InstantCallSetting | null> {
  const res = await post('/api/foundation/provider/instant-call', setting, 'PUT');
  const data = (await readBody(res)) as FailureBody & { instantCall?: InstantCallSetting };
  if (!res.ok) throw new Error(data.message || 'Could not save. Please try again.');
  return data.instantCall ?? null;
}

export type Currency = { code: string; label: string; symbol?: string | null; name?: string; isServiceCredits?: boolean; sortOrder?: number };

export async function fetchCurrencies(): Promise<Currency[]> {
  const res = await authedFetch('/api/currencies', { method: 'GET' });
  if (!res.ok) throw new Error(`Currency catalog request failed (HTTP ${res.status})`);
  const data = (await res.json()) as { currencies?: Currency[] };
  return Array.isArray(data.currencies) ? data.currencies : [];
}

// The admin page's capacity policy (GET/PUT /api/foundation/admin/capacity-policy), admins only.
export type QuotaState = 'green' | 'yellow' | 'orange' | 'red';

export type CapacityPolicyForm = {
  maxActiveThreadsPerUser: number;
  maxMessagesPerMinute: number;
  maxSearchesPerMinute: number;
  maxQuoteTransitionsPerMinute: number;
  maxCallDurationMinutes: number;
  quotaState: QuotaState;
};

export async function fetchCapacityPolicy(): Promise<CapacityPolicyForm> {
  const res = await authedFetch('/api/foundation/admin/capacity-policy', { method: 'GET' });
  if (!res.ok) throw new Error(await responseFailureText(res, `Capacity policy unavailable (${res.status}).`));
  const policy = ((await res.json()) as { policy?: CapacityPolicyForm }).policy;
  if (!policy) throw new Error('Capacity policy unavailable.');
  return {
    maxActiveThreadsPerUser: policy.maxActiveThreadsPerUser,
    maxMessagesPerMinute: policy.maxMessagesPerMinute,
    maxSearchesPerMinute: policy.maxSearchesPerMinute,
    maxQuoteTransitionsPerMinute: policy.maxQuoteTransitionsPerMinute,
    maxCallDurationMinutes: policy.maxCallDurationMinutes,
    quotaState: policy.quotaState,
  };
}

// null on success, or the text to show (the web save's own wording).
export async function saveCapacityPolicy(form: CapacityPolicyForm): Promise<string | null> {
  const res = await post('/api/foundation/admin/capacity-policy', form, 'PUT');
  if (res.ok) return null;
  const data = await readBody(res);
  return data.message ?? data.reason ?? `Save failed (${res.status}).`;
}

export type AdminDashboard = {
  providersTotal: number;
  threadsTotal: number;
  quotesTotal: number;
  activeCallsTotal: number;
  pendingNotificationsTotal: number;
  generatedAtIso: string;
};

// The admin page's snapshot counts (GET /api/foundation/admin/dashboard), admins only.
export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const res = await authedFetch('/api/foundation/admin/dashboard', { method: 'GET' });
  if (!res.ok) throw new Error(await responseFailureText(res, `Admin snapshot unavailable (${res.status}).`));
  const dashboard = ((await res.json()) as { dashboard?: AdminDashboard }).dashboard;
  if (!dashboard) throw new Error('Admin snapshot unavailable.');
  return dashboard;
}
