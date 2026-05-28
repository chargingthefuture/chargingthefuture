#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
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

async function main() {
  // Target database to restore INTO (the new/recovery environment, NOT necessarily
  // the same DB that was backed up).
  const FORMANCE_DATABASE_URL = requireEnv('FORMANCE_DATABASE_URL');
  const SUPABASE_URL = requireEnv('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (process.env.FORMANCE_RESTORE_CONFIRM !== '1') {
    throw new Error(
      'Refusing to restore: set FORMANCE_RESTORE_CONFIRM=1 to confirm. ' +
        'This OVERWRITES the database referenced by FORMANCE_DATABASE_URL.',
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Pick the backup: an explicit FORMANCE_BACKUP_FILE, else the most recent dump.
  // Backup names are ISO-timestamped (formance-backup-<ts>.dump), so lexical sort
  // descending puts the newest first.
  let filename = process.env.FORMANCE_BACKUP_FILE?.trim();
  let safePath;

  if (!filename) {
    const { data: list, error: listError } = await supabase.storage.from('backups').list('formance/', {
      sortBy: { column: 'name', order: 'desc' },
      limit: 1,
    });
    if (listError) {
      throw listError;
    }
    if (!list || list.length === 0) {
      throw new Error('No Formance backups found in Supabase backups/formance/.');
    }
    filename = list[0].name;
  }

  // Sanitize filename to prevent path traversal
  const safeName = sanitizeFilename(filename);
  safePath = join(os.tmpdir(), safeName);

  console.log(`Restoring Formance backup: ${safeName}`);

  const { data, error: downloadError } = await supabase.storage.from('backups').download(`formance/${filename}`);
  if (downloadError) {
    throw downloadError;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
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
    try { unlinkSync(safePath); } catch {}
  }
}

main().catch((err) => {
  console.error('Restore failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
