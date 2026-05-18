#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { basename } from 'node:path';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function main() {
  const FORMDATABASE_URL = requireEnv('FORMANCE_DATABASE_URL');
  const SUPABASE_URL = requireEnv('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  // Generate timestamped filename
  const now = new Date();
  const iso = now.toISOString().replace(/[:.]/g, '').replace(/Z$/, 'Z');
  const filename = `formance-backup-${iso}.dump`;

  try {
    // Run pg_dump
    execSync(`pg_dump --dbname="${FORMDATABASE_URL}" --format=custom --no-owner --no-privileges -f "${filename}"`, {
      stdio: 'inherit',
      env: process.env,
    });

    if (!existsSync(filename)) {
      throw new Error(`Backup file not created: ${filename}`);
    }

    // Upload to Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const uploadPath = `formance/${filename}`;
    const fileBuffer = readFileSync(filename);
    const { error: uploadError } = await supabase.storage.from('backups').upload(uploadPath, fileBuffer, {
      contentType: 'application/octet-stream',
      upsert: false,
    });
    if (uploadError) {
      throw uploadError;
    }

    // Verify upload
    const { data: list, error: listError } = await supabase.storage.from('backups').list('formance/');
    if (listError) {
      throw listError;
    }
    const found = list && list.some(f => f.name === filename);
    if (!found) {
      throw new Error(`Backup file not found in Supabase: ${filename}`);
    }

    console.log(`Backup successful: ${filename} uploaded to Supabase backups/formance/`);
  } catch (err) {
    console.error('Backup failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    // Clean up local file
    try { unlinkSync(filename); } catch {}
  }
}

main();
