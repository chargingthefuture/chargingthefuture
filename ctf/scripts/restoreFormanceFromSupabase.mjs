#!/usr/bin/env node

// Restore a Formance Postgres backup (produced by backupFormanceToSupabase.mjs)
// from Supabase Storage into a target Formance database. This is the automated
// half of disaster recovery / spinning up a fresh Formance environment:
//
//   1. Provision a new Postgres (e.g. a Neon project) and set FORMANCE_DATABASE_URL
//      to its connection string.
//   2. Run this script to load the latest (or a specified) backup dump.
//   3. Deploy the Formance ledger image (ops/formance/Dockerfile.ledger); its
//      AUTO_UPGRADE brings the schema up to the current ledger version on start.
//
// The dump is pg_dump custom-format (-Fc), so it is restored with pg_restore.
// Because restore is destructive, it refuses to run unless FORMANCE_RESTORE_CONFIRM=1
// is set — automation sets it intentionally so the script can never clobber a
// database by accident.

import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, unlinkSync } from 'node:fs';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
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
  // ascending puts the newest last.
  let filename = process.env.FORMANCE_BACKUP_FILE?.trim();
  if (!filename) {
    const { data: list, error: listError } = await supabase.storage.from('backups').list('formance/', {
      sortBy: { column: 'name', order: 'asc' },
    });
    if (listError) {
      throw listError;
    }
    const dumps = (list ?? []).filter((f) => f.name.endsWith('.dump')).map((f) => f.name).sort();
    if (dumps.length === 0) {
      throw new Error('No Formance backups found in Supabase backups/formance/.');
    }
    filename = dumps[dumps.length - 1];
  }

  console.log(`Restoring Formance backup: ${filename}`);

  const { data, error: downloadError } = await supabase.storage.from('backups').download(`formance/${filename}`);
  if (downloadError) {
    throw downloadError;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  writeFileSync(filename, buffer);

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
      filename,
    ], {
      stdio: 'inherit',
      env: process.env,
    });

    console.log(`Restore successful: ${filename} -> target Formance database.`);
  } catch (err) {
    console.error('Restore failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    try { unlinkSync(filename); } catch {}
  }
}

main().catch((err) => {
  console.error('Restore failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
