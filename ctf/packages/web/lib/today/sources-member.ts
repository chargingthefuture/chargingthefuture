import { SE_MEMBER_STORY_WORDS, seMemberStorySlug, type SeMemberStory, type SeStoryPost, type SeTodayCard } from '@ctf/shared';
import { listMemberStoryRows } from 'lib/comic/shared-writing-stories';
import { isUserUnlocked } from 'lib/shared/unlock-interface';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { reportError } from 'lib/observability/report';
import { action, author, card, clip } from './card';

// Members' own writing on Today (3.1.0 plan): the writing a member lent to the Knowledge Library and
// also chose to show as stories, once a person accepted it, and only while the writer's Unlock is
// approved. It joins the story order after the blog's posts (seStoryQueue). Signed out it is never
// shown (lib/today/build-public.ts drops it).

export const MEMBER_STORY_SOURCE = 'member-story';

// Where the sheet's link under a member's story leads: to bring your own.
const KNOWLEDGE_HREF = '/knowledge';

// The full piece is read in place, so the card carries it up to this length.
const BODY_MAX = 2400;

export type MemberStories = { stories: SeMemberStory[]; writers: Map<string, string> };

async function approvedWriters(userIds: string[]): Promise<Set<string>> {
  const checks = await Promise.all(userIds.map(async (id) => ((await isUserUnlocked(id)) ? id : null)));
  return new Set(checks.filter((id): id is string => id !== null));
}

// The member stories that may show, keyed by slug to their writer. A failed read leaves members'
// writing out for the day and is reported: the blog's stories still show.
export async function readMemberStories(): Promise<MemberStories> {
  try {
    const rows = await listMemberStoryRows();
    const approved = await approvedWriters([...new Set(rows.map((row) => row.userId))]);
    const shown = rows.filter((row) => approved.has(row.userId));
    return {
      stories: shown.map(({ id, title, text, acceptedAtIso }) => ({ id, title, text, acceptedAtIso })),
      writers: new Map(shown.map((row) => [seMemberStorySlug(row.id), row.userId])),
    };
  } catch (error) {
    reportError(error, { area: 'today', op: 'member_stories' });
    return { stories: [], writers: new Map() };
  }
}

// The Today cards for the members' stories released today.
export async function memberStoryCards(posts: SeStoryPost[], writers: Map<string, string>, createdAtIso: string): Promise<SeTodayCard[]> {
  if (posts.length === 0) return [];
  const names = await resolveUsernames([...new Set(posts.map((post) => writers.get(post.slug) ?? ''))].filter(Boolean));
  return posts.map((post) => {
    const writerId = writers.get(post.slug) ?? null;
    const by = author(writerId, writerId ? names.get(writerId) : null);
    return card({
      source: MEMBER_STORY_SOURCE,
      sourceId: post.slug,
      kind: 'story',
      label: SE_MEMBER_STORY_WORDS.label(by?.handle ?? 'a member'),
      title: post.title,
      body: clip(post.text, BODY_MAX),
      author: by,
      createdAtIso,
      href: KNOWLEDGE_HREF,
      actions: [action('helped-me', 'This helped me', KNOWLEDGE_HREF)],
    });
  });
}
