import type { PoolClient } from 'pg';
import { queryDb } from 'lib/db/postgres';
import {
  FEED_COMMONS_GUIDANCE_INTERVAL,
  FEED_COMMONS_ROOMS_INTERVAL,
  FEED_COMMONS_SIGNAL_INTERVAL_DAYS,
} from 'lib/feed/constants';

// The automatic Commons notices — three standing messages, published as announcements on three
// different rhythms so a newcomer meets each one without anyone having to say it to them personally,
// and a regular is reminded without being singled out.
//
// Every line of every notice is the owner's wording, corrected across several passes. Do not "tidy"
// them. What each one is protecting:
//
//   1. COMMONS PURPOSE — what this place is for, and that threads going nowhere come down.
//      - It is a support channel, NOT where exchanges are arranged or recorded. Skills, trades,
//        housing, rides and calls each live in their own plugin, and those are what get counted. An
//        early draft said trades get "sorted out" here, which would have taught members to do their
//        business in a public thread instead of in the app that records it.
//      - "You can say what is happening to you" is the anti-scare guarantee. A rule about storytelling
//        read alone tells a newly targeted person their experience is unwelcome — the opposite of true,
//        and it would cost the app exactly the members it exists for.
//      - The public rule is TOPIC, not character. An accusation posted to a whole community cannot be
//        retracted, and being wrong about it lands on a survivor.
//      - The exclusion is a FACT, not a feeling: traffickers are "not allowed", never "not tolerated".
//      - The Weaver perk is the private group chat room, NOT the Commons. An earlier draft claimed
//        Weavers "post without restriction" here, which was false.
//      - The no-DM history is deliberately absent: the rule stands on the benefit, and the notice does
//        not owe a whole community an account of what was done to the owner.
//
//   2. PUBLIC ROOMS — what is readable by whom, and where the real connections happen.
//      - The Commons is publicly readable ONLY while `feed_render_config.is_public` is on. It is on by
//        default. If that is ever switched off, this notice becomes wrong and must be edited.
//      - **Chyme's main room IS publicly listenable**, and both spaces work the same way: a public room
//        anyone can read or listen to, plus a private Weavers room. A signed-out visitor does not get
//        the authenticated Chyme branch in `app/apps/[pluginSlug]/page.tsx` — that page falls back to
//        `ChymePublicShell` from the public-visitor registry, which fetches `/api/chyme/public/room` and
//        hands a guest Stream credentials through `ChymeGuestListen` ("Free to listen · Sign in to
//        speak"). Reading only the authenticated branch makes it look gated; it is not.
//      - The assistant claim is precise rather than absolute. A reviewer checking an answer before it
//        goes out does see the question it answers (`comic_review_queue` joins the asker's turn), so
//        the notice says that, instead of promising nobody ever reads them.
//
//   3. SIGNAL VS NOISE — who the owner follows or invites is not a vouch.
//      - The owner gives people the benefit of the doubt on purpose, so an invitation is not a
//        character reference. Members are asked to say when someone is a perp.
//      - Uses "Skills Economy (SE)", never "TI Skills Economy (TSE)" — owner decision, and the
//        approved naming in `ctf/docs/BRAND_VOICE_LEXICON.md`.

export type CommonsNoticeCadence =
  | { kind: 'posts'; every: number }
  | { kind: 'days'; every: number };

export type CommonsNotice = {
  key: string;
  title: string;
  body: string;
  cadence: CommonsNoticeCadence;
};

// Join source-wrapped fragments into ONE paragraph.
//
// This exists because of a real bug that reached members: the notice bodies were written as an array of
// source lines joined with '\n', so the wrapping I used to keep source lines short became HARD LINE
// BREAKS in the rendered text — sentences chopped mid-clause ("whether or / not they have an account").
// Source formatting is not content. Paragraphs are single strings; `para()` lets the source still wrap
// without putting a newline into the text, and paragraphs are joined with a blank line below.
//
// The invariant: a notice body contains '\n\n' between paragraphs and NEVER a lone '\n' inside one.
function para(...fragments: string[]): string {
  return fragments.join(' ');
}

const COMMONS_PURPOSE_BODY = [
  para(
    'On Quora you write into a void. You post, and maybe nobody comes. Here you ask, and someone answers —',
    'me, or another member when I am away. We span every timezone, so somebody is usually awake. That is',
    'the difference, and it is the point of the Commons.',
  ),
  para(
    'Ask in the open. It works better than it sounds. A public question gets answered once where the next',
    'person can find it, instead of sitting in one private thread — so you are never waiting on me alone to',
    'answer.',
  ),
  para(
    'You can say what is happening to you. Being targeted is why we are here, and nobody is asking you to',
    'keep it quiet. What we do differently is finish the thought: say what is going on and what you need,',
    'and someone helps with that part. A story with a question in it gets you somewhere. That is the only',
    'difference we are asking for.',
  ),
  para(
    'The work itself lives in the apps. Skills, trades, housing, rides, calls — each has its own place, and',
    'those are what build the economy and get counted. The Commons is how you find your way to them.',
  ),
  para(
    'Threads that never get to a question do come down, if they keep going. Not for tone, not for',
    'disagreement, and not for who anybody is. Keeping this a place with a purpose is also what keeps it',
    'safe: an open room about nothing is where traffickers go to blend in and harass Targets. They are not',
    'allowed here — not tolerated less, not allowed.',
  ),
  para(
    'Contribute for a while and you become a Weaver of the Commons, which comes with a private group chat',
    'room where none of this applies and you can talk about whatever you like.',
  ),
].join('\n\n');

const COMMONS_ROOMS_BODY = [
  para('A couple of things to keep in mind.'),
  para(
    'This main group chat and the main Chyme room are public. Anyone can read and listen, whether or not',
    'they have an account, and only signed-in members can comment or speak. That is by design — keeping',
    'these spaces public is one of the ways we make it harder for perps to abuse us: what happens here',
    'happens in front of everyone.',
  ),
  para(
    'Please use these two spaces for introductions, and for asking members — or me — questions about the',
    'app and this community.',
  ),
  para(
    'One note: anything you ask the AI Assistant is not public. The only time I look at those messages is to',
    'make sure the assistant itself is safe — when I check an answer before it goes out, I see the question',
    'it is answering. That is the whole of it. It is never to monitor you.',
  ),
  para(
    'And over time, as you use the features that are not public, you unlock the private audio and chat',
    'rooms. Earning your way in like that is the best assurance we have that the people in them are not',
    'perps.',
  ),
].join('\n\n');

const COMMONS_SIGNAL_BODY = [
  para(
    'Every few weeks I post this reminder: the people I follow, invite, or interact with are not necessarily',
    'Targets. Use Skills Economy’s built-in features to tell signal from noise.',
  ),
  para(
    'I recently interacted with someone who is likely a perp. I do not want to rush to conclusions — but',
    'either way, who I follow, invite, or interact with should never be a reason to trust them.',
  ),
  para('Here is the thinking behind that.'),
  para(
    'Matthew was once asked by a Target on Quora, roughly: do you realise you are sometimes responding to',
    'perps’ comments and posts? His answer, also roughly: yes — but I answered truthfully, so it does not',
    'matter that it was a perp, because a real Target will read the same answer and get value from it.',
  ),
  para(
    'I follow the same reasoning. So, a periodic reminder: I give people the benefit of the doubt, which',
    'means I sometimes invite people who might be perps into Skills Economy. Two things follow from that.',
  ),
  para(
    'First, it is our community’s responsibility to tell each other when someone is a perp. When I am told,',
    'I delete their account as soon as possible.',
  ),
  para(
    'Second, to limit a perp’s impact in the meantime, the app gates access and shows openly who is',
    'providing material value to the community and who is not — so you can see who is worth interacting',
    'with.',
  ),
  para(
    'Matthew’s Skills Economy profile (members only):',
    'https://app.chargingthefuture.com/apps/directory/profile/658d846b-d090-4d3e-9e4a-1176b4df37fa',
  ),
].join('\n\n');

// The SHORT version shown on a member's first visit.
//
// Not the same text as the standing notice, on purpose. The card sits above the message stream in a
// fixed-height column, so a long body steals the whole chat area and leaves the member scrolling the
// conversation to get past it — which is exactly what happened when the card rendered the full notice.
//
// It carries only what a first-time poster needs BEFORE they type: this room is public, and the
// assistant is not. Everything else about how the rooms work arrives on the rotation, where length is
// free because an announcement scrolls with the conversation instead of sitting on top of it.
export const COMMONS_FIRST_VISIT_TITLE = 'Before you post';

export const COMMONS_FIRST_VISIT_BODY = [
  para(
    'This chat is public — anyone can read it, account or not. Only signed-in members can post.',
  ),
  para(
    'What you ask the AI Assistant is private.',
  ),
].join('\n\n');

// The three notices, each on its own rhythm.
//
// The rhythms differ because the messages differ in how much it costs to hear one late. Missing the
// purpose notice for a while is survivable — a member learns the topic rule on their next visit. The
// signal-vs-noise one is the owner's standing "every few weeks" reminder and is genuinely time-shaped:
// tying it to post volume would make it fire in bursts during a busy week and never during a quiet one.
export const COMMONS_NOTICES: readonly CommonsNotice[] = [
  {
    key: 'commons_purpose',
    title: 'What the Commons is for',
    body: COMMONS_PURPOSE_BODY,
    cadence: { kind: 'posts', every: FEED_COMMONS_GUIDANCE_INTERVAL },
  },
  {
    key: 'public_rooms',
    title: 'Where things are public, and where the work happens',
    body: COMMONS_ROOMS_BODY,
    cadence: { kind: 'posts', every: FEED_COMMONS_ROOMS_INTERVAL },
  },
  {
    key: 'signal_vs_noise',
    title: 'Who I interact with is not a vouch',
    body: COMMONS_SIGNAL_BODY,
    cadence: { kind: 'days', every: FEED_COMMONS_SIGNAL_INTERVAL_DAYS },
  },
];

// Backwards-compatible aliases for the first notice, kept because the change log and test script name
// them. The registry above is the source of truth.
export const COMMONS_GUIDANCE_TITLE = COMMONS_NOTICES[0].title;
export const COMMONS_GUIDANCE_BODY = COMMONS_NOTICES[0].body;

// Which period a notice is currently in, or null when it is not due.
//
// For a post cadence: due only when the count lands EXACTLY on a multiple, so the notice appears once
// per milestone rather than on every post past a threshold. The period is that count.
//
// For a day cadence: the period is the interval index (whole days since the epoch divided by the
// interval). It becomes due the first time a post is made inside a new interval — which means a notice
// on a time cadence is delivered by the next post, not by a clock. A reminder nobody is present for is
// worth nothing, so this is the intended behaviour and not a compromise; in a silent room, nothing is
// published until somebody shows up.
export function dueMilestoneFor(
  notice: CommonsNotice,
  input: { postCount: number; nowMs: number },
): number | null {
  if (notice.cadence.kind === 'posts') {
    const { postCount } = input;
    if (!Number.isInteger(postCount) || postCount <= 0) {
      return null;
    }
    return postCount % notice.cadence.every === 0 ? postCount : null;
  }

  const days = Math.floor(input.nowMs / 86_400_000);
  return Math.floor(days / notice.cadence.every);
}

// Kept for the original single-notice call sites and tests.
export function isGuidanceMilestone(postCount: number): boolean {
  if (!Number.isInteger(postCount) || postCount <= 0) {
    return false;
  }
  return postCount % FEED_COMMONS_GUIDANCE_INTERVAL === 0;
}

// Claim one notice's period. Returns true only for the caller that won it.
//
// The UNIQUE constraint on (notice_key, milestone_count) is the whole concurrency story: two members
// posting at the same moment can both compute the same period and both try to claim it, but exactly one
// insert survives `ON CONFLICT DO NOTHING`. The loser skips silently rather than publishing a second
// copy of the same notice.
export async function claimGuidanceMilestone(
  client: PoolClient,
  milestoneCount: number,
  noticeKey = 'commons_purpose',
): Promise<boolean> {
  const claimed = await client.query(
    `
      INSERT INTO feed_commons_guidance_milestones (notice_key, milestone_count)
      VALUES ($2, $1)
      ON CONFLICT (notice_key, milestone_count) DO NOTHING
      RETURNING id
    `,
    [milestoneCount, noticeKey],
  );
  return claimed.rows.length > 0;
}

// Record which announcement a claimed period produced, for the audit trail and so an admin can find the
// notice that was posted. Best-effort: the claim already prevents a duplicate, so failing to stamp the
// id must not undo a notice that is already live.
export async function stampGuidanceAnnouncement(
  client: PoolClient,
  milestoneCount: number,
  announcementId: string,
  noticeKey = 'commons_purpose',
): Promise<void> {
  await client.query(
    `
      UPDATE feed_commons_guidance_milestones
      SET announcement_id = $2::uuid
      WHERE milestone_count = $1 AND notice_key = $3
    `,
    [milestoneCount, announcementId, noticeKey],
  );
}

// The notice a member is shown once, on their first Commons visit, in addition to the rotation.
//
// Only the public-rooms notice qualifies, and the reason is specific: it is the one where hearing it
// late has a real cost. A member who does not know the room is readable by anyone — including people
// who are not members — can say something identifying before their first cadence hit ever arrives. The
// purpose and signal notices are fine to meet on a rotation; this one is not.
export const COMMONS_FIRST_VISIT_NOTICE_KEY = 'public_rooms';

// The card's own short text, not the standing notice's full body. Returns the cadence entry's key so
// "seen" is still tracked against `public_rooms`, while the wording stays deliberately brief.
export function firstVisitNotice(): { title: string; body: string } | null {
  const exists = COMMONS_NOTICES.some((n) => n.key === COMMONS_FIRST_VISIT_NOTICE_KEY);
  return exists ? { title: COMMONS_FIRST_VISIT_TITLE, body: COMMONS_FIRST_VISIT_BODY } : null;
}

// Has this member already been shown the first-visit notice?
//
// Fails CLOSED — on a read error it reports "already seen" and shows nothing. Showing a privacy notice
// twice is harmless, but a database hiccup should not be able to make the Commons pop a modal at a
// member on every single visit, which is how a notice trains people to dismiss it unread.
export async function hasSeenFirstVisitNotice(userId: string): Promise<boolean> {
  try {
    const result = await queryDb<{ user_id: string }>(
      'SELECT user_id FROM feed_commons_notice_seen WHERE user_id = $1 AND notice_key = $2 LIMIT 1',
      [userId, COMMONS_FIRST_VISIT_NOTICE_KEY],
    );
    return result.rows.length > 0;
  } catch {
    return true;
  }
}

// Record that a member has seen it. Idempotent, and never throws: failing to record is a repeat
// showing, which is a smaller harm than an error thrown at someone reading a notice.
export async function markFirstVisitNoticeSeen(userId: string): Promise<void> {
  try {
    await queryDb(
      `
        INSERT INTO feed_commons_notice_seen (user_id, notice_key)
        VALUES ($1, $2)
        ON CONFLICT (user_id, notice_key) DO NOTHING
      `,
      [userId, COMMONS_FIRST_VISIT_NOTICE_KEY],
    );
  } catch {
    // Deliberately swallowed — see above.
  }
}
