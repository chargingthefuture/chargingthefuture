// Shapes the invite screens read from the invite routes, and the date as they show it.

// `blogUrl` is present only on an invite already published on the blog (a public one).
export type InviteCard = { name: string; opening: string; date: string; url: string; blogUrl?: string };

export type OpenInviteCard = InviteCard & { blogUrl: string };

export type InviteTeaser = { name: string; opening: string };

export type PublicInvites = {
  listed: number;
  invites: InviteCard[];
  invite: InviteCard | null;
  openWall: { total: number; page: number; pageCount: number; pageSize: number; from: number; to: number; invites: OpenInviteCard[] };
  lockedCount: number;
  lockedTeasers: InviteTeaser[];
};

export type FullInvite = {
  slug: string;
  name: string;
  title: string;
  opening: string;
  bodyMarkdown: string;
  date: string;
  quoraUrl: string;
  quoraHandle: string;
  directoryProfileUrl: string | null;
  image: { url: string; alt: string } | null;
  isPublic: boolean;
  blogUrl: string | null;
};

export type InvitePage = {
  listed: number;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  from: number;
  to: number;
  invite: FullInvite | null;
  invites: FullInvite[];
};

/** "Oct 15, 2026" from "2026-10-15". The date is a calendar day, so it is read at noon UTC. */
export function formatInviteDate(iso: string): string {
  const at = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The seed for a card's avatar: the Quora handle in the card's app address (`?invite=<handle>`), or
 * the name when the address carries none.
 */
export function inviteCardSeed(card: { name: string; url?: string }): string {
  if (card.url) {
    try {
      const handle = new URL(card.url, 'https://app.invalid').searchParams.get('invite');
      if (handle) return handle;
    } catch {
      // A malformed address falls through to the name.
    }
  }
  return card.name;
}

// Why the invitations exist, shown above them on both walls (owner decision, 2026-10-15).
export const INVITE_WALL_WHY =
  'Why I write these: everyone in the Directory can do something the Skills Economy needs, and I write to each of you by name so you know it. You are seen, heard and wanted here. These are not referral offers, and nobody earns anything for them. Each person is a piece of the same puzzle: dignity and a say over your own life, won together.';
