// One message a day for the Skills Economy space on Quora.
//
// Why it works this way. Quora erases the accounts this project posts from, and the record of that
// on the blog (old links, new links) shows the erasures are not spread evenly across a day: the
// documented lifetimes run from a handle banned inside the minute it was opened to one that lasted
// thirty-three minutes. So the plan is one post per account, written before the account exists and
// pasted within minutes of creating it — not something composed later in the day, because later in
// the day the account is often gone.
//
// That constraint decides the shape of every message here:
//
// 1. It has to stand on its own. The account and the post die together, so a reader may never get
//    to the link. The text has to carry its point before the link is clicked, and the link is what
//    survives for the people who do.
// 2. It has to be one message, not a choice of several. A new account has no followers, so the
//    post lands in the space or nowhere; one message a day is one thing for everybody who arrives
//    to read, rather than a wall somebody skims past.
// 3. It does not need to evade anything. Handles have been banned before a post could have been
//    read, which puts the decision at the account rather than the writing, so the format is chosen
//    for whoever reads it and nothing else.

export const QUORA_MOTD_SPACE_URL = 'https://skillseconomy.quora.com';

export const QUORA_MOTD_BLOG_BASE = 'https://chargingthefuture.github.io/chargingthefuture';

export function motdArticleUrl(slug: string): string {
  return `${QUORA_MOTD_BLOG_BASE}/article/wiki-site/${slug}`;
}

/**
 * The Peace Battle 2 page, under its short address. It is the lead link in every message (owner
 * decision, 2026-10-02: the page is the pitch, ahead of chargingthefuture.com), so it sits in the
 * opening line rather than at the foot where a reader who stops early never reaches it.
 */
export const QUORA_MOTD_PEACE_BATTLE_URL = `${QUORA_MOTD_BLOG_BASE}/pb2`;

export const ONE_PERCENT_WORKFORCE_URL = 'https://app.chargingthefuture.com/apps/workforce?view=one-percent';
export const GOAL_BOARD_URL = 'https://app.chargingthefuture.com/apps/peer-programming?tab=goals';
export const ONE_PERCENT_PAID_TIER_URL = 'https://farahbrunache.com';

/**
 * The three Enact steps on the Peace Battle 2 page, in the order the page lists them. Every
 * message asks for exactly one of them, and the day's step rotates, so a reader who comes back
 * three days running is asked for three different things rather than the same thing three times.
 * Fireside and TI Radio were steps until 2026-10-02 and left the page that day, so they left here
 * too: the messages follow the page.
 */
export const QUORA_MOTD_ACTIONS = ['one-percent', 'goal-board', 'one-percent-call'] as const;

export type QuoraMotdAction = (typeof QUORA_MOTD_ACTIONS)[number];

export const QUORA_MOTD_ACTION_LABEL: Record<QuoraMotdAction, string> = {
  'one-percent': 'See your 1%',
  'goal-board': 'Start on it on the goal board',
  'one-percent-call': 'Take it further with One Percent',
};

/**
 * The line every post opens with: which day of the protest it is, and the page to come back to.
 *
 * The day is the same count the page's clock shows, days since Friday 18 September 2026 at 7:00 PM
 * Eastern, taken by calendar day in Eastern so it changes once a day rather than at 7 PM. The
 * opening night is not counted as a day of its own; the first full day is Day 1.
 */
export function motdDayLine(dayIndex: number): string {
  const day = Math.max(1, dayIndex);
  return `Day ${day} of Peace Battle 2, the global protest Targeted Individuals are holding for our lives. We are taking a stand by building what they cannot take: ${QUORA_MOTD_PEACE_BATTLE_URL}`;
}

export type QuoraMotdMessage = {
  /** Stable across edits to the text. Used for the rotation and for saying which one ran when. */
  id: string;
  action: QuoraMotdAction;
  /**
   * The first line of the post. Quora's composer has no title field — a post is one box — so this
   * is copied together with the body rather than on its own. It stays a separate value because the
   * screen lists it by itself when showing which message runs on which day.
   */
  title: string;
  /**
   * The post itself, already in the shape Quora accepts: plain text, one paragraph per line, no
   * markdown of any kind (Quora's editor shows every marker literally), and ending with the
   * `Full post:` line. The label on that line is load-bearing — a bare address alone on its own
   * line is what the editor turns into a preview card, and the blog paste sheets have always kept
   * the link as written instead.
   */
  body: string;
};
