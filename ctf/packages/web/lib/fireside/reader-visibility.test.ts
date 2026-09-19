import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { firesideReadHeaders } from './_lib';

// Two things about the public thread read that stop being true quietly.
//
// The route answers anybody, and it answers a signed-in member with their own comments that nobody
// else may see — held while they wait for approval, or taken down by an admin. Both of the
// guarantees below are about that second half, and neither of them shows up as a failing screen if
// it breaks: a cached body reaches the wrong reader without anything looking wrong, and a missing
// state label reads exactly like a comment that is fine.

describe('the public read is cached only where it is the same for everybody', () => {
  it('lets a shared cache keep the signed-out answer', () => {
    const cache = firesideReadHeaders(false)['Cache-Control'];
    expect(cache).toContain('public');
    expect(cache).toContain('s-maxage=60');
  });

  it('lets nothing store the signed-in answer', () => {
    // The signed-in body carries this member's held and removed comments, and the URL names only
    // the post — so anything that kept this response would hand it to the next reader of that post.
    const cache = firesideReadHeaders(true)['Cache-Control'];
    expect(cache).toBe('private, no-store');
    expect(cache).not.toContain('public');
    expect(cache).not.toContain('s-maxage');
  });

  it('keys even the signed-out answer on the cookie', () => {
    // Without this, a cache holding the signed-out answer serves it to a signed-in member too, who
    // then reads the conversation with their own held comment missing and concludes it was thrown
    // away — which is the exact failure this plugin exists to avoid.
    expect(firesideReadHeaders(false).Vary).toBe('Cookie');
    expect(firesideReadHeaders(true).Vary).toBe('Cookie');
  });

  it('accepts no credentials cross-origin, either way', () => {
    for (const signedIn of [true, false]) {
      expect(firesideReadHeaders(signedIn)['Access-Control-Allow-Origin']).toBe('*');
      expect(Object.keys(firesideReadHeaders(signedIn))).not.toContain('Access-Control-Allow-Credentials');
    }
  });
});

const repositorySql = readFileSync(join(__dirname, 'repository.ts'), 'utf8');

describe('a comment carries a state only for the person who wrote it', () => {
  const toComment = repositorySql.slice(
    repositorySql.indexOf('function toComment'),
    repositorySql.indexOf('export async function listThreadComments'),
  );

  it('is null unless the row is the viewer’s own', () => {
    // Structural rather than remembered per screen: the state is behind `isOwn`, which is the
    // viewer's own id matched against the row's author. Nobody else's moderation state can travel
    // on a shape that is returned on an unauthenticated route.
    expect(toComment).toContain('viewerState: isOwn ?');
    expect(toComment).toContain('commentStateForAuthor(');
  });

  it('reads the state from the one rule rather than from the row’s status', () => {
    // `status` alone cannot say whether a comment is live: a comment from somebody still waiting on
    // Unlock is 'visible' and public to nobody. commentStateForAuthor is where those two halves are
    // put together, and it is the only place they are.
    const badge = toComment.slice(toComment.indexOf('viewerState:'));
    expect(badge).toContain('authorIsApproved');
  });
});

describe('the count beside a post is the number of comments on the screen', () => {
  it('comes from what the read returned, not from a count of every row', () => {
    // findThread counts every row that is not removed, which includes the ones held because their
    // author is not approved — so the blog widget was promising a reader comments the same call had
    // already declined to give them.
    const listThread = repositorySql.slice(
      repositorySql.indexOf('export async function listThreadComments'),
      repositorySql.indexOf('async function countCommentsToday'),
    );
    expect(listThread).toContain('commentCount: comments.length');
  });
});
