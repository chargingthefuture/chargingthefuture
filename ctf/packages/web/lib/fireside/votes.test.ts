import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FIRESIDE_ALL_REACTION_KINDS,
  FIRESIDE_COUNTED_KINDS,
  FIRESIDE_VOTE_KINDS,
} from 'lib/fireside/constants';

// Two promises were made about voting here, and both are the kind that quietly stops being true a
// year later unless something fails when it does. A downvote total is never shown to anybody, and
// a vote never changes what order comments are read in.
const repositorySql = readFileSync(join(__dirname, 'repository.ts'), 'utf8');

describe('what a vote may be', () => {
  it('stores agree and disagree alongside the three reactions', () => {
    expect([...FIRESIDE_VOTE_KINDS]).toEqual(['upvote', 'downvote']);
    expect([...FIRESIDE_ALL_REACTION_KINDS]).toEqual([
      'recognize',
      'helpful',
      'same_here',
      'upvote',
      'downvote',
    ]);
  });
});

describe('a downvote is recorded and never counted', () => {
  it('is not a kind that may appear in any count', () => {
    expect(FIRESIDE_COUNTED_KINDS).not.toContain('downvote');
  });

  it('counts upvotes, so agreeing is visible even though disagreeing is not', () => {
    expect(FIRESIDE_COUNTED_KINDS).toContain('upvote');
  });

  it('builds every count from the counted list rather than from whatever the table holds', () => {
    // The guard is one function used at the one place counts are accumulated. A count built by
    // iterating the rows directly would put downvote totals on a public shape the first time
    // somebody added a kind.
    expect(repositorySql).toContain('function isCountedKind');
    expect(repositorySql).toContain('if (!isCountedKind(row.kind)) continue;');
  });
});

describe('a vote does not move anything', () => {
  it('orders a thread by when comments were written, and by nothing else', () => {
    const listThread = repositorySql.slice(
      repositorySql.indexOf('export async function listThreadComments'),
      repositorySql.indexOf('async function countCommentsToday'),
    );
    expect(listThread).toContain('ORDER BY c.created_at ASC');
    for (const kind of FIRESIDE_ALL_REACTION_KINDS) {
      expect(listThread).not.toContain(kind);
    }
    expect(listThread.toLowerCase()).not.toContain('fireside_reactions');
  });

  it('never joins or sorts a comment read on the reactions table', () => {
    const selects = repositorySql.slice(
      repositorySql.indexOf('const COMMENT_COLUMNS'),
      repositorySql.indexOf('function toComment'),
    );
    expect(selects).not.toContain('fireside_reactions');
    expect(selects).not.toContain('ORDER BY');
  });
});

describe('the two votes are exclusive', () => {
  it('drops the other side when one is pressed, and leaves reactions alone', () => {
    const toggle = repositorySql.slice(
      repositorySql.indexOf('function opposingVote'),
      repositorySql.indexOf('/** An admin takes a comment down'),
    );
    expect(toggle).toContain("if (kind === 'upvote') return 'downvote';");
    expect(toggle).toContain("if (kind === 'downvote') return 'upvote';");
    expect(toggle).toContain('return null;');
    expect(toggle).toContain('const opposing = opposingVote(kind);');
  });
});
