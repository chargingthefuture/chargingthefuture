#!/usr/bin/env node

// Enforces strict plugin isolation in ctf/packages/web (owner decision 2026-08-03): one plugin's
// code must not import another plugin's code. Cross-plugin capability use goes through the narrow
// platform-owned lib/shared/*-interface.ts modules instead, which are the only files outside a
// plugin allowed to import that plugin's lib.
//
// What it does:
// - Derives the plugin directory set from the registry slugs in
//   ctf/packages/web/lib/plugins/repository.ts, plus the documented directory aliases
//   (comic <-> 'knowledge', bug-reports <-> 'bug-reporting').
// - Scans ctf/packages/web/lib/<plugin>/** and ctf/packages/web/components/<plugin>/** for
//   imports that resolve into a DIFFERENT plugin's lib/ or components/ tree — both the
//   'lib/x' / '@/lib/x' path-alias forms and relative '../x' forms.
// - Also scans ctf/packages/web/lib/shared/**: only the top-level *-interface.ts files may
//   import a plugin directory, so a future shared helper cannot quietly re-open the hole.
// - FAILS listing file, line, and target on any hit. There is no allowlist and no burn-down
//   list — the count must be zero.
//
// Plain Node script (no TypeScript import) so it runs on any Node version, including the
// Node 20 CI runners.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const webRoot = path.join(root, 'packages', 'web');
const registryPath = path.join(webRoot, 'lib', 'plugins', 'repository.ts');

// Registry slugs whose lib/components directory uses a different name.
const SLUG_TO_DIR_ALIASES = {
  knowledge: 'comic',
  'bug-reporting': 'bug-reports',
};

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

let failed = false;
function fail(message) {
  console.error(`Plugin boundary check failed: ${message}`);
  failed = true;
  process.exitCode = 1;
}

function readPluginDirs() {
  const src = fs.readFileSync(registryPath, 'utf8');
  const dirs = new Set();
  const slugRe = /\bslug:\s*'([a-z0-9-]+)'/g;
  let m;
  while ((m = slugRe.exec(src)) !== null) {
    const slug = m[1];
    dirs.add(SLUG_TO_DIR_ALIASES[slug] ?? slug);
  }
  if (dirs.size === 0) {
    throw new Error(`no plugin slugs parsed from ${path.relative(root, registryPath)} — parser or registry is broken.`);
  }
  return dirs;
}

function listSourceFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

// Given an import specifier and the importing file, return the plugin directory the specifier
// resolves into ({ area: 'lib' | 'components', plugin }) or null when it targets no plugin dir.
function resolveImportTarget(specifier, filePath, pluginDirs) {
  // Path-alias forms: 'lib/x/...', '@/lib/x/...', 'components/x/...', '@/components/x/...'.
  const aliasMatch = specifier.match(/^(?:@\/)?(lib|components)\/([^/]+)(?:\/|$)/);
  if (aliasMatch) {
    const [, area, segment] = aliasMatch;
    return pluginDirs.has(segment) ? { area, plugin: segment } : null;
  }

  // Relative forms: resolve against the importing file, then test against the web root.
  if (specifier.startsWith('.')) {
    const resolved = path.resolve(path.dirname(filePath), specifier);
    const relative = path.relative(webRoot, resolved);
    if (relative.startsWith('..')) return null;
    const parts = relative.split(path.sep);
    if (parts.length < 2) return null;
    const [area, segment] = parts;
    if (area !== 'lib' && area !== 'components') return null;
    return pluginDirs.has(segment) ? { area, plugin: segment } : null;
  }

  return null;
}

// Collect every static import/export-from/dynamic-import/require specifier with its line number.
function collectImportSpecifiers(source) {
  const out = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g, // import ... from / export ... from
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import()
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // CommonJS require
    /\bimport\s+['"]([^'"]+)['"]/g, // bare side-effect import
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(source)) !== null) {
      const line = source.slice(0, m.index).split('\n').length;
      out.push({ specifier: m[1], line });
    }
  }
  return out;
}

function checkPluginFiles(pluginDirs) {
  let violations = 0;
  for (const plugin of pluginDirs) {
    for (const area of ['lib', 'components']) {
      const dir = path.join(webRoot, area, plugin);
      for (const filePath of listSourceFiles(dir)) {
        const source = fs.readFileSync(filePath, 'utf8');
        for (const { specifier, line } of collectImportSpecifiers(source)) {
          const target = resolveImportTarget(specifier, filePath, pluginDirs);
          if (!target || target.plugin === plugin) continue;
          fail(
            `${path.relative(root, filePath)}:${line} imports '${specifier}' — plugin "${plugin}" must not ` +
              `import plugin "${target.plugin}". Use the matching lib/shared/*-interface.ts module instead.`,
          );
          violations += 1;
        }
      }
    }
  }
  return violations;
}

function checkSharedFiles(pluginDirs) {
  let violations = 0;
  const sharedDir = path.join(webRoot, 'lib', 'shared');
  for (const filePath of listSourceFiles(sharedDir)) {
    const isInterfaceFile =
      path.dirname(filePath) === sharedDir && /-interface\.ts$/.test(path.basename(filePath));
    if (isInterfaceFile) continue;
    const source = fs.readFileSync(filePath, 'utf8');
    for (const { specifier, line } of collectImportSpecifiers(source)) {
      const target = resolveImportTarget(specifier, filePath, pluginDirs);
      if (!target) continue;
      fail(
        `${path.relative(root, filePath)}:${line} imports '${specifier}' — only the top-level ` +
          `lib/shared/*-interface.ts files may import a plugin directory (here: "${target.plugin}").`,
      );
      violations += 1;
    }
  }
  return violations;
}

function main() {
  if (!fs.existsSync(registryPath)) {
    fail(`plugin registry not found at ${registryPath}`);
    return;
  }

  let pluginDirs;
  try {
    pluginDirs = readPluginDirs();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }

  const violations = checkPluginFiles(pluginDirs) + checkSharedFiles(pluginDirs);
  if (failed) {
    console.error(`Found ${violations} cross-plugin import(s); see failures above.`);
    return;
  }
  console.log(
    `Plugin boundary check passed: ${pluginDirs.size} plugin directories scanned, no cross-plugin imports.`,
  );
}

main();
