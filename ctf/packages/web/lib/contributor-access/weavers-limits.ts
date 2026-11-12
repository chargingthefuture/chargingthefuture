import { NextResponse } from 'next/server';
import { SE_WEAVERS_LIMIT_WORDS as W, seHasLink } from '@ctf/shared';
import { isMemberEligible } from './repository';

// Only Weavers of the Commons badge holders bring people into rooms and put pictures and links in
// posts (3.1 plan, Access). The badge is never given by hand, the owner included, so an admin is
// held to it like anybody else. A refusal is a 403 carrying the plan's words, which the screens show.

export type WeaversLimit = 'bring' | 'picture' | 'link';

export function weaversRefusal(limit: WeaversLimit): NextResponse {
  return NextResponse.json({ ok: false, code: 'weavers_only', message: W[limit] }, { status: 403 });
}

export async function holdsWeaversBadge(userId: string): Promise<boolean> {
  return isMemberEligible(userId);
}

// Null when the text has no link or the writer holds the badge; otherwise the refusal.
export async function refuseLinkUnlessWeaver(userId: string, text: string): Promise<NextResponse | null> {
  if (!seHasLink(text)) return null;
  return (await holdsWeaversBadge(userId)) ? null : weaversRefusal('link');
}

export async function refuseUnlessWeaver(userId: string, limit: WeaversLimit): Promise<NextResponse | null> {
  return (await holdsWeaversBadge(userId)) ? null : weaversRefusal(limit);
}

// Null when no picture is new (every one was already there before this edit) or the writer holds the
// badge; otherwise the refusal. Pictures put up before the rule stay, so an edit that keeps them is
// not refused.
export async function refuseNewPicturesUnlessWeaver(
  userId: string,
  pictures: unknown,
  alreadyThere: readonly string[] = [],
): Promise<NextResponse | null> {
  // A body's photos arrive unchecked; anything that is not a list carries no picture.
  const list: unknown[] = Array.isArray(pictures) ? pictures : [];
  const kept = new Set<unknown>(alreadyThere);
  if (!list.some((p) => !kept.has(p))) return null;
  return (await holdsWeaversBadge(userId)) ? null : weaversRefusal('picture');
}
