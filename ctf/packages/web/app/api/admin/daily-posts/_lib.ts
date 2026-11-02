import { NextResponse } from 'next/server';
import { evaluatePluginAccess, type AllowDecision } from 'lib/auth/server-authz';
import { checkMutationOrigin } from 'lib/auth/csrf';
import { isDailyPostThemeId, type DailyPostThemeId } from 'lib/daily-posts/themes';

export type DailyPostsApiGate = { allowed: true; auth: AllowDecision } | { allowed: false; response: NextResponse };

// The Daily Posts screen is the owner's own posting list, so every route is admin-only.
export async function requireDailyPostsAdminAccess(): Promise<DailyPostsApiGate> {
  const decision = await evaluatePluginAccess({ requiredRoles: ['admin'] });
  if (!decision.allowed) {
    return { allowed: false, response: NextResponse.json(decision, { status: decision.status }) };
  }
  return { allowed: true, auth: decision };
}

export function dailyPostsError(message: string, code: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function ensureDailyPostsMutationCsrf(request: Request): NextResponse | null {
  if (request.headers.get('x-ctf-csrf') !== '1') {
    return dailyPostsError('Missing CSRF confirmation header.', 'admin_daily_posts_csrf_denied', 403);
  }
  const originCheck = checkMutationOrigin(request);
  if (originCheck === 'invalid_origin') {
    return dailyPostsError('Invalid request origin metadata.', 'admin_daily_posts_csrf_denied', 403);
  }
  if (originCheck === 'cross_origin') {
    return dailyPostsError('Cross-origin mutation denied by CSRF policy.', 'admin_daily_posts_csrf_denied', 403);
  }
  return null;
}

export async function readJson(request: Request): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; reason: string }> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'the body is not a JSON object' };
    return { ok: true, body: body as Record<string, unknown> };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTemplateId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// What a tick can point at: a blog post by its slug, a template by its id, or the PB2 message.
export const ITEM_KEY_PATTERN = /^(?:post:.{1,300}|template:[0-9a-f-]{36}|pb2)$/i;

export const TITLE_MAX = 200;
export const BODY_MAX = 20_000;

export function parseTemplateInput(body: Record<string, unknown>): { ok: true; title: string; text: string } | { ok: false; message: string } {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!title) return { ok: false, message: 'A template needs a title.' };
  if (!text) return { ok: false, message: 'A template needs the text to copy.' };
  if (title.length > TITLE_MAX) return { ok: false, message: `The title is ${title.length} characters; the limit is ${TITLE_MAX}.` };
  if (text.length > BODY_MAX) return { ok: false, message: `The text is ${text.length} characters; the limit is ${BODY_MAX}.` };
  return { ok: true, title, text };
}

export function parseTickInput(body: Record<string, unknown>): { ok: true; itemKey: string; date: string; done: boolean } | { ok: false; message: string } {
  const { itemKey, date, done } = body;
  if (typeof itemKey !== 'string' || !ITEM_KEY_PATTERN.test(itemKey)) return { ok: false, message: 'itemKey must be post:<slug>, template:<id> or pb2.' };
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) return { ok: false, message: 'date must be YYYY-MM-DD.' };
  if (typeof done !== 'boolean') return { ok: false, message: 'done must be true or false.' };
  return { ok: true, itemKey, date, done };
}

export function parseThemeChoiceInput(
  body: Record<string, unknown>,
): { ok: true; slug: string; themes: DailyPostThemeId[] | null } | { ok: false; message: string } {
  const { slug, themes } = body;
  if (typeof slug !== 'string' || !slug || slug.length > 300) return { ok: false, message: "slug must be the post's slug." };
  if (themes === null) return { ok: true, slug, themes: null };
  if (!Array.isArray(themes) || !themes.every(isDailyPostThemeId)) return { ok: false, message: 'themes must be a list of theme ids, or null.' };
  return { ok: true, slug, themes: [...new Set(themes)] };
}
