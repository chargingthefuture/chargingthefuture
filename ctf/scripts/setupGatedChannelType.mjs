#!/usr/bin/env node

// One-time setup for the gated contributor channel's Stream channel type ('ctf-gated').
//
// Channel-type feature configuration lives in the Stream app, not in request-time code, so this
// script creates (or updates) the type once per Stream app with the gated feature set from the
// proposal (TRUSTED_CHANNELS_AND_CONTRIBUTOR_BADGE_PROPOSAL.md, section 2):
//   - threads/replies ON
//   - reactions ON (the app enforces its own fixed richer emoji set server-side)
//   - longer messages (4000 — the Commons member cap is 1200)
//   - uploads OFF (no images/files — hard guardrail; the app UI has no upload affordance either)
//   - typing events + read events ON (the live layer uses typing)
//
// Run it once against production and once against the demo/staging app (demo mode selects the
// *_STAGING credentials at runtime, so both apps need the type):
//   infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
//     node ctf/scripts/setupGatedChannelType.mjs
//   STREAM_API_KEY="$STREAM_API_KEY_STAGING" STREAM_API_SECRET="$STREAM_API_SECRET_STAGING" \
//     node ctf/scripts/setupGatedChannelType.mjs
//
// Idempotent: an existing 'ctf-gated' type is updated in place. Secrets come from the
// environment only and are never printed.

import { StreamChat } from 'stream-chat';

const GATED_CHANNEL_TYPE = 'ctf-gated';
const GATED_MAX_MESSAGE_LENGTH = 4000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

const apiKey = requireEnv('STREAM_API_KEY');
const apiSecret = requireEnv('STREAM_API_SECRET');

const typeConfig = {
  // Gated feature set — distinct from the Commons' built-in 'messaging' type.
  replies: true,
  reactions: true,
  typing_events: true,
  read_events: true,
  uploads: false,
  url_enrichment: false,
  max_message_length: GATED_MAX_MESSAGE_LENGTH,
};

async function main() {
  const client = new StreamChat(apiKey, apiSecret);
  try {
    await client.createChannelType({ name: GATED_CHANNEL_TYPE, ...typeConfig });
    console.log(`Created Stream channel type '${GATED_CHANNEL_TYPE}' (uploads off, replies + reactions on, max ${GATED_MAX_MESSAGE_LENGTH} chars).`);
  } catch (error) {
    const alreadyExists = typeof error?.message === 'string' && error.message.includes('already exists');
    if (!alreadyExists && error?.code !== 4) {
      throw error;
    }
    await client.updateChannelType(GATED_CHANNEL_TYPE, typeConfig);
    console.log(`Updated existing Stream channel type '${GATED_CHANNEL_TYPE}' to the gated config.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('setupGatedChannelType failed:', error?.message ?? error);
    process.exit(1);
  });
