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

export const QUORA_MOTD_PEACE_BATTLE_URL = `${QUORA_MOTD_BLOG_BASE}/peace-battle-2`;

/**
 * The three ways to take part in Peace Battle 2, in the order the protest page lists them. Every
 * message ends by asking for exactly one of them, and the day's action rotates, so a reader who
 * comes back three days running is asked for three different things rather than the same thing
 * three times.
 */
export const QUORA_MOTD_ACTIONS = ['fireside', 'ti-radio', 'one-percent'] as const;

export type QuoraMotdAction = (typeof QUORA_MOTD_ACTIONS)[number];

export const QUORA_MOTD_ACTION_LABEL: Record<QuoraMotdAction, string> = {
  fireside: 'Say something under a post',
  'ti-radio': 'Take a slot on TI Radio',
  'one-percent': 'Post your 1%',
};

export type QuoraMotdMessage = {
  /** Stable across edits to the text. Used for the rotation and for saying which one ran when. */
  id: string;
  action: QuoraMotdAction;
  /** The post title. Quora asks for this separately from the body, so it is stored separately. */
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
