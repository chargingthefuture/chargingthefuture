import type { DailyPostThemeId } from 'lib/daily-posts/themes';
import type { DailyPostTemplateItem } from './types';

// Calls to /api/admin/daily-posts. Each returns the server's own message on failure, so the screen
// can say what went wrong.

async function send<T>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', 'x-ctf-csrf': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as (T & { message?: string }) | null;
    if (!response.ok) return { ok: false, message: data?.message ?? `The server answered ${response.status}.` };
    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, message: `The server could not be reached: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function saveTick(itemKey: string, date: string, done: boolean) {
  return send<{ ok: true }>('/api/admin/daily-posts/ticks', 'POST', { itemKey, date, done });
}

export function createTemplate(title: string, body: string) {
  return send<{ template: DailyPostTemplateItem }>('/api/admin/daily-posts/templates', 'POST', { title, body });
}

export function updateTemplate(id: string, title: string, body: string) {
  return send<{ template: DailyPostTemplateItem }>(`/api/admin/daily-posts/templates/${id}`, 'PATCH', { title, body });
}

export function deleteTemplate(id: string) {
  return send<{ ok: true }>(`/api/admin/daily-posts/templates/${id}`, 'DELETE');
}

export function saveExclusion(slug: string, excluded: boolean) {
  return send<{ excluded: boolean }>('/api/admin/daily-posts/exclusions', 'POST', { slug, excluded });
}

export function saveThemeChoice(slug: string, themes: DailyPostThemeId[] | null) {
  return send<{ themes: DailyPostThemeId[] | null }>('/api/admin/daily-posts/theme-choices', 'POST', { slug, themes });
}
