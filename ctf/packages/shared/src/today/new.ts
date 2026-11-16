// + New in 3.1, shared by web and Android, to the approved board "New post": the sheet's words, the
// Ask form's words and its suggestions, and where an Offer or a Story is made. An Ask is posted as a
// SocketRelay request, public, with no place on it; an Ask broken into small tasks is posted as a
// goal on the member's PeerProgramming board, which is where small tasks live.

export const SE_NEW_SHEET_WORDS = {
  label: 'New post',
  close: 'Close',
  guidelines: 'Community guidelines',
  guidelinesHref: '/guidelines',
  heading: 'Post something',
  intro: "It goes into everyone's Today.",
  kinds: 'Kind of post',
  architect: 'A question about the app? Ask the architect',
};

export type SeNewKind = 'ask' | 'offer' | 'story' | 'talk' | 'architect';

// The switch at the top of the sheet. Ask the architect is not in it: it opens from the line under
// the switch, since the board has four choices.
export const SE_NEW_KINDS: ReadonlyArray<{ key: Exclude<SeNewKind, 'architect'>; label: string }> = [
  { key: 'ask', label: 'Ask' },
  { key: 'offer', label: 'Offer' },
  { key: 'story', label: 'Story' },
  { key: 'talk', label: 'Talk' },
];

export const SE_ASK_WORDS = {
  what: 'What do you need?',
  details: 'Details',
  optional: '(optional)',
  hint: 'Everyone can read this. Keep times and places for the private conversation.',
  suggestions: 'Suggestions',
  submit: 'Post',
  submitting: 'Posting…',
  posted: 'Posted. It shows on Today, and answers come to Activity.',
  failed: 'Could not post the ask.',
  defaultTag: 'Help',
};

// "+ Break it into small tasks": the ask becomes a goal on the member's PeerProgramming board, with
// each task one that anybody can take on its own. A goal has a title and tasks and nothing else.
export const SE_ASK_TASK_WORDS = {
  add: '+ Break it into small tasks',
  task: 'Small task',
  another: '+ Another task',
  remove: 'Remove',
  none: 'No small tasks',
  note: 'With small tasks, this goes on your goal board in PeerProgramming, where anybody can take one. A goal carries no details.',
  posted: 'Posted to your goal board. It shows on Today.',
  failed: 'Could not post the goal.',
};

// The goal board's own limits (lib/peer-programming/constants.ts).
export const SE_ASK_MAX_TASKS = 30;
export const SE_ASK_MAX_TASK_LENGTH = 300;

// The tasks typed so far, blanks left out, as the goals route takes them.
export function seAskTasks(tasks: readonly string[]): string[] {
  return tasks.map((task) => task.trim()).filter((task) => task.length > 0);
}

export const SE_OFFER_WORDS = {
  intro: 'Offer what you have. Each one opens where it is made.',
};

export const SE_STORY_WORDS = {
  intro: 'Lend your own public writing, such as Quora answers, to the Knowledge Library.',
  open: 'Bring your writing',
  href: '/knowledge',
};

export const SE_OFFER_CHOICES: ReadonlyArray<{ key: string; label: string; text: string; href: string }> = [
  { key: 'place', label: 'A place to stay', text: 'List a room or a place to stay.', href: '/apps/lighthouse' },
  { key: 'hours', label: 'Hours', text: 'Share times you are free. Others pick one in their own timezone.', href: '/apps/mutual-time' },
  { key: 'ride', label: 'A ride', text: 'Drive somebody who needs to get somewhere. Drivers are screened by the community.', href: '/apps/trust-transport' },
  { key: 'skill', label: 'A skill', text: 'Offer a skill, a tool or a repair.', href: '/apps/foundation' },
];

// The holiday asks (44), grouped. Tapping one fills the ask and names its group as the tag.
export const SE_HOLIDAY_ASKS: ReadonlyArray<{ group: string; asks: readonly string[] }> = [
  {
    group: 'Food',
    asks: [
      'Groceries shopped for and delivered',
      'Holiday meal ingredients',
      'Ready-to-eat meals delivered',
      'A food box with easy-to-make items',
      'A grocery gift card',
      'A holiday meal for one',
      'A holiday meal kit for my household',
      'A free community meal nearby',
    ],
  },
  {
    group: 'Getting around',
    asks: [
      'A transit or gas card',
      'A ride to a food pantry',
      'A ride to an appointment',
      'A ride to the pharmacy or grocery store',
      'Prescriptions picked up and delivered',
      'A ride for my child to an activity or community event',
      'Company while I run errands',
    ],
  },
  {
    group: 'Warmth',
    asks: [
      'A warm coat, jacket or snow pants',
      'Hats, gloves, scarves and warm socks',
      'Blankets',
      'Weather-appropriate shoes',
      'Pajamas or winter clothes for my child',
    ],
  },
  {
    group: 'Care',
    asks: [
      'A personal-care kit',
      'Diapers and baby wipes',
      'Formula or baby food',
      'Help with laundry or laundromat costs',
      'A haircut or grooming appointment',
    ],
  },
  { group: 'Home', asks: ['Help carrying groceries or donated items', 'Help moving or setting up household essentials'] },
  {
    group: 'Paperwork and services',
    asks: [
      'Help replacing a lost ID',
      'Help with forms or a benefits application',
      'Help finding local services',
      'A list of nearby meals, shelters, warming centers, clinics and benefits',
      'Help calling an agency or making an appointment',
      'Access to a computer and internet',
      'A place to charge my phone, or a prepaid phone card',
    ],
  },
  {
    group: 'Children',
    asks: [
      'New, age-appropriate toys',
      'Books, art supplies or games for my child',
      'A gift card so I can choose what my children need',
      'School supplies',
      'Help with childcare costs',
      'Trusted childcare for a few hours',
      'A quiet place for my child to do homework',
    ],
  },
  {
    group: 'Company',
    asks: ['An invitation to a low-pressure community gathering', 'A friendly holiday check-in call', 'Ongoing support after the holidays'],
  },
];

export type SeAskSuggestion = { text: string; group: string };

// Suggestions for what the member has typed so far: every word they typed appears in the ask. With
// nothing typed, the first of each group.
export function seAskSuggestions(typed: string, limit = 6): SeAskSuggestion[] {
  const words = typed.toLowerCase().split(/\s+/).filter((word) => word.length > 1);
  const all = SE_HOLIDAY_ASKS.flatMap((group) => group.asks.map((text) => ({ text, group: group.group })));
  if (words.length === 0) return SE_HOLIDAY_ASKS.map((group) => ({ text: group.asks[0], group: group.group })).slice(0, limit);
  return all.filter((item) => words.every((word) => item.text.toLowerCase().includes(word))).slice(0, limit);
}

// A suggestion split for display: the part that matches what was typed, shown bold, and the rest.
// When the suggestion does not start with what was typed, nothing is bold.
export function seAskSuggestionParts(typed: string, text: string): { lead: string; rest: string } {
  const start = typed.trimStart();
  if (start && text.toLowerCase().startsWith(start.toLowerCase())) return { lead: text.slice(0, start.length), rest: text.slice(start.length) };
  return { lead: '', rest: text };
}

// + New → Ask the architect (3.1.0 plan: @comic becomes Ask the architect). A question about the app
// or about finding help goes to the assistant; a person reads every answer before the member sees
// it, so the member is told it is being checked, then sees the answer here and in Activity.
export const SE_ARCHITECT_WORDS = {
  title: 'Ask the architect',
  intro: 'A question about the app, or about where to find help. A person reads every answer before you see it.',
  question: 'Your question',
  submit: 'Ask',
  submitting: 'Sending…',
  failed: 'The question was not sent.',
  sent: 'Sent. A person checks the answer first; it appears here and in Activity.',
  yours: 'Your questions',
  pending: 'Being checked',
  loading: 'Loading your questions…',
  loadFailed: 'Your questions could not be loaded.',
  helpful: 'Helpful',
  notHelpful: 'Not helpful',
  rated: 'Rating saved.',
  rateFailed: 'The rating was not saved.',
} as const;

// The assistant takes 600 characters a message, and the @comic mention uses seven of them.
export const SE_ARCHITECT_MAX_QUESTION = 590;

export type SeArchitectItem = {
  questionTurnId: string;
  status: 'pending' | 'answered';
  question: string;
  answer: string | null;
  answerTurnId: string | null;
  currentUserRating: 'helpful' | 'not_helpful' | 'flagged' | null;
  linkedPlugins: { slug: string; name: string }[];
  askedAtIso: string;
};

// The assistant only answers a message that names it, as the 3.0 chat did with @comic.
export function seArchitectMessage(question: string): string {
  return `@comic ${question.trim()}`;
}
