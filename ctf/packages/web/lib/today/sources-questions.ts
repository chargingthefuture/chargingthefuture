import { seMatchLine, seNextQuestion, seQuestionOfDay, seQuestionById, SE_QUESTIONS, seQuestionsOut, type SeTodayCard } from '@ctf/shared';
import { evaluatePluginAccess } from 'lib/auth/server-authz';
import { resolveUsernames } from 'lib/identity/resolve-usernames';
import { listAnswers, listMatches, summarizeConversations, type ConversationSummary, type MatchRow } from 'lib/questions/repository';
import { author, card, clip, startOfTodayIso, type TodayViewer } from './card';

// 21 Questions on Today (3.1.0 plan, task 18), approved members only: the question to answer next
// (today's, then any earlier one missed), and a Match card for each member who answered at least
// three the same, with the conversation inside the card. The card's own controls answer and send;
// the card carries only what the screen needs to find the question or the person.

function questionCard(day: string, answers: Map<string, number>, createdAtIso: string): SeTodayCard[] {
  const next = seNextQuestion(day, new Set(answers.keys()));
  if (!next) return [];
  const out = seQuestionsOut(day);
  const answered = SE_QUESTIONS.slice(0, out).filter((question) => answers.has(question.id)).length;
  return [
    card({
      source: 'questions',
      sourceId: next.id,
      kind: 'match',
      label: next.id === seQuestionOfDay(day).id ? "21 Questions · today's question" : '21 Questions · catching up',
      title: next.text,
      body: `Pick one. Members who pick the same on three or more show up here as matches. ${answered} of ${out} answered so far.`,
      createdAtIso,
      href: '/',
    }),
  ];
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
  });
}

export async function questionCards(viewer: TodayViewer, now = new Date()): Promise<SeTodayCard[]> {
  const access = await evaluatePluginAccess({ requireUsername: false });
  if (!access.allowed) return [];
  const createdAtIso = startOfTodayIso(now);
  const answers = await listAnswers(viewer.userId);
  const matches = await listMatches(viewer.userId);
  const ids = matches.map((match) => match.userId);
  const [names, talks] = await Promise.all([resolveUsernames(ids), summarizeConversations(viewer.userId, ids)]);
  const matchCards = matches.map((match) => matchCard(match, names.get(match.userId), talks.get(match.userId), answers, createdAtIso));
  return [...questionCard(createdAtIso.slice(0, 10), answers, createdAtIso), ...matchCards];
}
