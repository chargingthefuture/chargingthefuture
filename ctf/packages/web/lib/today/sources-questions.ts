import { seMatchLine, seNextQuestion, seQuestionCardBody, seQuestionOfDay, seQuestionById, SE_QUESTIONS, seQuestionsOut, type SeTodayCard } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { listAnswers, listMatches, readMatchingState, summarizeConversations, type ConversationSummary, type MatchRow } from 'lib/questions/repository';
import { author, card, clip, startOfTodayIso, type TodayViewer } from './card';

// 21 Questions on Today (3.1.0 plan, task 18), approved members only: the question to answer next
// (today's, then any earlier one missed), and a Match card for each member who answered at least
// three the same, with the conversation inside the card. The card's own controls answer and send;
// the card carries only what the screen needs to find the question or the person. A member who
// turned matching off still gets the question card, which says so, and no Match cards. Today's
// question card stays once answered, done, with the answer picked, so the day's work stays in
// view; a question missed on an earlier day then gets its own catching-up card beside it.

function dayQuestionCards(day: string, answers: Map<string, number>, matching: boolean, createdAtIso: string): SeTodayCard[] {
  const today = seQuestionOfDay(day);
  const next = seNextQuestion(day, new Set(answers.keys()));
  const out = seQuestionsOut(day);
  const answered = SE_QUESTIONS.slice(0, out).filter((question) => answers.has(question.id)).length;
  const shown = [today, ...(next && next.id !== today.id ? [next] : [])];
  return shown.map((question) => {
    const choice = answers.get(question.id);
    return {
      ...card({
        source: 'questions',
        sourceId: question.id,
        kind: 'match',
        label: question.id === today.id ? "21 Questions · today's question" : '21 Questions · catching up',
        title: question.text,
        body: seQuestionCardBody(answered, out, matching, choice === undefined ? null : (question.choices[choice] ?? null)),
        createdAtIso,
        href: '/',
      // Answered and talked in on the card itself, so no button opens anything else.
      actions: [],
      }),
      done: choice !== undefined,
    };
  });
}

function sameLine(match: MatchRow, answers: Map<string, number>): string {
  const picks = match.sameQuestionIds
    .map((id) => {
      const question = seQuestionById(id);
      const choice = answers.get(id);
      return question && choice !== undefined ? question.choices[choice] : null;
    })
    .filter((pick): pick is string => pick !== null);
  return picks.length > 0 ? `You both picked: ${picks.join('; ')}.` : '';
}

function matchLabel(unread: number): string {
  if (unread === 0) return 'Match · 21 Questions';
  return `Match · ${unread} new message${unread === 1 ? '' : 's'}`;
}

function matchCard(
  match: MatchRow,
  handle: string | null | undefined,
  talk: ConversationSummary | undefined,
  answers: Map<string, number>,
  createdAtIso: string,
): SeTodayCard {
  const who = author(match.userId, handle);
  return card({
    source: 'questions-match',
    sourceId: match.userId,
    kind: 'match',
    label: matchLabel(talk?.unread ?? 0),
    title: seMatchLine({ ...match, handle: who?.handle ?? 'a member' }),
    body: talk?.lastBody ? clip(talk.lastBody) : sameLine(match, answers),
    author: who,
    createdAtIso: talk?.lastAtIso ?? createdAtIso,
    href: '/',
    actions: [],
  });
}

export async function questionCards(viewer: TodayViewer, now = new Date()): Promise<SeTodayCard[]> {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed) return [];
  const createdAtIso = startOfTodayIso(now);
  const answers = await listAnswers(viewer.userId);
  const { enabled } = await readMatchingState(viewer.userId);
  const matches = enabled ? await listMatches(viewer.userId) : [];
  const ids = matches.map((match) => match.userId);
  const [names, talks] = await Promise.all([resolveUsernames(ids), summarizeConversations(viewer.userId, ids)]);
  const matchCards = matches.map((match) => matchCard(match, names.get(match.userId), talks.get(match.userId), answers, createdAtIso));
  return [...dayQuestionCards(createdAtIso.slice(0, 10), answers, enabled, createdAtIso), ...matchCards];
}
