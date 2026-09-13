#!/usr/bin/env node
// Stop hook: enforce the plain-voice rule (see CLAUDE.md "Voice — no pleasantries, no feelings").
// If the assistant's last reply contains a pleasantry, sign-off, or first-person feeling word, block
// the stop and ask for a plain restatement. Defensive by design: any error -> allow (never break a
// session or hard-fail). Loop-safe: if we are already in a stop-hook continuation, do not re-block.
import { readFileSync } from 'node:fs';

// Tight list — clear pleasantries / sign-offs / feeling words. "appreciate" is matched only in the
// "I/we appreciate" form so it does not trip on finance text like "the rate appreciates".
const BANNED = [
  /\bthanks\b/i,
  /\bthank you\b/i,
  /\byou(?:'|’| a)?re welcome\b/i,
  /\bno problem\b/i,
  /\bmy pleasure\b/i,
  /\bglad\b/i,
  /\bhappy to\b/i,
  /\bexcited\b/i,
  /\bdelighted\b/i,
  /\bsorry\b/i,
  /\bapolog(?:y|ies|ize|ise|izing|ising)\b/i,
  /\bcheers\b/i,
  /\bcongrat(?:s|ulations)\b/i,
  /\b(?:i|we) (?:really |truly )?appreciate\b/i,
  /\bhope (?:this|that|you|it)\b/i,
  /\bfeel free\b/i,
  /\b(?:warm|best|kind)(?:est)? regards\b/i,
  /\blooking forward\b/i,
];

// Owner-maintained excluded vocabulary — the single canonical list of jargon / misused words
// agents must not use in this repo. .claude/rules/098-agent-communication-rules.mdc points
// here instead of keeping a second copy that drifts. Each entry pairs the banned term with its
// plain replacement so the block message can name what to use instead.
const VOCABULARY = [
  { re: /\bflywheel\b/i, use: 'a plain description of the loop (e.g. "each answer improves the next")' },
  { re: /\bpunch list\b/i, use: 'list' },
  { re: /\bstale\b/i, use: 'drop it — it usually adds no value; if you mean something specific, name it (out-of-date, superseded, no longer current)' },
  // "console" reads as developer jargon for a screen; say "dashboard". The negative lookahead skips
  // the code identifiers console.log / console.error / console.info so quoting real code never trips.
  { re: /\bconsole\b(?!\.\w)/i, use: 'dashboard' },
  // Owner directive, 2026-08-28, widened 2026-09-13. One tic: the sentence that arrives after the
  // facts to announce which of them was the important one. Enumerating the wordings did not hold —
  // "whole point" was banned, then "whole argument", then "point of the thing", and the next reply
  // reached for "whole offer" and passed straight through. So the construction is matched rather
  // than the nouns: anything of the form "that is the whole <word>" trips, whatever word follows.
  //
  // A negated form is left alone on purpose. "That is not the whole story" says the account is
  // incomplete, which is a fact about the account; the intervening "not" keeps it from matching.
  { re: /\b(?:that|this|which|it)(?:'s|\u2019s| is| was) the whole \w+/i, use: 'state the point itself and stop — no sentence whose only job is to label what came before it' },
  // The same habit without the demonstrative in front: "precision is the whole point of this post".
  { re: /\bwhole (?:point|argument|ask|offer|deal|case|idea|reason)\b/i, use: 'say the thing plainly, without announcing that it is the important one' },
  // Owner directive, 2026-08-29. Same habit, a different set of words: the closing sentence that
  // announces which fact was the important one.
  { re: /\bpoint of the thing\b/i, use: 'end on the fact itself, with no sentence explaining that it mattered' },
];

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function lastAssistantText(transcriptPath) {
  const raw = readFileSync(transcriptPath, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (entry.type !== 'assistant') continue;
    const content = entry.message && entry.message.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n');
    }
    return '';
  }
  return '';
}

try {
  const input = JSON.parse(readStdin() || '{}');
  if (input.stop_hook_active) process.exit(0); // already retrying; do not loop
  const text = input.transcript_path ? lastAssistantText(input.transcript_path) : '';
  const pleasantry = BANNED.map((re) => text.match(re)).find(Boolean);
  const vocab = VOCABULARY.map((entry) => {
    const m = text.match(entry.re);
    return m ? { term: m[0], use: entry.use } : null;
  }).find(Boolean);

  if (pleasantry) {
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason:
          `The reply contains a banned pleasantry/feeling/sign-off ("${pleasantry[0]}"). ` +
          'Restate once, briefly, in plain factual language — no thanks, apologies, well-wishes, ' +
          'sign-offs, jargon, or first-person feeling words. Do not re-send the full reply with ' +
          'one word swapped; summarize the point in a sentence or two, then stop.',
      }),
    );
  } else if (vocab) {
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason:
          `The reply uses a banned word ("${vocab.term}"). Use instead: ${vocab.use}. ` +
          'Restate once, briefly — do not re-send the full reply with one word swapped; ' +
          'summarize the point in a sentence or two, then stop.',
      }),
    );
  }
} catch {
  // Never block on error.
}
process.exit(0);
