// The one list of British spellings this repository rejects, and the map that rewrites them.
//
// Two callers share it, and they must share it, because they answer opposite questions about the
// same words:
//
//   check-us-spelling.mjs        — "does this file contain a British spelling?" (fail if yes)
//   changed-files.mjs            — "is this file's whole diff just dialect?" (skip it if yes)
//
// The second question is what lets the behavior-shaped gates — modularity, test-script drift, the
// Stream quota note — ignore a spelling sweep. Those gates exist to catch behavior changes, and
// rewriting "colour" to "color" in a comment is not one. If the two callers ever read different
// lists, a word could be both required-to-fix and not-recognized-as-dialect, and the sweep to fix it
// would trip every gate it touched. One list, imported twice.
//
// Adding a rule: British root on the left, US root on the right. Roots match case-insensitively at
// a word boundary. `requireSuffix` restricts the match so a root that also begins a legitimate word
// (realis- in "realistic", emphasis on its own) is not caught. `wholeWord` requires a boundary at
// the end too.

export const RULES = [
  { british: 'behaviour', us: 'behavior' },
  { british: 'judgement', us: 'judgment' },
  { british: 'colour', us: 'color' },
  { british: 'amongst', us: 'among', wholeWord: true },
  { british: 'grey', us: 'gray' },
  { british: 'realis', us: 'realiz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'recognis', us: 'recogniz', requireSuffix: 'e|ed|es|ing|able' },
  { british: 'enrolment', us: 'enrollment' },
  { british: 'centre', us: 'center' },
  { british: 'normalis', us: 'normaliz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'fulfilment', us: 'fulfillment' },
  { british: 'fulfil', us: 'fulfill', wholeWord: true },
  { british: 'defence', us: 'defense' },
  { british: 'licence', us: 'license' },
  { british: 'whilst', us: 'while', wholeWord: true },
  { british: 'travell', us: 'travel', requireSuffix: 'ed|ing|er|ers' },
  { british: 'summaris', us: 'summariz', requireSuffix: 'e|ed|es|ing' },
  { british: 'serialis', us: 'serializ', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'favour', us: 'favor' },
  { british: 'emphasis', us: 'emphasiz', requireSuffix: 'e|ed|es|ing' },
  { british: 'towards', us: 'toward', wholeWord: true },
  { british: 'analyse', us: 'analyze' },
  { british: 'apologis', us: 'apologiz', requireSuffix: 'e|ed|es|ing' },
  { british: 'organis', us: 'organiz', requireSuffix: 'e|ed|es|ing|ation|ational' },
  { british: 'authoris', us: 'authoriz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'prioritis', us: 'prioritiz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'customis', us: 'customiz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'categoris', us: 'categoriz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'sanitis', us: 'sanitiz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'initialis', us: 'initializ', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'synchronis', us: 'synchroniz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'standardis', us: 'standardiz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'specialis', us: 'specializ', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'minimis', us: 'minimiz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'maximis', us: 'maximiz', requireSuffix: 'e|ed|es|ing|ation' },
  { british: 'utilis', us: 'utiliz', requireSuffix: 'e|ed|es|ing|ation' },
  // Doubled-consonant variants. These were originally excluded because "cancelled" was a persisted
  // status value in several tables; the owner directed the rename anyway (2026-07-31), so the
  // stored rows were migrated in ctf/schema.sql (search "US-spelling data migration") and the words
  // joined the list. The suffix guard keeps "cancellation" — correct US English — unmatched.
  { british: 'cancell', us: 'cancel', requireSuffix: 'ed|ing' },
  // `notPreceded` protects `aria-labelledby`: the doubled L there is the ARIA standard's own
  // attribute name, not prose. Rewriting it produces an attribute browsers do not recognize —
  // screen readers silently lose the label association, which the a11y lint caught when the first
  // pass of this sweep did exactly that.
  { british: 'labell', us: 'label', requireSuffix: 'ed|ing', notPreceded: 'aria-' },
  { british: 'modell', us: 'model', requireSuffix: 'ed|ing' },
];

// The optional `un` group matters: without it "unrecognised" and "unnormalised" slip through,
// because the word boundary a rule anchors on sits before "un", not before the root. Capturing the
// prefix lets one rule cover both forms and put the prefix back on the way out.
function buildPattern(rule) {
  const suffix = rule.requireSuffix ? `(?=${rule.requireSuffix})` : '';
  const boundary = rule.wholeWord ? '\\b' : '';
  const guard = rule.notPreceded ? `(?<!${rule.notPreceded})` : '';
  return new RegExp(`${guard}\\b(un)?${rule.british}${boundary}${suffix}`, 'gi');
}

export const PATTERNS = RULES.map((rule) => ({ rule, pattern: buildPattern(rule) }));

// Rewrites every British spelling in `text` to its US form, preserving the case of the first letter
// so "Colour" becomes "Color" and "colour" becomes "color".
export function toUsEnglish(text) {
  let out = text;
  for (const { rule, pattern } of PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, (found, prefix) => {
      const head = found[0];
      const capitalized = head === head.toUpperCase() && head !== head.toLowerCase();
      if (prefix) return (capitalized ? 'Un' : prefix) + rule.us;
      return capitalized ? rule.us[0].toUpperCase() + rule.us.slice(1) : rule.us;
    });
  }
  return out;
}

// True when two versions of a file differ ONLY in dialect — that is, once both are rewritten to US
// English they are byte-identical. A diff that passes this test cannot have changed behavior,
// because the only thing it changed was how a word is spelled.
export function differsOnlyInDialect(before, after) {
  if (before === after) return false; // no change at all; not this function's business
  return toUsEnglish(before) === toUsEnglish(after);
}
