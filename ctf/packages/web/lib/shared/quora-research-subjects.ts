// The one subject list for both halves of the Quora research.
//
// The deletion survey records what was removed; the live census records what is still standing.
// Neither answers the question alone — "accounts writing about this get removed" is a claim about
// the difference between the two — and that comparison only means something if both are coded
// with the same categories.
//
// The two carried identical copies of this list until the census merged (2026-08-19). Copies do
// not stay identical: someone adds a subject to one, the other keeps its five, and the comparison
// silently starts comparing different things while every test still passes and every screen still
// renders. There is nothing to notice. So there is one list, here, and both sides import it.
//
// Adding or renaming a value changes the meaning of every run and every response already recorded
// under the old list. Rows are not recoded retroactively, so a value added today makes rows from
// before today unclassifiable rather than merely uncounted. Treat a change here as a change to the
// research, not to a dropdown.

export const QUORA_RESEARCH_SUBJECT = [
  'targeting_and_gang_stalking',
  'surveillance_and_harassment_tactics',
  'coping_and_support',
  'legal_and_reporting',
  'organizing_and_meetups',
  'unrelated_subjects',
] as const;

export type QuoraResearchSubject = (typeof QUORA_RESEARCH_SUBJECT)[number];

export const QUORA_RESEARCH_SUBJECT_LABEL: Record<QuoraResearchSubject, string> = {
  targeting_and_gang_stalking: 'Targeting and gang stalking',
  surveillance_and_harassment_tactics: 'Surveillance and harassment tactics',
  coping_and_support: 'Coping, support, encouragement',
  legal_and_reporting: 'Legal steps and reporting',
  organizing_and_meetups: 'Organizing, meetups, community building',
  unrelated_subjects: 'Subjects unrelated to targeting',
};
