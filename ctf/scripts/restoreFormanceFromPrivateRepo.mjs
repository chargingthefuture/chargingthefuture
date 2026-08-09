#!/usr/bin/env node

// On-demand restore of a Formance pg_dump backup (produced by
// backupFormanceToPrivateRepo.mjs) into a TARGET database — for disaster
// recovery or spinning up a fresh Formance environment.
//
// The backup lives as a GitHub Release asset on the PRIVATE BACKUP_REPO. This
// script downloads the chosen asset via the GitHub REST API (global fetch,
// Node 22 — no npm SDK), writes it to a temp file, and pg_restores it.
//
// Required env:
//   FORMANCE_DATABASE_URL — TARGET DB to restore INTO (a new/recovery DB).
//   GH_PAT                — a token with read access to BACKUP_REPO.
//   BACKUP_REPO           — the PRIVATE backup repo as `owner/name`.
//
// Optional env (pick which backup; default = latest release):
//   FORMANCE_BACKUP_TAG   — restore the release with this exact tag.
//   FORMANCE_BACKUP_FILE  — restore the asset with this exact name.
//
// Safety: refuses to run without FORMANCE_RESTORE_CONFIRM=1, because
// `pg_restore --clean` OVERWRITES the target database. The token is never
// printed.

import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
import os from 'node:os';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function sanitizeFilename(filename) {
  const safe = basename(filename);
  if (!safe || safe.includes('..') || safe.startsWith('/')) {
    throw new Error(`Invalid filename: ${filename}`);
  }
  return safe;
}

function ghHeaders(token, accept) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function readBody(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function main() {
  // Target database to restore INTO (the new/recovery environment, NOT
  // necessarily the same DB that was backed up).
  const FORMANCE_DATABASE_URL = requireEnv('FORMANCE_DATABASE_URL');
  const GH_PAT = requireEnv('GH_PAT');
  const BACKUP_REPO = requireEnv('BACKUP_REPO');

  if (process.env.FORMANCE_RESTORE_CONFIRM !== '1') {
    throw new Error(
      'Refusing to restore: set FORMANCE_RESTORE_CONFIRM=1 to confirm. ' +
        'This OVERWRITES the database referenced by FORMANCE_DATABASE_URL.',
    );
  }

  const jsonHeaders = ghHeaders(GH_PAT, 'application/vnd.github+json');
  const tag = process.env.FORMANCE_BACKUP_TAG?.trim();
  const wantedFile = process.env.FORMANCE_BACKUP_FILE?.trim();

  // Pick the release: an explicit tag, else the latest release.
  let release;
  if (tag) {
    const res = await fetch(
      `https://api.github.com/repos/${BACKUP_REPO}/releases/tags/${encodeURIComponent(tag)}`,
      { headers: jsonHeaders },
    );
    if (!res.ok) {
      throw new Error(`Fetch release by tag failed: ${res.status} ${await readBody(res)}`);
    }
    release = await res.json();
  } else {
    const res = await fetch(
      `https://api.github.com/repos/${BACKUP_REPO}/releases/latest`,
      { headers: jsonHeaders },
    );
    if (!res.ok) {
      throw new Error(`Fetch latest release failed: ${res.status} ${await readBody(res)}`);
    }
    release = await res.json();
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  if (assets.length === 0) {
    throw new Error(`No assets on release ${release.tag_name ?? '(latest)'} in ${BACKUP_REPO}.`);
  }

  // Pick the asset: an explicit FORMANCE_BACKUP_FILE, else the single/first
  // `.dump` asset on the release.
  let asset;
  if (wantedFile) {
    asset = assets.find((a) => a.name === wantedFile);
    if (!asset) {
      throw new Error(`Asset not found on release ${release.tag_name}: ${wantedFile}`);
    }
  } else {
    asset = assets.find((a) => a.name.endsWith('.dump')) ?? assets[0];
  }

  const safeName = sanitizeFilename(asset.name);
  const safePath = join(os.tmpdir(), safeName);

  console.log(`Restoring Formance backup: ${safeName} (release ${release.tag_name}).`);

  // Download the asset bytes. The asset API returns the raw bytes when the
  // Accept header is application/octet-stream.
  const dlRes = await fetch(
    `https://api.github.com/repos/${BACKUP_REPO}/releases/assets/${asset.id}`,
    { headers: ghHeaders(GH_PAT, 'application/octet-stream') },
  );
  if (!dlRes.ok) {
    throw new Error(`Download asset failed: ${dlRes.status} ${await readBody(dlRes)}`);
  }
  const buffer = Buffer.from(await dlRes.arrayBuffer());
  writeFileSync(safePath, buffer);

  try {
    // --clean --if-exists makes the restore idempotent on both a fresh DB (drops
    // are no-ops) and a populated one (objects are replaced). Pass the connection
    // string as an array element (no shell) to avoid any injection surface.
    execFileSync('pg_restore', [
      '--no-owner',
      '--no-privileges',
      '--clean',
      '--if-exists',
      '--dbname', FORMANCE_DATABASE_URL,
      safePath,
    ], {
      stdio: 'inherit',
      env: process.env,
    });

    console.log(`Restore successful: ${safeName} -> target Formance database.`);
  } catch (err) {
    console.error('Restore failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    try { unlinkSync(safePath); } catch { /* no-trace: the temporary file is already gone */ }
  }
}

main().catch((err) => {
  console.error('Restore failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
