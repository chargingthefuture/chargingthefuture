// Content for the public /guidelines page (community discussion guidelines).
//
// Kept as plain data so the page component stays a small renderer, same as /terms.
// This is the page the operator cites when a discussion crosses a line, so every
// rule here must match how moderation actually behaves. Public and sign-in-free
// on purpose: a rule you cannot link to is a rule you cannot enforce fairly.

export const GUIDELINES_EFFECTIVE_DATE = 'July 19, 2026';

export type GuidelineBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export interface GuidelineSection {
  id: string;
  heading: string;
  blocks: GuidelineBlock[];
}

export const GUIDELINE_SECTIONS: GuidelineSection[] = [
  {
    id: 'purpose',
    heading: 'What this platform is for',
    blocks: [
      {
        type: 'p',
        text:
          'This platform exists to build a psyop-free economy: survivors exchanging real skills, real help, and real resources with each other. Every discussion space — the Commons, the members-only channel, plugin Direct Lines, and replies anywhere — is for that. The focus is us, not them.',
      },
    ],
  },
  {
    id: 'acceptable',
    heading: 'Discussions that belong here',
    blocks: [
      {
        type: 'ul',
        items: [
          'Asking for and offering real help: skills, work, training, housing, transport, tools, resources.',
          'Questions about using the app, and answers to them.',
          'Honest conversation and encouragement between survivors, focused on what is being built here.',
        ],
      },
    ],
  },
  {
    id: 'unacceptable',
    heading: 'Discussions that do not belong here',
    blocks: [
      {
        type: 'p',
        text: 'Any of these can lead to a message being removed and, for repeated or serious cases, to account restriction:',
      },
      {
        type: 'ul',
        items: [
          'Advocating, encouraging, planning, or joking about violence or harm to anyone.',
          'Conversations that are not about a psyop-free economy or lifestyle. You are free to meet members here and continue those conversations off the platform — they just do not belong in these spaces.',
          'Making the space about perps/turning a channel into a forum about "them". Discussions here focus on what survivors build for each other.',
          'Harassment, demeaning language, or targeting another member.',
          'Soliciting money, gift cards, or financial details from members, or any scam or impersonation.',
          "Sharing another member's personal information, photos, or location without their consent.",
          'Spam, flooding, or advertising unrelated to the community.',
          'Presenting yourself as staff or a moderator when you are not.',
        ],
      },
    ],
  },
  {
    id: 'enforcement',
    heading: 'How this is enforced',
    blocks: [
      {
        type: 'ul',
        items: [
          'A good-faith slip usually gets a reminder and a redirect, in the channel, citing this page.',
          'Messages that cross a line may be removed. In the members-only channel, moderators can read everything (disclosed in the channel) and can remove any post.',
          'Repeated or serious violations lead to account restriction through the safety tools, and members-only channel access is revoked for reviewed cause.',
          'You can block any member from their profile, and escalate a safety concern with a safety report — you never have to argue with someone who is targeting you.',
        ],
      },
      {
        type: 'p',
        text: 'These guidelines are deliberately short. When something is not covered, the test is simple: does it help survivors build, or does it hand the space to the people this platform exists to get away from?',
      },
    ],
  },
];
