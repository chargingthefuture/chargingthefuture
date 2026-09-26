import { QUORA_URL_HELP_STEPS, type QuoraUrlHelpCase } from 'lib/shared/unlock-interface';

// The scripted @comic path for the question members get stuck on at Unlock: "where is my Quora
// profile URL?"
//
// A member who cannot find the URL is the member least able to act on a vague answer, and the model
// has never seen Quora's screens. So a question about finding the profile link gets a fixed answer
// built from the same steps the help box shows (lib/unlock/quora-url-help-steps.ts), picked by which
// way they are stuck. Anything else about Unlock (how long review takes, what happens next) still goes
// to the model, with a short list of facts about Unlock added to its instructions so it does not make
// them up.
//
// Either way the answer is sent straight to the member without waiting for review (owner decision,
// 2026-09-26). This is the only @comic path that skips review, and it can be switched off from the
// Unlock help log (lib/comic/runtime-config.ts), which puts these answers back in the queue with the
// draft attached. Safe to send unreviewed because the assistant cannot approve anybody: the worst
// case is a wrong instruction, not a wrong approval.
//
// Only for a member who is not yet approved. The question is tagged on the member's turn
// (comic_turns.intent) as `unlock_help:<case>`, which is what the admin log at /admin/comic/unlock-help
// reads to set each conversation against whether that member was approved afterward.
//
// The assistant explains and collects. It has no tool that approves anybody and this file gives it
// none: approval stays with a person on the Unlock admin screen.

export type UnlockHelpCase = QuoraUrlHelpCase | 'model';

export const UNLOCK_HELP_INTENT_PREFIX = 'unlock_help:';

// The review-row reason recorded on an Unlock answer that went out without review, so the review
// history says why no reviewer is named on it, and the Unlock help log can tell it apart.
export const UNLOCK_HELP_SENT_REASON = 'unlock_help_sent_without_review';

// Is this about Unlock at all? A question that names none of these is an ordinary @comic question.
const UNLOCK_TOPIC = /\b(quora|verif\w*|unlock\w*|approv\w*)\b/i;

// Is it the profile-link question specifically? Quora plus a word for the link, or "profile URL"
// without naming Quora.
const QUORA_LINK_TOPIC = /\b(profile|url|link|address)\b/i;
const PROFILE_LINK_PHRASE = /\bprofile\s+(url|link|address)\b/i;

// Which way they are stuck, checked in this order: an account they cannot reach outranks everything,
// then a link that was refused, then the app. A plain question gets the browser steps.
const CANNOT_SIGN_IN =
  /\b(log\s?in|sign\s?in|password|locked|deleted|banned|suspended|lost access|no (quora )?account|(don'?t|do not|never) (have|had) (a |an )?(quora )?account)\b/i;
const WRONG_LINK =
  /\b(rejected|invalid|not valid|isn'?t valid|not accepted|won'?t accept|doesn'?t work|didn'?t work|not working|error|space|wrong link)\b/i;
const QUORA_APP = /\b(app|iphone|android|ipad|phone|mobile)\b/i;

function pickQuoraUrlCase(text: string): QuoraUrlHelpCase {
  if (CANNOT_SIGN_IN.test(text)) return 'cannot_sign_in';
  if (WRONG_LINK.test(text)) return 'wrong_link';
  if (QUORA_APP.test(text)) return 'quora_app';
  return 'browser';
}

function isQuoraLinkQuestion(text: string): boolean {
  if (PROFILE_LINK_PHRASE.test(text)) return true;
  return /\bquora\b/i.test(text) && QUORA_LINK_TOPIC.test(text);
}

// Null when the question is not about Unlock. 'model' when it is about Unlock but not the profile
// link, so the model answers it with the Unlock facts below.
export function classifyUnlockHelpQuestion(text: string): UnlockHelpCase | null {
  if (isQuoraLinkQuestion(text)) return pickQuoraUrlCase(text);
  if (UNLOCK_TOPIC.test(text)) return 'model';
  return null;
}

const FALLBACK_TAIL =
  'The help box at the top of the Commons has a picture of where to look. If none of this works, write the name on your Quora account in that box instead and a person will look you up.';

// What follows the steps. The browser case is also the answer to the plain "where is it?" question,
// and many members are on the Quora app, so it carries the app's one-line version as well.
const ANSWER_TAIL: Record<QuoraUrlHelpCase, string> = {
  browser: `In the Quora app instead: tap the three dots (⋯) on your profile, then Share, then Copy link.\n\n${FALLBACK_TAIL}`,
  quora_app: FALLBACK_TAIL,
  wrong_link: FALLBACK_TAIL,
  cannot_sign_in: 'The box is under "Can’t find your Quora profile URL?" at the top of the Commons.',
};

// The scripted answer for one case: the matching steps, then the way out that always applies (the
// box above the chat, where a name or an email is enough). Plain text, since the answer card renders
// text.
export function buildUnlockHelpAnswer(helpCase: QuoraUrlHelpCase): string {
  const block = QUORA_URL_HELP_STEPS[helpCase];
  const numbered = block.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  return `${block.heading}:\n${numbered}\n\n${ANSWER_TAIL[helpCase]}`;
}

// Sent instead of a model answer when the model is not reachable and the answer is going out without
// review, so the question never falls back into the review queue.
export const UNLOCK_HELP_MODEL_FALLBACK =
  'A person reviews every Quora profile you send, and nothing expires while you wait. If you cannot find your profile address, the help box at the top of the Commons shows where to look, and you can write the name on your Quora account there instead so a person can look you up.';

// Facts added to the model's instructions for an Unlock question outside the script. Each is true of
// the product today; the model is told not to go beyond them.
export const UNLOCK_HELP_MODEL_FACTS =
  '\n\nThis question is from a member who has not finished Unlock, the step where a new member ' +
  'sends the web address of their Quora profile so a person can confirm they are real. Facts you may ' +
  'rely on: a person reviews every submission; you cannot approve anybody and must never say you ' +
  'have or will; not finishing Unlock never costs a member their account, and nothing expires while ' +
  'they wait; a member who cannot find their profile address can write the name on their Quora ' +
  'account, their email, or a link to anything they posted in the box at the top of the Commons, and ' +
  'a person can approve them by hand from that. Do not state review times, promises, or rules beyond ' +
  'these.';
