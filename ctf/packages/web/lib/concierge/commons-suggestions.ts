// Hub suggestion chips — the one-tap asks under the Commons chat (issue #471).
//
// Each chip declares its behavior, so tapping does the right thing rather than just pre-filling the
// composer:
//   - 'navigate' chips are actions ("Open the provider directory", "Check my Service Credits"). They
//     open that plugin directly — a navigation, not a question.
//   - 'ask' chips are genuine questions ("What is the GDP tracker showing this week?"). They are sent
//     to the @comic AI assistant, which shows the "reviewing for safety" pending card immediately and
//     the human-approved answer when it is ready — a true one-tap ask.
//
// This is deliberately a small, curated set (the five the design shipped), authored here so each
// chip's behavior is explicit and predictable instead of re-inferred from the text at tap time.

export type CommonsSuggestionChip =
  | { id: string; label: string; kind: 'navigate'; slug: string }
  | { id: string; label: string; kind: 'ask'; question: string };

const COMMONS_SUGGESTION_CHIPS: readonly CommonsSuggestionChip[] = [
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
