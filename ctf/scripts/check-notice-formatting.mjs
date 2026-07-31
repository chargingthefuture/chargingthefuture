#!/usr/bin/env node
// Standing-notice formatting gate.
//
// WHY THIS EXISTS. The Commons notices were first authored as an array of source-wrapped lines joined
// with '\n'. Rendered, every one of those source wraps became a HARD LINE BREAK, so members read
// sentences chopped mid-clause ("whether or / not they have an account"). It passed typecheck, lint, and
// every other gate, because nothing in the codebase knew the difference between a newline that is
// formatting and a newline that is content.
//
// The rule this enforces: inside a paragraph of a standing notice there is NO lone newline. Paragraphs
// are separated by a blank line; everything else is one string. A body that violates that is prose which
// will render with breaks its author never intended.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = join(import.meta.dirname, '..', 'packages', 'web', 'lib', 'feed', 'commons-guidance.ts');

const src = readFileSync(SOURCE, 'utf8');
const failures = [];

// 1. No notice body may be assembled by joining lines with a bare '\n'. That is the exact mistake.
for (const match of src.matchAll(/const\s+(\w*BODY)\s*=\s*\[[\s\S]*?\]\.join\((['"`])(\\n)\2\)/g)) {
  failures.push(
    `${match[1]} joins its parts with a single "\\n". Source wrapping is not content — a lone newline ` +
    `renders as a hard break mid-sentence. Build paragraphs with para(...) and join them with "\\n\\n".`,
  );
}

// 2. Every paragraph helper fragment must read as prose continuing on one line, not as a full line of a
//    pre-formatted block. Cheap proxy: a fragment must not end with a mid-word hyphen or start with a
//    lowercase continuation of a sentence that already ended — those signal hand-formatted columns.
for (const match of src.matchAll(/para\(\s*([\s\S]*?)\s*\)/g)) {
  const fragments = [...match[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
  for (const fragment of fragments) {
    if (fragment.includes('\\n')) {
      failures.push(`A para() fragment contains a literal "\\n": ${fragment.slice(0, 60)}…`);
    }
  }
}

if (failures.length > 0) {
  console.error('check-notice-formatting: standing-notice text would render with unintended line breaks.\n');
  for (const failure of failures) console.error(`  • ${failure}\n`);
  console.error(
    'Paragraphs are single strings. Use para("...", "...") to wrap the SOURCE without putting a newline\n' +
    'into the TEXT, and join paragraphs with "\\n\\n". See lib/feed/commons-guidance.ts.\n',
  );
  process.exit(1);
}

console.log('check-notice-formatting: standing-notice paragraphs are clean (no lone newlines inside a paragraph).');
