// 21 Questions (3.1.0 plan, task 18): short questions with a few answers to pick from, one a day,
// the same for everyone. Members who picked the same answer on enough questions are shown to each
// other as a match, and talk inside the match card. Shared by web and Android.
//
// The list is filtered: no question about home or family, where somebody lives, who they live with,
// or how they grew up. Those are the questions that hurt most here, and they are the ones the
// Specterati use to find a person. `seQuestionAllowed` is the filter, and it runs on every question
// below, so one added by mistake is left out rather than asked.
// Ids never change and are never reused: answers are stored against them. q01 to q42 were the first
// list, general icebreakers about work habits and small preferences, retired on 2026-11-22 (owner
// decision): they matched people on coffee and weather rather than on what they want in life.
// Their answers were deleted (migration 0113).
//
// The list since then is for one TI finding another by what each wants from life after the
// targeting: work, income, what to learn, who to meet, what to give back. It stays on wants rather
// than on what happened, so a match says what two people are heading toward.
const ALL = [
    { id: 'q43', text: 'Rebuilding an income, you would rather:', choices: ['Learn a trade', 'Work for yourself', 'Find an employer who understands', 'Trade skills with people here'] },
    { id: 'q44', text: 'What kind of work do you want to be doing in five years?', choices: ['A hands-on trade', 'Running something of my own', 'Helping people directly', 'Building or making things'] },
    { id: 'q45', text: 'What do you want more of in your days?', choices: ['Quiet', 'Purpose', 'People I can count on', 'Time outside'] },
    { id: 'q46', text: 'What makes it hardest to tell people what happened?', choices: ['Not being believed', 'Sounding unwell', 'Putting them at risk', 'Not knowing where to start'] },
    { id: 'q47', text: 'What would you most like to build with someone here?', choices: ['A small business', 'A skill swap', 'A project that helps other TIs', 'A friendship'] },
    { id: 'q48', text: 'Which skill would make you most independent?', choices: ['Fixing my own devices', 'Growing or cooking food', 'Earning remotely', 'Knowing my legal options'] },
    { id: 'q49', text: 'Where do you want to put your energy this year?', choices: ['Learning a skill', 'Earning', 'My health', 'Helping others get out'] },
    { id: 'q50', text: 'What do you want from people here first?', choices: ['Someone to talk to', 'Help with a task', 'Work or income', 'Quiet company'] },
    { id: 'q51', text: 'What does a good life look like to you?', choices: ['Simple and quiet', 'Busy and useful', 'Free to move around', 'Surrounded by people I trust'] },
    { id: 'q52', text: 'Which is worth guarding most now?', choices: ['My time', 'My attention', 'My privacy', 'My peace'] },
    { id: 'q53', text: 'What kind of person do you want to meet here?', choices: ['Someone further along', 'Someone at the same point', 'Someone to work with', 'Someone to learn from'] },
    { id: 'q54', text: 'What would you rather help a newer member with?', choices: ['Locking down accounts', 'Finding work', 'Keeping records', 'Getting through the first months'] },
    { id: 'q55', text: 'What do you want to learn next?', choices: ['A trade', 'Tech and security', 'Business and bookkeeping', 'Writing or art'] },
    { id: 'q56', text: 'How do you want to spend your free time?', choices: ['Outdoors', 'Making things', 'Reading and learning', 'With people'] },
    { id: 'q57', text: 'What would tell you that you are moving forward?', choices: ['A steady income', 'A skill learned', 'A friend I trust', 'Telling my story'] },
    { id: 'q58', text: 'What do you want to give back?', choices: ['Teaching what I know', 'Listening', 'Practical help', 'Speaking out'] },
    { id: 'q59', text: 'How do you want to work with people?', choices: ['Side by side', 'Remotely', 'On my own, checking in', 'Leading a small team'] },
    { id: 'q60', text: 'What matters most in someone you team up with?', choices: ['Has been targeted too', 'Respects my boundaries', 'Shows up and does the work', 'Never asks for personal details'] },
    { id: 'q61', text: 'What do you want to leave behind?', choices: ['Work I am proud of', 'People I helped', 'A record of what happened', 'A skill passed on'] },
    { id: 'q62', text: 'Which would you rather have first?', choices: ['Steady work', 'A few people I trust', 'Time to rest', 'A plan of my own'] },
    { id: 'q63', text: 'A year from now, you want to be:', choices: ['Working steadily', 'Living by my own plan', 'Part of a group I trust', 'Helping newer TIs'] },
];
// Words that make a question about home or family, where a person lives, or how they grew up.
const LEFT_OUT = /\b(home|homes|house|apartment|family|families|mother|mom|father|dad|parent|parents|child|children|kid|kids|son|daughter|brother|sister|sibling|siblings|spouse|husband|wife|partner|married|marriage|relative|relatives|grandparent|grandmother|grandfather|childhood|grew up|grow up|hometown|neighborhood|neighbor|live with|where you live|address)\b/i;
export function seQuestionAllowed(question) {
    return !LEFT_OUT.test(question.text) && !question.choices.some((choice) => LEFT_OUT.test(choice));
}
export const SE_QUESTIONS = ALL.filter(seQuestionAllowed);
// The first day of questions, and how many shared same answers make a match.
export const SE_QUESTIONS_START = '2026-11-03';
export const SE_MATCH_MIN_SAME = 3;
export const SE_MATCH_MESSAGE_MAX = 500;
export function seQuestionById(id) {
    return SE_QUESTIONS.find((question) => question.id === id) ?? null;
}
function dayNumber(day) {
    return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}
// How many questions are out on a day: one on the first day, one more each day after, up to all.
export function seQuestionsOut(day) {
    const index = dayNumber(day) - dayNumber(SE_QUESTIONS_START);
    return Math.max(1, Math.min(SE_QUESTIONS.length, index + 1));
}
// Today's question, the same for everyone: the newest one out, cycling once all are out.
export function seQuestionOfDay(day) {
    const index = Math.max(0, dayNumber(day) - dayNumber(SE_QUESTIONS_START));
    return SE_QUESTIONS[index % SE_QUESTIONS.length];
}
// The question a member is shown next: today's if not yet answered, then the earliest one out that
// they have not answered, so somebody new can catch up. Null when every question out is answered.
export function seNextQuestion(day, answered) {
    const today = seQuestionOfDay(day);
    if (!answered.has(today.id))
        return today;
    return SE_QUESTIONS.slice(0, seQuestionsOut(day)).find((question) => !answered.has(question.id)) ?? null;
}
export function seMatchLine(match) {
    return `You and @${match.handle} answered ${match.same} of ${match.both} the same`;
}
