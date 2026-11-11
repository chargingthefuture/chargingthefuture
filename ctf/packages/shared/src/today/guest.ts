// Today for a visitor who is not signed in, shared by web and Android: the words of the approved
// signed-out board ("Today, signed out" in the 3.1 design canvas) and which cards a visitor can
// answer only by signing up.

import type { SeTodayCard } from './types';

export const SE_GUEST_WORDS = {
  brand: 'Skills Economy',
  signIn: 'Sign in',
  signUp: 'Sign up',
  hero: "Skills Economy is where the Avenhood meets: survivors giving half an hour a day to each other's goals. That is less time on Specterati schemes, and more time for all of us reaching our own definition of happiness. Free. Exit their economy, exit the psyop.",
  live: 'LIVE',
  listen: 'Listen as a guest',
  listenNote: 'Anyone can listen, no account needed. Sign in to speak.',
  listenUnavailable: "Listening in without an account isn't available right now.",
  quiet: 'Quiet right now',
  playReadings: 'Play readings',
  readingsNote: 'Recorded blog posts, one after another',
  nextRoom: 'Next room',
  cardsTitle: "Today's cards",
  member: 'A member',
  answer: 'Sign up to answer',
  peopleTitle: 'People',
  peopleLocked: 'Who is here and what they can do opens once a member is reviewed.',
  bar: 'Free. Use one part, ignore the rest.',
  loading: 'Loading Today…',
  failed: 'Could not load Today.',
  tryAgain: 'Try again',
  // The tag on a card or number read from sample data (a lock and "Sample": the real thing is private,
  // not empty), its spoken label, and the one line under the cards that says why.
  sample: 'Sample',
  sampleLabel: 'Sample, shown in place of private member data',
  sampleNote: 'Some content is sample data to protect member privacy.',
  // A card opened by a visitor: read only, with the conversation, and Just us two asking for a sign-in.
  conversation: 'Conversation',
  close: 'Close',
  signInToWrite: 'Sign in to write here',
  pairEmpty: 'Just us two is a private conversation between two members. Nothing in it is shown here.',
  pairSignIn: 'Sign in to have private conversations',
  noMessages: 'Nobody has written here yet.',
  loadingConversation: 'Loading the conversation…',
} as const;

// The cards a visitor can open: a story (its post's Fireside comments, real and public) and the
// sample ask and offer cards (a sample conversation from the demo schema).
export const SE_GUEST_SHEET_SOURCES: readonly string[] = ['blog-story', 'trust-transport', 'skill-up'];

export function seGuestOpensSheet(card: Pick<SeTodayCard, 'source'>): boolean {
  return SE_GUEST_SHEET_SOURCES.includes(card.source);
}

export type SeGuestMessage = { id: string; handle: string; body: string; createdAtIso: string; editedAtIso: string | null };

// GET /api/today/public/cards/[cardId]: `sample` is true when the messages are sample data.
export type SeGuestConversation = { sample: boolean; messages: SeGuestMessage[] };

// An ask or an offer is answered by a member; a visitor sees who as "A member" and a Sign up button.
export function seGuestAnswersBySignUp(card: SeTodayCard): boolean {
  return card.kind === 'ask' || card.kind === 'offer' || card.kind === 'match';
}

// "Started at 1:53 PM" in the reader's own timezone, for a talk that is on.
export function seGuestStartedLine(startIso: string): string {
  return `Started at ${new Date(startIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;
}

// "Wednesday, October 28 at 7:00 PM CDT" for the next room on a quiet day.
export function seGuestNextRoomLine(startIso: string): string {
  const start = new Date(startIso);
  const day = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return `${day} at ${time}`;
}
