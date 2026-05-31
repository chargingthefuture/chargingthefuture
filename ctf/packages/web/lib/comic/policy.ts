import type { AllowDecision } from 'lib/auth/server-authz';
import { pluginAuthDeny, type PluginDenyResponse } from 'lib/auth/deny-taxonomy';
import { COMIC_MENTION_REGEX, COMIC_SAFETY_CATEGORIES } from './constants';
import type { ComicSafetyEvaluation } from './types';
import { isRasaConfigured } from './rasa';

export function ensureComicAdmin(decision: AllowDecision): PluginDenyResponse | null {
  if (decision.isAdmin) {
    return null;
  }

  return pluginAuthDeny.forbiddenRole(['admin']);
}

// A message routes to the assistant only when it mentions `@comic`. No mention → peer-to-peer,
// never reaches the bot.
export function mentionsComic(body: string): boolean {
  return COMIC_MENTION_REGEX.test(body);
}

// Strip the `@comic` handle so the underlying question is what gets drafted/captured/trained on.
export function stripComicMention(body: string): string {
  return body.replace(COMIC_MENTION_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

// Input moderation — mirrors feed's `passesFeedModeration`: reject empty, reject angle brackets
// (cheap XSS-injection guard), and cap embedded URLs.
export function passesComicModeration(text: string): boolean {
  if (text.length === 0) {
    return false;
  }

  if (/[<>]/.test(text)) {
    return false;
  }

  const urlCount = (text.match(/https?:\/\//g) ?? []).length;
  return urlCount <= 3;
}

// Keyword-based safety-category detection. Concrete ML/embedding classifier is a later pass;
// this prefilter is the interim safety net that routes risky turns to a human first.
export function evaluateComicSafety(text: string): ComicSafetyEvaluation {
  for (const [category, pattern] of Object.entries(COMIC_SAFETY_CATEGORIES)) {
    if (pattern.test(text)) {
      return { flagged: true, category };
    }
  }

  return { flagged: false, category: null };
}

// Interim operating mode: with Rasa undeployed there is no calibrated NLU confidence, so we
// cannot auto-publish anything. Every non-safety-flagged @comic draft is forced to human review;
// safety-flagged turns are human-first with no draft generated. This returns true while review
// must be forced (i.e. always, until Rasa lands and supplies a real confidence to gate on).
export function forceHumanReview(): boolean {
  return !isRasaConfigured();
}
