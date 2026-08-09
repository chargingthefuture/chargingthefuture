#!/usr/bin/env node

// Nightly Formance Postgres backup → GitHub Release asset on a PRIVATE repo.
//
// pg_dump produces a custom-format dump; this script then creates a GitHub
// Release on BACKUP_REPO and uploads the dump as a release asset, using the
// GitHub REST API via the built-in global fetch (Node 22) — no npm SDK.
//
// Required env:
//   FORMANCE_DATABASE_URL — Formance Postgres connection string (read access).
//   GH_PAT                — a token with `contents: write` on BACKUP_REPO.
//   BACKUP_REPO           — the PRIVATE backup repo as `owner/name`.
//
// Backups must fail loudly: any missing env or any non-2xx API response throws
// and exits non-zero, so the GitHub Actions job goes red rather than silently
// succeeding with no backup. The token (GH_PAT) is never printed.

import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
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
  const FORMANCE_DATABASE_URL = requireEnv('FORMANCE_DATABASE_URL');
  const GH_PAT = requireEnv('GH_PAT');
  const BACKUP_REPO = requireEnv('BACKUP_REPO');

  // Timestamped filename + release tag. ISO order means lexical sort == time order.
  const now = new Date();
  const iso = now.toISOString().replace(/[:.]/g, '').replace(/Z$/, 'Z');
  const filename = `formance-backup-${iso}.dump`;
  const tagName = `formance-backup-${iso}`;

  try {
    // Run pg_dump. Pass args as an array (no shell) so the connection string
    // cannot be interpreted by a shell, eliminating any injection surface.
    execFileSync('pg_dump', [
      '--dbname', FORMANCE_DATABASE_URL,
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '-f', filename,
    ], {
      stdio: 'inherit',
      env: process.env,
    });

    if (!existsSync(filename)) {
      throw new Error(`Backup file not created: ${filename}`);
    }

    const headers = ghHeaders(GH_PAT);

    // (a) Create the release on BACKUP_REPO.
    const createRes = await fetch(`https://api.github.com/repos/${BACKUP_REPO}/releases`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: tagName,
        name: `Formance backup ${iso}`,
        body: `Automated Formance Postgres backup (pg_dump --format=custom). Asset: ${filename}.`,
      }),
    });
    if (!createRes.ok) {
      // A 404 here almost always means GH_PAT cannot see BACKUP_REPO: the repo
      // does not exist, was renamed, or the token lacks `contents: write` on it
      // (GitHub returns 404, not 403, for a private repo a token cannot access).
      // Spell that out so the owner fixes the secret instead of the script.
      const hint =
        createRes.status === 404
          ? ' (check the BACKUP_REPO and GH_PAT Actions secrets: the repo must exist as owner/name and GH_PAT must have contents: write on it)'
          : '';
      throw new Error(`Create release failed: ${createRes.status} ${await readBody(createRes)}${hint}`);
    }
    const release = await createRes.json();
    const releaseId = release.id;

    // (b) Upload the dump bytes to the release's upload_url. Strip the
    // `{?name,label}` URI template and append the filename as the `name` query.
    const uploadBase = String(release.upload_url).replace(/\{[^}]*\}$/, '');
    const fileBuffer = readFileSync(filename);
    const uploadRes = await fetch(`${uploadBase}?name=${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/octet-stream' },
      body: fileBuffer,
    });
    if (!uploadRes.ok) {
      throw new Error(`Upload asset failed: ${uploadRes.status} ${await readBody(uploadRes)}`);
    }

    // (c) Verify the asset is present on the release.
    const listRes = await fetch(
      `https://api.github.com/repos/${BACKUP_REPO}/releases/${releaseId}/assets`,
      { headers },
    );
    if (!listRes.ok) {
      throw new Error(`List assets failed: ${listRes.status} ${await readBody(listRes)}`);
    }
    const assets = await listRes.json();
    const found = Array.isArray(assets) && assets.some((a) => a.name === filename);
    if (!found) {
      throw new Error(`Backup asset not found on release ${tagName}: ${filename}`);
    }

    console.log(`Backup successful: ${filename} uploaded as a release asset on ${BACKUP_REPO} (tag ${tagName}).`);
  } catch (err) {
    console.error('Backup failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    // Clean up local file
    try { unlinkSync(filename); } catch { /* no-trace: the temporary file is already gone */ }
  }
}

main();
