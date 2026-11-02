// 21 Questions (3.1.0 plan, task 18): short questions with a few answers to pick from, one a day,
// the same for everyone. Members who picked the same answer on enough questions are shown to each
// other as a match, and talk inside the match card. Shared by web and Android.
//
// The list is filtered: no question about home or family, where somebody lives, who they live with,
// or how they grew up. Those are the questions that hurt most here, and they are the ones the
// Specterati use to find a person. `seQuestionAllowed` is the filter, and it runs on every question
// below, so one added by mistake is left out rather than asked.

export type SeQuestion = { id: string; text: string; choices: string[] };

// Ids never change and are never reused: answers are stored against them.
const ALL: SeQuestion[] = [
  { id: 'q01', text: 'Morning or night: when does your best work happen?', choices: ['Early morning', 'Afternoon', 'Late night', 'It moves around'] },
  { id: 'q02', text: 'Learning something new, you would rather:', choices: ['Read about it', 'Watch someone do it', 'Try it and break it', 'Be walked through it'] },
  { id: 'q03', text: 'A task you dread: do it first or last?', choices: ['First, get it over with', 'Last, warm up first', 'Split it into pieces', 'Hand it to someone better at it'] },
  { id: 'q04', text: 'Which would you rather fix?', choices: ['A machine', 'A piece of writing', 'A plan', 'A disagreement'] },
  { id: 'q05', text: 'Working alongside somebody, you want them to:', choices: ['Talk it through', 'Work quietly beside you', 'Split the work and check in', 'Lead while you follow'] },
  { id: 'q06', text: 'The skill you would most like to have by next year:', choices: ['A trade with tools', 'A language', 'Code', 'Something with your hands and art'] },
  { id: 'q07', text: 'Paper notes or phone notes?', choices: ['Paper', 'Phone', 'Both', 'I keep it in my head'] },
  { id: 'q08', text: 'A free afternoon with no plans. You:', choices: ['Go outside', 'Make something', 'Read or listen', 'Rest, properly'] },
  { id: 'q09', text: 'When someone asks for help, your first move is:', choices: ['Do it with them', 'Show them how', 'Point them to who knows', 'Ask what they already tried'] },
  { id: 'q10', text: 'Which is harder for you?', choices: ['Starting', 'Finishing', 'Asking for help', 'Saying no'] },
  { id: 'q11', text: 'Music while you work?', choices: ['Always', 'Only without words', 'Silence', 'Talk radio or podcasts'] },
  { id: 'q12', text: 'You trust a person more after they:', choices: ['Keep a small promise', 'Admit a mistake', 'Show up twice', 'Tell you something hard'] },
  { id: 'q13', text: 'Which would you rather teach?', choices: ['How to cook something', 'How to fix something', 'How to write something', 'How to stay calm'] },
  { id: 'q14', text: 'A long trip: how do you go?', choices: ['Drive', 'Train or bus', 'Fly', 'I would rather not go'] },
  { id: 'q15', text: 'What gets you through a bad day?', choices: ['Moving my body', 'Making something', 'Talking to someone', 'Sleep'] },
  { id: 'q16', text: 'Big goal: plan it out or start walking?', choices: ['Plan it out', 'Start walking', 'Plan a little, then walk', 'Find someone who has done it'] },
  { id: 'q17', text: 'Which kind of puzzle do you like?', choices: ['Words', 'Numbers', 'Pictures and patterns', 'How something works'] },
  { id: 'q18', text: 'Which would you rather be known for?', choices: ['Being reliable', 'Being skilled', 'Being kind', 'Being honest'] },
  { id: 'q19', text: 'Your phone: tool or trouble?', choices: ['Mostly a tool', 'Mostly trouble', 'Both, every day', 'I keep it off when I can'] },
  { id: 'q20', text: 'Which would you pick up first?', choices: ['A camera', 'A guitar', 'A wrench', 'A sketchbook'] },
  { id: 'q21', text: 'The best way to thank someone who helped you:', choices: ['Help them back', 'Tell other people about them', 'Say it plainly', 'Help someone else'] },
  { id: 'q22', text: 'When you disagree in a group, you:', choices: ['Say so right away', 'Say so afterwards, privately', 'Write it down', 'Let it go if it is small'] },
  { id: 'q23', text: 'Which would you rather grow?', choices: ['Vegetables', 'Flowers', 'Herbs', 'Nothing, I would eat what others grow'] },
  { id: 'q24', text: 'A skill everyone should have:', choices: ['Basic first aid', 'Cooking from scratch', 'Fixing small things', 'Managing time'] },
  { id: 'q25', text: 'How do you like instructions?', choices: ['Written steps', 'A picture or diagram', 'A video', 'A person showing me'] },
  { id: 'q26', text: 'Which tires you out more?', choices: ['Noise', 'Crowds', 'Screens', 'Waiting'] },
  { id: 'q27', text: 'If you could take one class for free:', choices: ['Electrical work', 'Writing', 'Bookkeeping', 'Self-defense'] },
  { id: 'q28', text: 'Weekends or weekdays?', choices: ['Weekends', 'Weekdays', 'No difference to me', 'Depends on the week'] },
  { id: 'q29', text: 'Which would you rather do for an hour?', choices: ['Sort and organize', 'Build something', 'Write something', 'Listen to someone'] },
  { id: 'q30', text: 'Your favorite kind of weather:', choices: ['Hot and sunny', 'Cool and clear', 'Rain', 'Snow'] },
  { id: 'q31', text: 'When you get stuck on a problem, you:', choices: ['Keep at it', 'Walk away and come back', 'Ask someone', 'Search for how others solved it'] },
  { id: 'q32', text: 'Which is worth more to you?', choices: ['Time', 'Quiet', 'Skills', 'People you can count on'] },
  { id: 'q33', text: 'Coffee, tea, or neither?', choices: ['Coffee', 'Tea', 'Both', 'Neither'] },
  { id: 'q34', text: 'Which would you rather repair?', choices: ['Clothes', 'A bike', 'A computer', 'Furniture'] },
  { id: 'q35', text: 'A good day ends with:', choices: ['Something finished', 'Something learned', 'Someone helped', 'Nothing going wrong'] },
  { id: 'q36', text: 'Which job would you try for a week?', choices: ['Baker', 'Mechanic', 'Librarian', 'Park ranger'] },
  { id: 'q37', text: 'How do you keep track of money you spend?', choices: ['A notebook', 'An app or spreadsheet', 'In my head', 'I do not, and I would like to'] },
  { id: 'q38', text: 'Which do you notice first in a room?', choices: ['Who is there', 'Where the exits are', 'What needs fixing', 'The light'] },
  { id: 'q39', text: 'Your way to wind down:', choices: ['A walk', 'A show or film', 'A book', 'A long shower'] },
  { id: 'q40', text: 'Which would you rather share?', choices: ['A meal', 'A skill', 'A tool', 'A story'] },
  { id: 'q41', text: 'Advice is most useful when it is:', choices: ['Short', 'From someone who did it', 'Written down', 'Asked for'] },
  { id: 'q42', text: 'Which would you rather build?', choices: ['A shelf', 'A website', 'A garden bed', 'A schedule that works'] },
];

// Words that make a question about home or family, where a person lives, or how they grew up.
const LEFT_OUT = /\b(home|homes|house|apartment|family|families|mother|mom|father|dad|parent|parents|child|children|kid|kids|son|daughter|brother|sister|sibling|siblings|spouse|husband|wife|partner|married|marriage|relative|relatives|grandparent|grandmother|grandfather|childhood|grew up|grow up|hometown|neighborhood|neighbor|live with|where you live|address)\b/i;

export function seQuestionAllowed(question: SeQuestion): boolean {
  return !LEFT_OUT.test(question.text) && !question.choices.some((choice) => LEFT_OUT.test(choice));
}

export const SE_QUESTIONS: readonly SeQuestion[] = ALL.filter(seQuestionAllowed);

// The first day of questions, and how many shared same answers make a match.
export const SE_QUESTIONS_START = '2026-11-03';
export const SE_MATCH_MIN_SAME = 3;
export const SE_MATCH_MESSAGE_MAX = 500;

export function seQuestionById(id: string): SeQuestion | null {
  return SE_QUESTIONS.find((question) => question.id === id) ?? null;
}

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

// How many questions are out on a day: one on the first day, one more each day after, up to all.
export function seQuestionsOut(day: string): number {
  const index = dayNumber(day) - dayNumber(SE_QUESTIONS_START);
  return Math.max(1, Math.min(SE_QUESTIONS.length, index + 1));
}

// Today's question, the same for everyone: the newest one out, cycling once all are out.
export function seQuestionOfDay(day: string): SeQuestion {
  const index = Math.max(0, dayNumber(day) - dayNumber(SE_QUESTIONS_START));
  return SE_QUESTIONS[index % SE_QUESTIONS.length];
}

// The question a member is shown next: today's if not yet answered, then the earliest one out that
// they have not answered, so somebody new can catch up. Null when every question out is answered.
export function seNextQuestion(day: string, answered: ReadonlySet<string>): SeQuestion | null {
  const today = seQuestionOfDay(day);
  if (!answered.has(today.id)) return today;
  return SE_QUESTIONS.slice(0, seQuestionsOut(day)).find((question) => !answered.has(question.id)) ?? null;
}

export type SeQuestionMatch = {
  accountId: string;
  handle: string;
  same: number;
  both: number;
  // The questions they answered the same, newest first, at most three, for the card.
  sameQuestionIds: string[];
  messages: SeMatchMessage[];
  unread: number;
};

export type SeMatchMessage = { id: string; mine: boolean; body: string; createdAtIso: string };

export function seMatchLine(match: Pick<SeQuestionMatch, 'same' | 'both' | 'handle'>): string {
  return `You and @${match.handle} answered ${match.same} of ${match.both} the same`;
}
