// Stream channel-type settings check — finds the settings that stop members sending messages.
//
// Why this exists: every chat in the app (SocketRelay Direct Line, LightHouse, TrustTransport,
// PeerProgramming, Foundation, Beacon, the gated contributor channel) sends into a Stream channel
// type. Some channel-type settings make Stream REFUSE every send, and the refusal arrives as a bare
// HTTP 403 that the chat library labels "Message Failed · Unauthorized" — the same words it uses for
// unrelated problems. Nothing in the codebase can cause or cure it, because it is a setting on the
// Stream side, so this script reads those settings back and names the one that is wrong.
//
// The setting that caused the reported outage: `mark_messages_pending` ON while the Stream app does
// not have the pending-messages feature. Stream then answers every send with
// "SendMessage failed with error: \"pending messages not enabled for this app\"" and no message can
// ever be sent on that channel type, in any plugin.
//
// Secrets safety: this NEVER prints the key or the secret — only setting names, their values, and
// Stream's own error text. Run it through Infisical so the values come from the production
// environment:
//
//   infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
//     pnpm --dir ctf/packages/web run check:stream-channel-config
//
// Add --fix to turn the blocking setting off (an explicit, owner-run repair; the check alone changes
// nothing):
//
//   ... -- pnpm --dir ctf/packages/web run check:stream-channel-config -- --fix
//
// Exit code: 0 when no channel type blocks sending, 1 when one does (or when --fix could not repair
// it). A credential pair that is entirely unset is skipped, not failed — Stream-backed features
// degrade by design when unconfigured.

// The channel types this app sends into. 'messaging' carries every plugin chat; the two 'ctf-gated'
// types carry the gated contributor channel.
const CHANNEL_TYPES = ['messaging', 'ctf-gated', 'ctf-gated-system'];

const PAIRS = [
  { label: 'production', keyVar: 'STREAM_API_KEY', secretVar: 'STREAM_API_SECRET' },
  { label: 'demo / staging', keyVar: 'STREAM_API_KEY_STAGING', secretVar: 'STREAM_API_SECRET_STAGING' },
];

// The setting that blocks sending outright, with the plain-words explanation printed when it is on.
const BLOCKING_SETTING = 'mark_messages_pending';
const BLOCKING_EXPLANATION =
  'Stream holds every message for review, but this app does not have the pending-messages feature, so it refuses every send with "pending messages not enabled for this app".';

function readTrimmed(name) {
  const raw = process.env[name];
  return typeof raw === 'string' ? raw.trim() : '';
}

// Read the channel-type settings straight from the Stream app. Returns a map of channel type ->
// config, limited to the types this app uses; a type the app has never created is simply absent.
async function readChannelConfigs(client) {
  const settings = await client.getAppSettings();
  const configs = settings?.app?.channel_configs ?? {};
  const found = new Map();
  for (const type of CHANNEL_TYPES) {
    if (configs[type]) {
      found.set(type, configs[type]);
    }
  }
  return found;
}

async function checkPair(StreamChat, pair, shouldFix) {
  const apiKey = readTrimmed(pair.keyVar);
  const apiSecret = readTrimmed(pair.secretVar);

  if (!apiKey && !apiSecret) {
    console.log(`• ${pair.label}: not set (${pair.keyVar} / ${pair.secretVar}) — skipped.`);
    return { blocked: false };
  }
  if (!apiKey || !apiSecret) {
    console.error(`✗ ${pair.label}: half-configured — ${apiKey ? pair.secretVar : pair.keyVar} is empty.`);
    return { blocked: true };
  }

  const client = new StreamChat(apiKey, apiSecret);
  let configs;
  try {
    configs = await readChannelConfigs(client);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ ${pair.label}: could not read the channel-type settings — ${message}`);
    return { blocked: true };
  }

  if (configs.size === 0) {
    console.log(`• ${pair.label}: none of the channel types this app uses exist yet — nothing to check.`);
    return { blocked: false };
  }

  let blocked = false;
  for (const [type, config] of configs) {
    if (config[BLOCKING_SETTING] !== true) {
      console.log(`✓ ${pair.label} · ${type}: members can send (${BLOCKING_SETTING} is off).`);
      continue;
    }

    console.error(`✗ ${pair.label} · ${type}: NO member can send a message. ${BLOCKING_SETTING} is on.`);
    console.error(`    ${BLOCKING_EXPLANATION}`);

    if (!shouldFix) {
      blocked = true;
      console.error(`    Fix it by turning "Mark Messages Pending" off for the ${type} channel type in the Stream dashboard (Chat → Channel Types), or re-run this with --fix.`);
      continue;
    }

    try {
      await client.updateChannelType(type, { [BLOCKING_SETTING]: false });
      console.log(`  ↳ fixed: ${BLOCKING_SETTING} turned off for ${type}. Members can send again.`);
    } catch (error) {
      blocked = true;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ↳ could not turn it off — ${message}`);
      console.error('    Turn "Mark Messages Pending" off by hand in the Stream dashboard (Chat → Channel Types).');
    }
  }
  return { blocked };
}

async function main() {
  const shouldFix = process.argv.includes('--fix');

  let StreamChat;
  try {
    ({ StreamChat } = await import('stream-chat'));
  } catch {
    console.error('Could not load the "stream-chat" package. Run this from the @ctf/web workspace.');
    process.exit(2);
  }

  if (shouldFix) {
    console.log('Running with --fix: any channel type that blocks sending will be repaired.\n');
  }

  let anyBlocked = false;
  for (const pair of PAIRS) {
    const result = await checkPair(StreamChat, pair, shouldFix);
    anyBlocked = anyBlocked || result.blocked;
  }

  if (anyBlocked) {
    console.error('\nChat is blocked by a Stream channel-type setting. See the lines marked ✗ above.');
    process.exit(1);
  }

  console.log('\nNo channel-type setting is blocking chat.');
  process.exit(0);
}

await main();
