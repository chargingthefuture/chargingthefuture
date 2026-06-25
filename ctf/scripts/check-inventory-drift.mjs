#!/usr/bin/env node
/**
 * check-inventory-drift.mjs — guard the feature inventories against drift.
 *
 * The plugin feature inventories (ctf/docs/developer/ctf-plugin-feature-inventories/
 * *-feature-inventory.md) are the source of truth for what the product does. They serve two
 * readers: the next agent (who reads them to catch drift and spot incomplete work) and the
 * owner (whose always-current product description comes from them). An inventory that does not
 * match the code fails both — so this check makes "update the inventory" enforced, not a thing
 * an agent has to remember.
 *
 * What it checks (v1): every schema table and every API route in the code must be documented in
 * at least one inventory file. A table or route that is written down NOWHERE fails the build —
 * that is the most common and most damaging drift (something shipped, documented nowhere).
 *
 * What it does NOT check yet (documented follow-ups, not silent gaps):
 *   - That a table/route is in the RIGHT plugin's inventory. The slug ↔ api-dir ↔ table-prefix
 *     mapping is irregular (e.g. api `gdp` ↔ `ctf-gross-domestic-product-…`, `presence` ↔
 *     `member-presence`, `bug-reports` ↔ `bug-reporting`), so "documented somewhere" is the
 *     robust, low-false-positive v1. Per-plugin attribution needs an explicit manifest.
 *   - Contract YAML ↔ inventory matching.
 *
 * Known pre-existing gaps (documented nowhere as of this gate's introduction) live in
 * inventory-drift-allowlist.json and are skipped. That file is a burn-down list, not a parking
 * lot: it should only ever shrink. NEW tables/routes are never allowed to land undocumented.
 *
 * Exit 1 on any non-allowlisted drift. Run: pnpm --dir ctf run check:inventory-drift
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const SCHEMA_PATH = join(ROOT, 'ctf/schema.sql');
const INVENTORY_DIR = join(ROOT, 'ctf/docs/developer/ctf-plugin-feature-inventories');
const API_DIR = join(ROOT, 'ctf/packages/web/app/api');
const ALLOWLIST_PATH = join(ROOT, 'ctf/scripts/inventory-drift-allowlist.json');

// ── Inventories ──────────────────────────────────────────────────────
// All inventory markdown concatenated. Tables are matched case-insensitively against the
// lowercased text; routes are matched with a case-insensitive regex against the raw text.
function loadInventoryText() {
  const files = readdirSync(INVENTORY_DIR).filter((f) => f.endsWith('-feature-inventory.md'));
  if (files.length === 0) {
    console.error('check-inventory-drift: no *-feature-inventory.md files found — refusing to pass vacuously.');
    process.exit(1);
  }
  const raw = files.map((f) => readFileSync(join(INVENTORY_DIR, f), 'utf8')).join('\n');
  return { raw, lower: raw.toLowerCase(), fileCount: files.length };
}

// ── Schema tables ────────────────────────────────────────────────────
function parseTableNames(sql) {
  const names = new Set();
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    names.add(m[1].toLowerCase());
  }
  return [...names].sort();
}

// ── API routes ───────────────────────────────────────────────────────
function walkRouteFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkRouteFiles(full, acc);
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      acc.push(full);
    }
  }
  return acc;
}

// Turn a route file path into its URL path, dropping Next.js route groups "(group)" and
// parallel-route slots "@slot" (neither appears in the URL).
function routePathFromFile(file) {
  const rel = file.slice(API_DIR.length + 1).replace(/\/route\.tsx?$/, '');
  const segments = rel
    .split('/')
    .filter((s) => s.length > 0 && !(s.startsWith('(') && s.endsWith(')')) && !s.startsWith('@'));
  return '/api/' + segments.join('/');
}

// A route is "documented" if its path appears in the inventory prose. Dynamic segments are
// written several ways ([id], :id, {id}), so each dynamic segment matches any of them. A
// trailing boundary stops /api/x/profile from matching the documented /api/x/profiles.
function routeMatcher(routePath) {
  const parts = routePath
    .split('/')
    .filter(Boolean)
    .map((s) =>
      s.startsWith('[') && s.endsWith(']')
        ? '(?:\\[[^\\]]+\\]|:[A-Za-z0-9_]+|\\{[^}]+\\})'
        : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
  return new RegExp('/' + parts.join('/') + '(?![A-Za-z0-9_/-])', 'i');
}

// ── Allowlist (existing-debt baseline; should only shrink) ────────────
function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { tables: new Set(), routes: new Set() };
  }
  const text = readFileSync(ALLOWLIST_PATH, 'utf8').trim();
  if (text.length === 0) {
    return { tables: new Set(), routes: new Set() };
  }
  const json = JSON.parse(text);
  return {
    tables: new Set((json.tables ?? []).map((s) => String(s).toLowerCase())),
    routes: new Set((json.routes ?? []).map((s) => String(s))),
  };
}

// ── Run ──────────────────────────────────────────────────────────────
const inventory = loadInventoryText();
const allow = loadAllowlist();

const tables = parseTableNames(readFileSync(SCHEMA_PATH, 'utf8'));
const routePaths = existsSync(API_DIR)
  ? [...new Set(walkRouteFiles(API_DIR).map(routePathFromFile))].sort()
  : [];

// Undocumented = present in code but in no inventory. The allowlist (existing-debt baseline) is
// applied on top of this for the gate, but NOT for --emit-allowlist (which regenerates the
// baseline from the current ground truth, for review before committing).
const undocumentedTables = tables.filter((t) => !inventory.lower.includes(t));
const undocumentedRoutes = routePaths.filter((p) => !routeMatcher(p).test(inventory.raw));

if (process.argv.includes('--emit-allowlist')) {
  console.log(
    JSON.stringify(
      {
        _README:
          'Existing-inventory-drift baseline for check-inventory-drift.mjs. Tables/routes here are documented in NO feature inventory as of this gate. This is a BURN-DOWN list: it must only shrink — document the item in the right inventory and delete it from here. Never add a NEW table/route to silence the gate; document it instead. Some routes are non-plugin/infra (health, internal, admin) that belong in ctf-non-plugin-feature-inventory.md.',
        tables: undocumentedTables,
        routes: undocumentedRoutes,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const missingTables = undocumentedTables.filter((t) => !allow.tables.has(t));
const missingRoutes = undocumentedRoutes.filter((p) => !allow.routes.has(p));

console.log('=== Inventory Drift Check ===\n');
console.log(`Inventories scanned:   ${inventory.fileCount}`);
console.log(`Tables in schema.sql:  ${tables.length}`);
console.log(`API routes discovered: ${routePaths.length}`);
console.log(`Allowlisted (skipped): ${allow.tables.size} tables, ${allow.routes.size} routes\n`);

function report(title, items, hint) {
  console.log('──────────────────────────────────────────────');
  console.log(title);
  console.log('──────────────────────────────────────────────\n');
  if (items.length === 0) {
    console.log('  ✅ none\n');
    return;
  }
  for (const item of items) {
    console.log(`  ❌ ${item}`);
  }
  console.log(`\n  ${hint}\n`);
}

report(
  'TABLES in schema.sql documented in NO inventory',
  missingTables,
  'Add each table (by name) to its plugin\'s "Data Model and Storage Contracts" section, or — if it is a known pre-existing gap — add it to ctf/scripts/inventory-drift-allowlist.json.',
);
report(
  'API ROUTES documented in NO inventory',
  missingRoutes,
  'Add each route to its plugin\'s "API Surface and Route Map" section, or — if it is a known pre-existing gap — add it to ctf/scripts/inventory-drift-allowlist.json.',
);

const total = missingTables.length + missingRoutes.length;
console.log('══════════════════════════════════════════════');
if (total === 0) {
  console.log('✅ No inventory drift: every table and route is documented.');
  process.exit(0);
}
console.log(`❌ Inventory drift: ${missingTables.length} undocumented table(s), ${missingRoutes.length} undocumented route(s).`);
console.log('   The feature inventories must match the code (see the policy in');
console.log('   CLAUDE.md → "Plugin Feature Inventory Sync Policy").');
process.exit(1);
