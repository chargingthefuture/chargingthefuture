// Resolve what a code-review slice imports from OUTSIDE itself, and pull just enough of that
// code in as read-only reference.
//
// Why this exists: the sweep defines a slice as the folders sharing a name across the source
// layers (app/api/<name>, components/<name>, lib/<name>, mobile features). That is wrong for any
// surface built on another plugin's server code. The clearest case is the Commons: its slice is
// `app/api/commons` + `lib/commons`, but `lib/commons` holds only constants, types, and the
// live-stream helper — every function its routes call lives in `lib/feed/`, a different slice. The
// reviewer therefore read route handlers calling functions it could not open, guessed what they
// did, and filed confident, wrong findings (issues #2205, #2206, #2208 were all this).
//
// Whole dependency files do not fit: lib/feed/repository.ts alone is ~110 KB against a 200 KB
// per-run source budget. So a large dependency contributes only the declarations the slice
// actually imports, plus the file-local helpers those declarations call — which is exactly the
// evidence the reviewer was missing (e.g. `updateCommonsLastSeen` and the `isValidIsoDatetime`
// check inside it). Small files are included whole, since the surrounding code is cheap context.

import { readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

// How many file-local helpers one round of the "what does this declaration call?" pass may add per
// dependency file. Bounded so a densely-cross-referenced module cannot pull in most of itself.
const MAX_LOCAL_HELPERS = 12;

// Identifiers that appear in extracted code but are never a file-local helper worth chasing.
const IDENTIFIER_STOPWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'throw',
  'try', 'catch', 'finally', 'new', 'typeof', 'instanceof', 'in', 'of', 'delete', 'void', 'await',
  'async', 'function', 'const', 'let', 'var', 'class', 'extends', 'implements', 'interface', 'type',
  'enum', 'export', 'import', 'from', 'as', 'default', 'null', 'undefined', 'true', 'false', 'this',
  'super', 'yield', 'string', 'number', 'boolean', 'object', 'symbol', 'bigint', 'unknown', 'never',
  'any', 'Promise', 'Array', 'Map', 'Set', 'Date', 'Math', 'JSON', 'Object', 'String', 'Number',
  'Boolean', 'Error', 'console', 'process', 'require', 'module', 'exports', 'globalThis',
]);

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function sizeOf(path) {
  try {
    return statSync(path).size;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

// Try a resolved path as-is, then with each source extension, then as a directory index.
function probe(basePath) {
  if (isFile(basePath)) {
    return basePath;
  }
  for (const ext of RESOLVE_EXTENSIONS) {
    if (isFile(`${basePath}${ext}`)) {
      return `${basePath}${ext}`;
    }
  }
  for (const ext of RESOLVE_EXTENSIONS) {
    if (isFile(join(basePath, `index${ext}`))) {
      return join(basePath, `index${ext}`);
    }
  }
  return null;
}

// The nearest ancestor directory holding a package.json — the root a bare, non-npm specifier like
// `lib/feed/repository` is written against (both web and mobile set baseUrl to their package root).
function packageRootOf(fileAbs, repoRoot) {
  let dir = dirname(fileAbs);
  const stop = resolve(repoRoot);
  while (dir.startsWith(stop) && dir !== stop) {
    if (isFile(join(dir, 'package.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

// Resolve one import specifier to an absolute file path, or null when it is an npm/node module or
// cannot be found. Handles relative imports, package-root-absolute imports (`lib/...`, `@/...`),
// and workspace imports (`@ctf/<pkg>/...`).
export function resolveSpecifier(specifier, fromFileAbs, repoRoot) {
  if (!specifier || specifier.startsWith('node:')) {
    return null;
  }
  if (specifier.startsWith('.')) {
    return probe(resolve(dirname(fromFileAbs), specifier));
  }
  if (specifier.startsWith('@ctf/')) {
    const [, pkg, ...rest] = specifier.split('/');
    const pkgRoot = join(repoRoot, 'ctf/packages', pkg);
    const tail = rest.join('/');
    return probe(join(pkgRoot, 'src', tail)) || probe(join(pkgRoot, tail));
  }
  const pkgRoot = packageRootOf(fromFileAbs, repoRoot);
  if (!pkgRoot) {
    return null;
  }
  if (specifier.startsWith('@/')) {
    return probe(join(pkgRoot, specifier.slice(2)));
  }
  // A bare specifier is only package-root-absolute when it actually resolves there; anything else
  // (next/server, react, @clerk/nextjs) falls through to null and is skipped.
  return probe(join(pkgRoot, specifier));
}

// Every `import ... from '<specifier>'` / `export ... from '<specifier>'` in one file, with the
// names each pulls in. A namespace or default import records no names, which makes the whole file
// the unit of interest for that dependency.
export function parseImports(text) {
  const results = [];
  const statementRe = /(?:^|\n)\s*(?:import|export)\s+([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = statementRe.exec(text)) !== null) {
    const clause = match[1];
    const specifier = match[2];
    const names = [];
    let wantsWholeModule = false;
    const braced = clause.match(/\{([\s\S]*)\}/);
    if (braced) {
      for (const part of braced[1].split(',')) {
        const name = part.replace(/\btype\b/g, '').trim().split(/\s+as\s+/)[0].trim();
        if (name) {
          names.push(name);
        }
      }
    }
    const outsideBraces = clause.replace(/\{[\s\S]*\}/, '').replace(/\btype\b/g, '').trim();
    if (/\*\s+as\s+/.test(outsideBraces) || /^[A-Za-z_$][\w$]*$/.test(outsideBraces.replace(/,$/, '').trim())) {
      wantsWholeModule = true;
    }
    results.push({ specifier, names, wantsWholeModule });
  }
  return results;
}

// Walk forward from `startIdx` to the end of one top-level declaration, tracking bracket depth and
// skipping strings, template literals, and comments. A declaration with a body ends at the `}` that
// returns depth to 0; one without (`export const X = 1;`) ends at its `;`.
function declarationEnd(text, startIdx) {
  let depth = 0;
  let entered = false;
  let i = startIdx;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '/' && next === '/') {
      const nl = text.indexOf('\n', i);
      i = nl === -1 ? text.length : nl;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2);
      i = close === -1 ? text.length : close + 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (text[i] === quote) {
          break;
        }
        i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === '{' || ch === '(' || ch === '[') {
      depth += 1;
      entered = true;
    } else if (ch === '}' || ch === ')' || ch === ']') {
      depth -= 1;
      if (depth <= 0 && entered && ch === '}') {
        return i + 1;
      }
    } else if (ch === ';' && depth <= 0) {
      return i + 1;
    }
    i += 1;
  }
  return text.length;
}

// Walk backward over the comment block directly above a declaration. The "why" comments in this
// repo carry the deliberate-design reasoning a reviewer needs (e.g. "clamped to server NOW()"),
// so they travel with the code.
function commentStart(text, declIdx) {
  const lines = text.slice(0, declIdx).split('\n');
  let i = lines.length - 1;
  if (i >= 0 && lines[i].trim() === '') {
    i -= 1;
  }
  let firstCommentLine = -1;
  while (i >= 0) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      firstCommentLine = i;
      i -= 1;
      continue;
    }
    break;
  }
  if (firstCommentLine === -1) {
    return declIdx;
  }
  return lines.slice(0, firstCommentLine).join('\n').length + (firstCommentLine > 0 ? 1 : 0);
}

// Locate one top-level declaration of `name`, exported or not. Returns [start, end) or null.
function findDeclaration(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`^export\\s+(?:async\\s+)?(?:function|const|let|var|class|type|interface|enum)\\s+${escaped}\\b`, 'm'),
    new RegExp(`^(?:async\\s+)?(?:function|const|let|var|class|type|interface|enum)\\s+${escaped}\\b`, 'm'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      return [commentStart(text, match.index), declarationEnd(text, match.index)];
    }
  }
  return null;
}

// Identifiers referenced by already-extracted code that have a top-level declaration in the same
// file. Without this hop the reviewer sees a call to a validation helper but not the helper.
function localHelpersIn(extractedText, fileText, alreadyTaken) {
  const helpers = [];
  const seen = new Set(alreadyTaken);
  const identifierRe = /\b([A-Za-z_$][\w$]*)\b/g;
  let match;
  while ((match = identifierRe.exec(extractedText)) !== null && helpers.length < MAX_LOCAL_HELPERS) {
    const name = match[1];
    if (seen.has(name) || IDENTIFIER_STOPWORDS.has(name)) {
      continue;
    }
    seen.add(name);
    if (findDeclaration(fileText, name)) {
      helpers.push(name);
    }
  }
  return helpers;
}

// The declarations named by `names`, plus the file-local helpers they call, in source order.
export function extractSymbols(fileText, names) {
  const spans = [];
  const taken = new Set();
  for (const name of names) {
    const span = findDeclaration(fileText, name);
    if (span) {
      spans.push(span);
      taken.add(name);
    }
  }
  if (spans.length === 0) {
    return { text: '', names: [] };
  }
  const firstPass = spans.map(([s, e]) => fileText.slice(s, e)).join('\n');
  for (const helper of localHelpersIn(firstPass, fileText, taken)) {
    const span = findDeclaration(fileText, helper);
    if (span) {
      spans.push(span);
      taken.add(helper);
    }
  }
  // Source order, with overlapping spans merged so a helper declared inside a captured range is
  // not emitted twice.
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) {
      last[1] = Math.max(last[1], span[1]);
      continue;
    }
    merged.push([...span]);
  }
  const text = merged.map(([s, e]) => fileText.slice(s, e).trim()).join('\n\n');
  return { text, names: [...taken] };
}

// Build the read-only dependency reference block for one slice.
//
// `fileList` is the slice's own files ([{abs, rel}]). Returns the reference text, the dependency
// files it covers, and how many were dropped for budget, so the caller can log an honest count
// rather than implying full coverage.
export function collectDependencyContext(fileList, options) {
  // Files at or under `wholeFileMaxBytes` come in whole (surrounding code is cheap context); bigger
  // ones contribute only what the slice imports. Kept low deliberately: a mid-size module asking for
  // its full text buys far less per byte than the same budget spread over several files' relevant
  // declarations, and crowding out a small type definition is what loses an argument outright.
  const { repoRoot, maxBytes, wholeFileMaxBytes = 12_000 } = options;
  const sliceFiles = new Set(fileList.map((f) => f.rel));
  const wanted = new Map();

  for (const { abs } of fileList) {
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue; // no-trace: an unreadable slice file is already the caller's problem, not ours.
    }
    for (const { specifier, names, wantsWholeModule } of parseImports(text)) {
      const resolved = resolveSpecifier(specifier, abs, repoRoot);
      if (!resolved) {
        continue;
      }
      const rel = relative(repoRoot, resolved);
      if (rel.startsWith('..') || sliceFiles.has(rel)) {
        continue; // outside the repo, or part of the slice and already under review
      }
      const entry = wanted.get(rel) || { rel, abs: resolved, names: new Set(), whole: false, importers: 0 };
      for (const name of names) {
        entry.names.add(name);
      }
      if (wantsWholeModule) {
        entry.whole = true;
      }
      entry.importers += 1;
      wanted.set(rel, entry);
    }
  }

  // Most-depended-on first, then smallest first, then path for a stable order. Plain alphabetical
  // ordering let one large module spend the budget and push out small, high-value files — the type
  // definitions that settle a question outright are usually the cheapest bytes in the set.
  const ordered = [...wanted.values()]
    .map((entry) => ({ ...entry, size: sizeOf(entry.abs) }))
    .sort((a, b) => (
      b.importers - a.importers
      || a.size - b.size
      || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0)
    ));
  let text = '';
  const files = [];
  let skipped = 0;

  for (const entry of ordered) {
    let body;
    try {
      body = readFileSync(entry.abs, 'utf8');
    } catch {
      continue; // no-trace: a dependency we cannot read is simply not offered as reference.
    }
    let note = '';
    if (body.length > wholeFileMaxBytes && !entry.whole && entry.names.size > 0) {
      const extracted = extractSymbols(body, [...entry.names]);
      if (extracted.text.length === 0) {
        skipped += 1;
        continue;
      }
      body = extracted.text;
      note = ` (only the declarations this slice imports, plus their local helpers: ${extracted.names.join(', ')})`;
    } else if (body.length > wholeFileMaxBytes) {
      // Wanted whole (namespace/default import) but too big to afford in full.
      body = `${body.slice(0, wholeFileMaxBytes)}\n... (truncated) ...`;
      note = ' (truncated)';
    }
    const header = `\n----- IMPORTED BY THIS SLICE: ${entry.rel}${note} -----\n`;
    if (text.length + header.length + body.length > maxBytes) {
      skipped += 1;
      continue;
    }
    text += header + body;
    files.push(entry.rel);
  }

  return { text, files, skipped };
}
