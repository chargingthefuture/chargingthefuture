// The Today read: one answer that carries everything the Today screen draws, so the screen makes a
// single request and can keep the last answer on the phone to draw at once on the next open.
// Built on the server by ctf/packages/web/lib/today/; drawn by web components/se-frame/today/ and
// Android src/features/se-frame/today/.

import type { SeCardKind } from '../design/se-theme';
import type { SeTodayGoal } from './goal-share';

// What a quick response does. Each opens the item where it lives; a response that writes
// something (an offer of help, "This helped me") is made there, by the feature that owns it.
export type SeTodayActionKind = 'open' | 'help' | 'know-someone' | 'want' | 'helped-me' | 'join' | 'listen' | 'check-in';

export type SeTodayAction = { kind: SeTodayActionKind; label: string; href: string };

export type SeTodayAuthor = { accountId: string; handle: string };

export type SeTodayCard = {
  // `${source}:${sourceId}`, stable across reads so a card keeps its read and hidden state.
  id: string;
  kind: SeCardKind;
  source: string;
  // The small colored line above the title, e.g. "Ask", "Offer · a place to stay".
  label: string;
  title: string;
  body: string | null;
  author: SeTodayAuthor | null;
  createdAtIso: string;
  // Where the full feature opens.
  href: string;
  actions: SeTodayAction[];
  // Set by the server when the member already did what the card asks (a 21 Questions answer): the
  // card stays and shows done, and the dot cannot mark it not done.
  done?: boolean;
  // On a blog story: when each comment anybody can read in its Fireside conversation was written,
  // newest first (up to 50).
  // Used by the server to apply the member's marks (seApplyCardMarks) and never sent.
  commentTimesIso?: string[];
  // When the member marked this card done today (it leaves Today from their next day).
  markedDoneAtIso?: string;
  // A story the member marked done that came back: how many comments were written since.
  newComments?: number;
  // Set on signed-out Today when the card was read from the demo schema rather than from members'
  // rows, so the screen can tag it as sample data.
  sample?: boolean;
  // Set only on an ask or offer the viewer posted: when it leaves Today, and what they can do there.
  mine?: SeTodayCardMine;
  // Set for a signed-in member on a story or replay they saved for later (today_card_saves).
  saved?: boolean;
  // Set only on the viewer's own PeerProgramming goal (open, or reached in the last 7 days): how far it
  // got, for the "Your goal" card's bar and its Share this goal picture.
  goal?: SeTodayGoal;
};

// An ask or offer as its poster sees it on Today. `leavesIso` is its deadline, or the end of its 14
// days; `dueIso` is the deadline the poster chose, if any. An offer cannot be closed from Today, and
// an ask with a deadline is not renewed (it stays until the deadline).
export type SeTodayCardMine = {
  leavesIso: string;
  dueIso: string | null;
  canClose: boolean;
  canRenew: boolean;
};

// The next booked TI Radio talk, held in the Main Room. `onAir` while its 90 minutes are running.
export type SeTodayTalk = {
  title: string;
  host: string;
  startIso: string;
  endIso: string;
  onAir: boolean;
};

export type SeTodayRoom = {
  key: 'main' | 'weavers';
  name: string;
  live: boolean;
  // Signed-in members in the room, and signed-out guests listening (always 0 in Weavers).
  members: number;
  guests: number;
  // Members on the stage right now, and up to five account ids (speakers first) for the faces on
  // the card. Signed-out Today gets no faces.
  speakers: number;
  faces: string[];
  href: string;
  // Main Room only.
  nextTalk: SeTodayTalk | null;
};

// `host` is the broadcaster's handle and `startedAtIso` when it went live, for the line under the
// title; either is null when it could not be read.
export type SeTodayBroadcast = { live: boolean; title: string | null; href: string; host?: string | null; startedAtIso?: string | null };

export type SeToday = {
  generatedAtIso: string;
  // Signed-in members who read Today in the last 10 minutes, the reader included; null when unknown.
  presence: number | null;
  // How many stories open at the member's next midnight (seStoriesForDay); null when unknown.
  storiesTomorrow?: number | null;
  // All members' action minutes ÷ 480, in total and over the last 7 days; null when it could not
  // be read.
  // `sample` is set on signed-out Today, which reads it from the demo schema.
  daysWon: { total: number; thisWeek: number; sample?: boolean } | null;
  broadcast: SeTodayBroadcast | null;
  rooms: SeTodayRoom[];
  // The talks booked in the Main Room from now through the next 7 days, oldest first, for the week
  // strip.
  week: SeTodayTalk[];
  cards: SeTodayCard[];
  // Sources that failed to read this time, named so the screen can say so rather than look empty.
  unavailable: string[];
};
