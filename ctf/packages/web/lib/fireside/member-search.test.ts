import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Searching the conversation as a member, which was admin-only until now.
//
// The risk in a member-facing search over member-written words is that it returns something the
// searcher may not read: a comment held while its author waits for Unlock is visible to nobody but
// them, and a search that leaks it undoes the gate the rest of the plugin is built around. The
// second risk is the one this plugin has already paid for twice — a count and a list that disagree.
const repositorySource = readFileSync(join(__dirname, 'repository.ts'), 'utf8');
const webRoot = join(__dirname, '..', '..');
const routeSource = readFileSync(
  join(webRoot, 'app', 'api', 'fireside', 'search', 'route.ts'),
  'utf8',
);
const searchUiSource = readFileSync(
  join(webRoot, 'components', 'fireside', 'fireside-search.tsx'),
  'utf8',
);

function functionBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  expect(start, `${declaration} is not in this file`).toBeGreaterThan(-1);
  const rest = source.slice(start + declaration.length);
  const end = rest.indexOf('\nexport ');
  return end === -1 ? rest : rest.slice(0, end);
}

const search = functionBody(repositorySource, 'export async function searchVisibleComments');

describe('a member search returns only what the searcher may read', () => {
  it('decides each row with the one visibility rule, not a filter of its own', () => {
    expect(search).toContain('isPubliclyVisible({');
    expect(search).toContain('approved.has(row.author_user_id)');
  });

  it('includes the searcher’s own held comments and nobody else’s', () => {
    // Somebody always sees their own words — the same rule the thread read applies.
    expect(search).toContain('|| row.author_user_id === input.viewerUserId');
  });

  it('asks Unlock through the platform interface rather than joining its table', () => {
    expect(search).toContain('listUnlockedUserIds(');
    expect(repositorySource).toContain("from 'lib/shared/unlock-interface'");
  });

  it('never selects the author’s own copy of something they took down', () => {
    // withdrawn_body lives only on OWN_COMMENT_SELECT, and a withdrawn body is emptied anyway, so
    // it can match nothing — but the select is the guarantee rather than that reasoning.
    expect(search).toContain('${COMMENT_SELECT}');
    expect(search).not.toContain('OWN_COMMENT_SELECT');
    expect(search).toContain("c.status <> 'withdrawn'");
  });

  it('is signed-in, unlike the public read of one conversation', () => {
    expect(routeSource).toContain('requireFiresideAuthor()');
    expect(routeSource).not.toContain('readerIdentity');
  });
});

describe('the count and the results agree', () => {
  it('counts after the visibility filter, not before it', () => {
    const filtered = search.indexOf('const readable = result.rows.filter');
    const total = search.indexOf('total: readable.length');
    expect(filtered).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(filtered);
  });

  it('pages out of the filtered list rather than out of the query', () => {
    expect(search).toContain('readable.slice(input.offset, input.offset + input.limit)');
  });

  it('says when it stopped looking instead of passing a slice off as everything', () => {
    expect(search).toContain('scanFilled: result.rows.length >= FIRESIDE_MEMBER_SEARCH_SCAN_LIMIT');
    expect(routeSource).toContain('moreThanShown: result.scanFilled');
    expect(searchUiSource).toContain('There are more matches than this search looked at.');
  });

  it('clamps a page past the end to the last one', () => {
    expect(routeSource).toContain('Math.min(parsed.data.page, lastPage)');
  });
});

describe('the search uses the index that exists', () => {
  it('matches the index’s text configuration', () => {
    // A configuration that does not match the index is not an error — Postgres just scans the
    // table instead, and the search gets slower for everybody as the conversation grows.
    expect(search).toContain("to_tsvector('english', c.body)");
    expect(search).toContain("websearch_to_tsquery('english', $1)");
  });

  it('passes what was typed as a parameter, never into the SQL', () => {
    expect(search).toContain('[input.query, FIRESIDE_MEMBER_SEARCH_SCAN_LIMIT]');
  });
});

describe('the screen', () => {
  it('searches on submit, not on every keystroke', () => {
    expect(searchUiSource).toContain('const [draft, setDraft]');
    expect(searchUiSource).toContain('const [query, setQuery]');
    expect(searchUiSource).toContain('onSubmit={() => { setPage(1); setQuery(draft.trim()); }}');
  });

  it('keeps its page in the address bar', () => {
    expect(searchUiSource).toContain('useUrlPage("found")');
  });

  it('shows nothing until somebody asks something', () => {
    // A search, not the browse-every-conversation view the owner tabled on 2026-09-13.
    expect(searchUiSource).toContain('if (search.length < 2)');
    expect(searchUiSource).toContain('setAnswer(null);');
  });

  it('explains an empty result rather than leaving it blank', () => {
    expect(searchUiSource).toContain('a comment held until');
  });
});
