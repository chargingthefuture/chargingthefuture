import type { SeTodayCard } from '@ctf/shared';
import { listFeedTimeline } from 'lib/feed/repository';
import { listLatestDirectoryInviteCards } from 'lib/directory/invites';
import { getReaderList } from 'lib/what-works/repository';
import { action, card, clip, startOfTodayIso, type TodayViewer } from './card';

// Stories: announcements from the System Architect, the newest Directory invitations, and one
// thing that worked for somebody, a different one each day.

export async function announcementStories(viewer: TodayViewer): Promise<SeTodayCard[]> {
  const { items } = await listFeedTimeline(viewer.userId, viewer.isAdmin ? 'admin' : null, { page: 1, pageSize: 3 }, { channel: 'announcements' });
  return items
    .filter((item) => !item.isDismissed)
    .map((item) =>
      card({
        source: 'announcement',
        sourceId: item.id,
        kind: 'story',
        label: 'Story · from the System Architect',
        title: item.title || 'An announcement',
        body: clip(item.body, 600),
        createdAtIso: item.publishedAtIso,
        href: '/',
        actions: [],
      }),
    );
}

export async function inviteStories(): Promise<SeTodayCard[]> {
  const invites = await listLatestDirectoryInviteCards(3);
  return invites.map((invite) =>
    card({
      source: 'directory-invite',
      sourceId: invite.url,
      kind: 'story',
      label: 'Story · an invitation',
      title: `An invitation to ${invite.name}`,
      body: clip(invite.opening, 220),
      createdAtIso: new Date(invite.date).toISOString(),
      href: invite.url,
      actions: [action('open', 'Read it', invite.url)],
    }),
  );
}

export async function whatWorksStory(viewer: TodayViewer, now = new Date()): Promise<SeTodayCard[]> {
  const { problems } = await getReaderList(viewer.userId);
  const verified = problems.flatMap((problem) =>
    problem.products.filter((product) => product.verifiedCount > 0).map((product) => ({ problem, product })),
  );
  if (verified.length === 0) return [];
  const day = Math.floor(now.getTime() / 86_400_000);
  const { problem, product } = verified[day % verified.length];
  const href = '/apps/what-works';
  return [
    card({
      source: 'what-works',
      sourceId: product.id,
      kind: 'story',
      label: 'What worked for someone',
      title: product.name,
      body: `Problem: ${problem.title}. Verified helped by ${product.verifiedCount} ${product.verifiedCount === 1 ? 'person' : 'people'}.`,
      createdAtIso: startOfTodayIso(now),
      href,
      actions: [action('helped-me', 'It helped me too', href), action('open', 'See the problem', href)],
    }),
  ];
}
