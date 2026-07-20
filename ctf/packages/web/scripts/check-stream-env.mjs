// Stream (GetStream) credential validator — a live auth check, not just a presence check.
//
// Why this exists: the Foundation plugin (and the other Stream-backed chats) fail with
// "Connections are temporarily unavailable" when the Stream API key/secret are *present but do not
// authenticate* — a mismatched key+secret pair (the two belong to different Stream apps), a
// placeholder value, or a suspended/deleted Stream app. A plain "is the variable set?" check cannot
// tell those apart from working credentials, so this script makes one lightweight authenticated
// server call per credential pair and reports PASS/FAIL.
//
// Demo mode routes chat to a SEPARATE Stream app via the *_STAGING pair (see
// lib/integrations/stream-credentials.ts and rule 110). Both the production and the demo/staging
// pairs are checked here.
//
// Secrets safety: this NEVER prints the key or the secret. It prints only PASS/FAIL and the Stream
// error message (Stream's error text does not echo the secret). Run it through Infisical so the
// values come from the production environment, e.g.:
//
//   infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
//     pnpm --dir ctf/packages/web run check:stream-env
//
// Exit code: 0 when every credential pair that is set authenticates (a pair that is entirely unset is
// reported as a warning, not a failure — Stream-backed features degrade by design when unconfigured).
// Non-zero when a pair is set but fails to authenticate, or is only half-set (key without secret).

import { randomUUID } from 'node:crypto';

const PAIRS = [
  {
    label: 'production',
    keyVar: 'STREAM_API_KEY',
    secretVar: 'STREAM_API_SECRET',
    note: 'used for real (non-demo) members',
  },
  {
    label: 'demo / staging',
    keyVar: 'STREAM_API_KEY_STAGING',
    secretVar: 'STREAM_API_SECRET_STAGING',
    note: 'used when demo mode is on — this is the Foundation demo path',
  },
];

function readTrimmed(name) {
  const raw = process.env[name];
  return typeof raw === 'string' ? raw.trim() : '';
}

// One lightweight authenticated server call. upsertUser hits the Stream API and requires a valid
// key+secret pair, so a bad pair rejects here. The throwaway user is hard-deleted best-effort after.
//
// The probe user id MUST be unique per run. Stream keeps a tombstone for a hard-deleted user id and
// rejects re-creating it ("user ... was deleted", error code 16), so reusing a fixed id makes every
// run after the first fail even when the credentials are perfectly valid. A fresh UUID each run never
// collides with a previously-deleted id.
async function verifyPair(StreamChat, apiKey, apiSecret) {
  const client = new StreamChat(apiKey, apiSecret);
  const probeUserId = `ctf-stream-env-check-${randomUUID()}`;
  try {
    await client.upsertUser({ id: probeUserId, name: 'CTF Stream env check' });
    try {
      await client.deleteUser(probeUserId, { hard_delete: true });
    } catch {
      // Cleanup is best-effort — leaving the probe user does not affect the result.
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  } finally {
    try {
      await client.disconnectUser();
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  let StreamChat;
  try {
    ({ StreamChat } = await import('stream-chat'));
  } catch {
    console.error('Could not load the "stream-chat" package. Run this from the @ctf/web workspace.');
    process.exit(2);
  }

  let hadFailure = false;
  let checkedAny = false;

  for (const pair of PAIRS) {
    const apiKey = readTrimmed(pair.keyVar);
    const apiSecret = readTrimmed(pair.secretVar);

    if (!apiKey && !apiSecret) {
      console.log(`• ${pair.label}: not set (${pair.keyVar} / ${pair.secretVar}) — ${pair.note}. Stream-backed features degrade when unconfigured.`);
      continue;
    }

    if (!apiKey || !apiSecret) {
      hadFailure = true;
      const missing = apiKey ? pair.secretVar : pair.keyVar;
      console.error(`✗ ${pair.label}: half-configured — ${missing} is empty. Both the key and the secret must be set.`);
      continue;
    }

    checkedAny = true;
    const result = await verifyPair(StreamChat, apiKey, apiSecret);
    if (result.ok) {
      console.log(`✓ ${pair.label}: credentials authenticate with Stream (${pair.note}).`);
    } else {
      hadFailure = true;
      console.error(`✗ ${pair.label}: credentials are set but Stream REJECTED them — ${pair.note}.`);
      console.error(`    Stream said: ${result.message}`);
      console.error(`    Likely cause: ${pair.keyVar} and ${pair.secretVar} are from different Stream apps, a placeholder, or the app is suspended.`);
    }
  }

  if (!checkedAny && !hadFailure) {
    console.log('No Stream credential pairs were set; nothing to validate.');
    process.exit(0);
  }

  if (hadFailure) {
    console.error('\nStream credential validation FAILED. See the lines marked ✗ above.');
    process.exit(1);
  }

  console.log('\nAll configured Stream credential pairs authenticate.');
  process.exit(0);
}

await main();
