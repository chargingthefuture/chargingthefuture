import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Every admin landing tile is keyed by a slug, and the "new to review" dot and the seen-marker are
// both keyed on it. Two tiles ending in the same path segment used to share one: Contributed Writing
// (/admin/comic/contributions) showed the Contributions queue's dot, and opening it cleared that dot
// without the Contributions queue having been opened.
vi.mock('lib/db/postgres', () => ({ queryDb: vi.fn() }));
vi.mock('lib/fireside/export-review', () => ({ countPendingExportRequests: vi.fn() }));
vi.mock('lib/observability/report', () => ({ reportError: vi.fn() }));
vi.mock('lib/admin-expenses/contributions-call', () => ({ CONTRIBUTIONS_CALL_ACTOR_ID: 'test' }));

const { isAdminAttentionArea } = await import('lib/admin/area-attention');

const pageSource = readFileSync(join(__dirname, '..', '..', 'app', 'admin', 'page.tsx'), 'utf8');
const listStart = pageSource.indexOf('= [', pageSource.indexOf('const ADMIN_AREAS'));
const listSource = pageSource.slice(listStart, pageSource.indexOf('\n];', listStart));

const AREA = /\{ href: '([^']+)', name: '([^']+)'(?:, slug: '([^']+)')? \}/g;
const areas = [...listSource.matchAll(AREA)].map(([, href, name, slug]) => ({
  href,
  name,
  // The same rule the page applies.
  slug: slug ?? href.split('/').filter(Boolean).pop() ?? href,
}));

describe('admin landing slugs', () => {
  it('reads every tile from the page', () => {
    // A tile written in a shape the pattern does not read would escape the uniqueness check below.
    expect(areas.length).toBe((listSource.match(/\{ href:/g) ?? []).length);
    expect(areas.length).toBeGreaterThan(30);
    expect(areas.map((area) => area.href)).toContain('/admin/comic/contributions');
  });

  it('gives no two tiles the same slug', () => {
    const seen = new Map<string, string>();
    for (const area of areas) {
      expect(seen.get(area.slug), `${area.href} shares the slug ${area.slug}`).toBeUndefined();
      seen.set(area.slug, area.href);
    }
  });

  it('keeps the Contributions queue dot on the Contributions tile alone', () => {
    const contributions = areas.filter((area) => area.slug === 'contributions');
    expect(contributions.map((area) => area.href)).toEqual(['/admin/contributions']);
    const writing = areas.find((area) => area.href === '/admin/comic/contributions');
    expect(writing?.slug).toBe('comic-contributions');
    // Opening Contributed Writing marks nothing seen, because no queue is keyed on its slug.
    expect(isAdminAttentionArea('comic-contributions')).toBe(false);
  });
});
