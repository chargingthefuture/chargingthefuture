import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Search is one of the four reasons these comments are in Postgres rather than in a chat product.
// Two things have to stay true for it to be that: the query has to use the same text configuration
// as the index, or Postgres silently does a sequential scan of the whole table; and the query has
// to survive whatever a person types into a search box.
const repositorySql = readFileSync(join(__dirname, 'repository.ts'), 'utf8');
const schemaSql = readFileSync(join(__dirname, '../../../../schema.sql'), 'utf8');

const searchFns = repositorySql.slice(
  repositorySql.indexOf('export async function searchComments'),
  repositorySql.indexOf('export async function countAllComments'),
);

describe('comment search', () => {
  it('uses the index rather than scanning, by matching its text configuration', () => {
    expect(schemaSql).toContain("USING GIN (to_tsvector('english', body))");
    expect(searchFns).toContain("to_tsvector('english', c.body)");
    expect(repositorySql).toContain("websearch_to_tsquery('english', $1)");
  });

  it('parses what a person types, rather than what tsquery syntax demands', () => {
    // to_tsquery throws on input as ordinary as an apostrophe or an unbalanced quote; a search box
    // that errors on `it's` is not a search box. Matches a bare to_tsquery specifically, since
    // websearch_to_tsquery contains it as a substring.
    expect(searchFns).not.toMatch(/(?<!websearch_|plainto_|phraseto_)to_tsquery\(/);
    expect(searchFns).toContain('websearch_to_tsquery(');
  });

  it('counts the same rows it lists, so the pager does not lie', () => {
    const countFn = repositorySql.slice(
      repositorySql.indexOf('export async function countSearchComments'),
      repositorySql.indexOf('export async function countAllComments'),
    );
    expect(countFn).toContain("to_tsvector('english', c.body) @@ websearch_to_tsquery('english', $1)");
  });

  it('passes the search as a parameter rather than building SQL from it', () => {
    expect(searchFns).toContain('[query, limit, offset]');
    expect(searchFns).not.toContain('${query}');
  });
});
