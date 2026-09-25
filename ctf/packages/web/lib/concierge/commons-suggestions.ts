// Hub suggestion chips — the one-tap asks under the Commons chat (issue #471).
//
// Each chip declares its behavior, so tapping does the right thing rather than just pre-filling the
// composer:
//   - 'navigate' chips are actions ("Open the provider directory", "Check my Service Credits"). They
//     open that plugin directly — a navigation, not a question.
//   - 'ask' chips are genuine questions ("What is the GDP tracker showing this week?"). They are sent
//     to the @comic AI assistant, which shows the "reviewing for safety" pending card immediately and
//     the human-approved answer when it is ready — a true one-tap ask.
//   - 'answer' chips are questions with a fixed answer ("I'm new. What do I do first?"). The reply is
//     written here and appears in the chat on the spot, with a button for each place it names. No AI
//     draft and no review queue: a member who has just signed in should not wait on a person to be
//     told where to start (owner decision, 2026-09-25).
//
// This is deliberately a small, curated set, authored here so each chip's behavior is explicit and
// predictable instead of re-inferred from the text at tap time.

export type CommonsChipAction = { label: string; href: string };

export type CommonsSuggestionChip =
  | { id: string; label: string; kind: 'navigate'; slug: string }
  | { id: string; label: string; kind: 'ask'; question: string }
  | { id: string; label: string; kind: 'answer'; question: string; reply: string; actions: CommonsChipAction[] };

// The three things a new member does first, in order. The blog post of the same name carries the
// long version; this is the short one, and the two must say the same three things.
const NEW_HERE_REPLY = [
  'Three things, in order.',
  '1. Send the web address of your Quora profile on the Unlock screen. A person reads it, and almost everything else opens after. If you cannot find the address, that screen has a button to ask for help here.',
  '2. While you wait, write. Under any post on the blog (Fireside), or lend your public Quora writing to the assistant (Knowledge Library). Both go into the same queue as your check, so writing is a way in.',
  '3. Once approved, put your skills on the Directory, so another member can find you.',
].join('\n\n');

const COMMONS_SUGGESTION_CHIPS: readonly CommonsSuggestionChip[] = [
  // First in the row: the member most likely to be reading this row for the first time is the one
  // who has just signed in.
  {
    id: 'new-here',
    label: "I'm new. What do I do first?",
    kind: 'answer',
    question: "I'm new. What do I do first?",
    reply: NEW_HERE_REPLY,
    actions: [
      { label: 'Open Unlock →', href: '/plugin/unlock' },
      { label: 'Open Fireside →', href: '/apps/fireside' },
      { label: 'Open the Knowledge Library →', href: '/knowledge' },
      { label: 'Open the Directory →', href: '/apps/directory' },
      { label: 'Read the post →', href: 'https://chargingthefuture.github.io/chargingthefuture/article/wiki-site/new-here-three-things-to-do-first' },
    ],
  },
  { id: 'housing', label: 'Show housing options', kind: 'navigate', slug: 'lighthouse' },
  // The provider directory is Foundation (talent, tools, repairs, infrastructure support), NOT the
  // Directory plugin — that one is the community skills directory below.
  { id: 'providers', label: 'Open the provider directory', kind: 'navigate', slug: 'foundation' },
  { id: 'skills', label: 'Browse the skills directory', kind: 'navigate', slug: 'directory' },
  { id: 'credits', label: 'Check my Service Credits', kind: 'navigate', slug: 'service-credits' },
  {
    id: 'gdp-week',
    label: 'What is the GDP tracker showing this week?',
    kind: 'ask',
    question: 'What is the GDP tracker showing this week?',
  },
  // Note: Workforce is intentionally not a chip — it is the real-time global work/skills-distribution
  // dashboard and doesn't reduce to an accurate one-line "do this" action. Add it back only with an
  // owner-provided description.
];

// The chips shown under the Commons composer, in order. Kept as a function (not a bare export) to
// match the sibling `conciergeStarterPrompts` shape and leave room for future per-viewer filtering.
export function commonsSuggestionChips(): CommonsSuggestionChip[] {
  return [...COMMONS_SUGGESTION_CHIPS];
}
