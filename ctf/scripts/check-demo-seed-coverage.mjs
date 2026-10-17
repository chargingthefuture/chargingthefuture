#!/usr/bin/env node
// Fails when a table in schema.sql gets no row from the demo seed and is not listed, with a reason,
// in demo-seed-coverage-allowlist.json.
//
// The demo schema is what testers and the demo videos see. A table the seed never writes shows as an
// empty screen there, and nothing noticed: on 2026-10-17 writing the demo clips found more than a
// dozen member screens with no demo data (Beacon events, SkillsHunt missions, Fireside comments,
// Mood check-ins, a one-sector taxonomy, and others). This reads the files and needs no database, so
// it runs on every pull request; a new table now fails here until it is seeded or given a reason.
//
// The allowlist has two parts:
//   exempt        table -> why it has no demo rows on purpose (audit trail, system bookkeeping,
//                 admin-only, written at runtime). Every entry carries its reason.
//   notYetSeeded  a burn-down list of tables a member screen reads that the seed does not fill yet.
//                 It only shrinks: seed the table and delete its line. Never add a new table here.
// A table that is seeded and still listed fails too, so a listed line cannot outlive its reason.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = dirname(fileURLToPath(import.meta.url));
const ctf = join(scripts, '..');

const schema = readFileSync(join(ctf, 'schema.sql'), 'utf8');
const tables = new Set([...schema.matchAll(/CREATE TABLE IF NOT EXISTS\s+(?:public\.)?([a-z0-9_]+)/gi)].map((m) => m[1].toLowerCase()));

const seedFiles = [
  join(scripts, 'seedDemo.mjs'),
  ...readdirSync(join(scripts, 'demo-seed'))
    .filter((f) => f.endsWith('.mjs'))
    .map((f) => join(scripts, 'demo-seed', f)),
];
const seeded = new Set();
for (const file of seedFiles) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/INSERT INTO\s+(?:demo\.|public\.)?([a-z0-9_]+)/gi)) seeded.add(m[1].toLowerCase());
}

const allowlistPath = join(scripts, 'demo-seed-coverage-allowlist.json');
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
const exempt = allowlist.exempt ?? {};
const notYetSeeded = new Set(allowlist.notYetSeeded ?? []);

const problems = [];
for (const table of [...tables].sort()) {
  const isSeeded = seeded.has(table);
  const isExempt = Object.hasOwn(exempt, table);
  const isPending = notYetSeeded.has(table);
  if (isExempt && !String(exempt[table]).trim()) problems.push(`${table}: exempt with no reason; say why it has no demo rows`);
  if (isExempt && isPending) problems.push(`${table}: listed both as exempt and as not yet seeded; keep one`);
  if (!isSeeded && !isExempt && !isPending) {
    problems.push(`${table}: no demo seed writes it. Seed it in ctf/scripts/demo-seed/, or add it to "exempt" with the reason it has no demo rows`);
  }
  if (isSeeded && isPending) problems.push(`${table}: the demo seed writes it now; delete it from "notYetSeeded"`);
}
for (const table of [...Object.keys(exempt), ...notYetSeeded]) {
  if (!tables.has(table)) problems.push(`${table}: listed in the allowlist but schema.sql has no such table; delete the line`);
}

if (problems.length) {
  console.error(`check-demo-seed-coverage: ${problems.length} problem(s). File: ctf/scripts/demo-seed-coverage-allowlist.json\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `check-demo-seed-coverage: ${seeded.size} of ${tables.size} tables have demo rows; ${Object.keys(exempt).length} exempt with a reason; ${notYetSeeded.size} still to seed.`,
);
