#!/usr/bin/env node
// Stop hook: enforce the plain-voice rule (see AGENTS.md "Voice — no pleasantries, no feelings").
// If the assistant's last reply contains a pleasantry, sign-off, or first-person feeling word, block
// the stop and ask for a plain restatement. Defensive by design: any error -> allow (never break a
// session or hard-fail). Loop-safe: if we are already in a stop-hook continuation, do not re-block.
//
// This file is the canonical dictionary. AGENTS.md documents the same lists for humans; if the two
// ever differ, this file wins. Copy this hook into a new repo's .claude/hooks/ and register it as a
// Stop hook (see agents/README.md and agents/settings.example.json).
import { readFileSync } from 'node:fs';

// Tight list — clear pleasantries / sign-offs / feeling words. "appreciate" is matched only in the
// "I/we appreciate" form so it does not trip on text like "the rate appreciates".
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

// Excluded vocabulary — jargon / misused words agents must not use. Each entry pairs the banned
// term with its plain replacement so the block message can name what to use instead. Edit this list
// to fit the new repo; keep AGENTS.md's copy in step with it.
const VOCABULARY = [
  { re: /\bflywheel\b/i, use: 'a plain description of the loop (e.g. "each answer improves the next")' },
  { re: /\bpunch list\b/i, use: 'list' },
  { re: /\bstale\b/i, use: 'drop it — it usually adds no value; if you mean something specific, name it (out-of-date, superseded, no longer current)' },
  // "console" reads as developer jargon for a screen; say "dashboard". The negative lookahead skips
  // the code identifiers console.log / console.error / console.info so quoting real code never trips.
  { re: /\bconsole\b(?!\.\w)/i, use: 'dashboard' },
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
          'Restate the result in plain, factual language — no thanks, apologies, well-wishes, ' +
          'sign-offs, jargon, or first-person feeling words — then stop.',
      }),
    );
  } else if (vocab) {
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason:
          `The reply uses a banned word ("${vocab.term}"). Use instead: ${vocab.use}. ` +
          'Restate in plain language, then stop.',
      }),
    );
  }
} catch {
  // Never block on error.
}
process.exit(0);
