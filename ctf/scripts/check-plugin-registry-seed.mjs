#!/usr/bin/env node
/**
 * Every plugin in the code registry must also have a row in the schema's seed for
 * `ctf_plugin_registry`.
 *
 * The apps list reads that table. `fallbackPluginRegistry` in
 * packages/web/lib/plugins/repository.ts is only used when the table is empty or unreadable, which
 * never happens in production — so a plugin added to the array alone gets no tile and no member can
 * reach it. Fireside shipped that way on 2026-09-13: the entry was in the array, the row was not in
 * the seed, and the plugin was invisible in the launcher while every one of its routes worked.
 *
 * A comment in schema.sql already said this and was not enough, because nothing read it. This does.
 *
 * Run: node ctf/scripts/check-plugin-registry-seed.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ctfRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = join(ctfRoot, 'packages/web/lib/plugins/repository.ts');
const schemaPath = join(ctfRoot, 'schema.sql');

/** Slugs in the code registry, paired with whether that entry claims to be visible. */
function readCodeRegistry(source) {
  const found = new Map();
  const entry = /slug:\s*'([a-z0-9-]+)'[\s\S]{0,600}?isVisible:\s*(true|false)/g;
  let match;
  while ((match = entry.exec(source)) !== null) {
    found.set(match[1], match[2] === 'true');
  }
  return found;
}

/** Slugs seeded into ctf_plugin_registry, from the INSERT block in schema.sql. */
function readSeededSlugs(source) {
  const start = source.indexOf('INSERT INTO ctf_plugin_registry');
  if (start === -1) return null;
  const end = source.indexOf('ON CONFLICT (plugin_slug)', start);
  if (end === -1) return null;
  const block = source.slice(start, end);
  return new Set([...block.matchAll(/\(\s*'([a-z0-9-]+)'\s*,/g)].map((m) => m[1]));
}

const registrySource = readFileSync(registryPath, 'utf8');
const schemaSource = readFileSync(schemaPath, 'utf8');

const codeRegistry = readCodeRegistry(registrySource);
const seeded = readSeededSlugs(schemaSource);

if (!seeded) {
  console.error('check-plugin-registry-seed: could not find the ctf_plugin_registry seed block in schema.sql.');
  console.error('  The INSERT and its ON CONFLICT clause are what this check reads. If the seed moved,');
  console.error('  point this script at its new home rather than deleting the check.');
  process.exit(1);
}

// Rows deliberately removed from the table by a later DELETE (a decommissioned plugin) are not
// expected back in the seed, so only slugs the code still carries are checked.
const missing = [...codeRegistry.keys()].filter((slug) => !seeded.has(slug));

if (missing.length > 0) {
  console.error(`check-plugin-registry-seed: ${missing.length} plugin(s) in the code registry have no seed row.`);
  for (const slug of missing) {
    console.error(`  ✗ ${slug} — in fallbackPluginRegistry, missing from the ctf_plugin_registry seed in schema.sql`);
  }
  console.error('');
  console.error('The apps list reads the table, not the array. Without a row these plugins have no tile,');
  console.error('so members cannot open them even though their routes work. Add each one to the seed in');
  console.error('schema.sql AND to a migration under ctf/db/migrations/post/, since an existing database');
  console.error('is not re-seeded by schema.sql alone.');
  process.exit(1);
}

console.info(
  `check-plugin-registry-seed: ${codeRegistry.size} plugin(s) in the code registry, all seeded into ctf_plugin_registry.`,
);
console.info('✅ No plugin can reach production without a tile.');
