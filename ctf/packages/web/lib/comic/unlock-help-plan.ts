import { getUnlockAccessTier } from 'lib/unlock/access';
import {
  buildUnlockHelpAnswer,
  classifyUnlockHelpQuestion,
  UNLOCK_HELP_INTENT_PREFIX,
  type UnlockHelpCase,
} from './unlock-help-script';

// What routeComicMessage does with an Unlock question: the intent to tag the member's turn with, and
// the scripted answer to attach as the draft (null when the model should draft it instead).
export type UnlockHelpPlan = {
  helpCase: UnlockHelpCase;
  intent: string;
  scriptedAnswer: string | null;
};

// Null for anything that is not an Unlock question from a member still waiting on Unlock: an
// ordinary question, a safety-flagged one (those stay human-first with no draft of any kind), or one
// from an approved member, who has nothing left to unlock. The tier read is best-effort; if it fails
// the question is treated as ordinary rather than blocking the message.
export async function planUnlockHelp(
  actorId: string,
  questionBody: string,
  safetyFlagged: boolean,
): Promise<UnlockHelpPlan | null> {
  if (safetyFlagged) return null;
  const helpCase = classifyUnlockHelpQuestion(questionBody);
  if (!helpCase) return null;
  const tier = await getUnlockAccessTier(actorId).catch(() => 'approved_full' as const);
  if (tier === 'approved_full') return null;
  return {
    helpCase,
    intent: `${UNLOCK_HELP_INTENT_PREFIX}${helpCase}`,
    scriptedAnswer: helpCase === 'model' ? null : buildUnlockHelpAnswer(helpCase),
  };
}
