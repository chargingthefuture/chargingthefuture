// Stream call-type grant for the Chyme guest listener — the one-time Video config, done from CI.
//
// Why this exists: when CHYME_GUEST_STREAM_ROLE is set, every signed-out listener is minted as a
// Stream user with that role. Stream then refuses the join unless the `default` call type grants
// the role `join-call`. With the role created but that grant missing, the public Chyme page reads:
//
//   Stream error code 17: JoinCall failed with error: "User 'chyme-guest-…' with role
//   'chyme_listener' is not allowed to perform action JoinCall in scope 'video:default'"
//
// The grant lives in the Stream dashboard, which does not work at phone width, and the owner works
// from a phone. So this applies the runbook's target state through Stream's Video API instead:
// the role can join and read the call, and cannot publish (send-audio / send-video / screenshare).
// Everything else the role already has is left alone. Members are untouched — only the named role
// changes, and only guests carry it.
//
// Runbook: ctf/docs/plugins/chyme/guest-listener-stream-role.md
// Workflow: .github/workflows/stream-grant-guest-listener.yml
//
// Secrets safety: this NEVER prints the key, the secret, the token, or a request URL — only the role
// name, the call type, the capability lists before and after, and Stream's own error text.
//
// Dry run by default: prints what it would change and exits 0. Pass --apply to write.
//
//   infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
//     node ctf/scripts/stream-grant-guest-listener.mjs [--apply] [--target=production|staging|both]

import jwt from 'jsonwebtoken';

const VIDEO_API = 'https://video.stream-io-api.com';
const CALL_TYPE = process.env.STREAM_CALL_TYPE?.trim() || 'default';

// What a listener needs, and what a listener must not have. Mirrors the runbook.
const LISTEN_CAPABILITIES = ['join-call', 'read-call'];
const PUBLISH_CAPABILITIES = ['send-audio', 'send-video', 'screenshare'];

const PAIRS = {
  production: { label: 'production', keyVar: 'STREAM_API_KEY', secretVar: 'STREAM_API_SECRET' },
  staging: { label: 'demo / staging', keyVar: 'STREAM_API_KEY_STAGING', secretVar: 'STREAM_API_SECRET_STAGING' },
};

function readTrimmed(name) {
  const raw = process.env[name];
  return typeof raw === 'string' ? raw.trim() : '';
}

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const targetArg = argv.find((a) => a.startsWith('--target='));
  const target = targetArg ? targetArg.slice('--target='.length) : 'production';
  if (!['production', 'staging', 'both'].includes(target)) {
    throw new Error(`--target must be production, staging, or both (got "${target}").`);
  }
  return { apply, target };
}

// Stream server-side auth: a JWT signed with the API secret carrying { server: true }.
function serverToken(apiSecret) {
  return jwt.sign({ server: true }, apiSecret, { algorithm: 'HS256' });
}

async function streamRequest({ apiKey, token }, method, path, body) {
  const url = `${VIDEO_API}${path}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: token,
      'stream-auth-type': 'jwt',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON — the raw text is the message.
  }
  if (!res.ok) {
    // Path only: the URL carries the api key.
    const detail = json?.message ?? text.slice(0, 300);
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${detail}`);
  }
  return json;
}

// The target capability list for the role: keep what it has, add the listen pair, drop publish.
function targetCapabilities(current) {
  const kept = current.filter((cap) => !PUBLISH_CAPABILITIES.includes(cap));
  for (const cap of LISTEN_CAPABILITIES) {
    if (!kept.includes(cap)) kept.push(cap);
  }
  return kept;
}

function sameList(a, b) {
  return a.length === b.length && a.every((cap) => b.includes(cap));
}

async function processPair(pair, role, apply) {
  const apiKey = readTrimmed(pair.keyVar);
  const apiSecret = readTrimmed(pair.secretVar);

  if (!apiKey && !apiSecret) {
    console.log(`• ${pair.label}: not set (${pair.keyVar} / ${pair.secretVar}) — skipped.`);
    return { ok: true, changed: false };
  }
  if (!apiKey || !apiSecret) {
    console.error(`✗ ${pair.label}: half-configured — ${apiKey ? pair.secretVar : pair.keyVar} is empty.`);
    return { ok: false, changed: false };
  }

  const auth = { apiKey, token: serverToken(apiSecret) };

  let callType;
  try {
    callType = await streamRequest(auth, 'GET', `/video/call_types/${encodeURIComponent(CALL_TYPE)}`);
  } catch (error) {
    console.error(`✗ ${pair.label}: could not read call type "${CALL_TYPE}" — ${error.message}`);
    return { ok: false, changed: false };
  }

  const grants = callType?.grants ?? {};
  const before = Array.isArray(grants[role]) ? [...grants[role]] : [];
  const after = targetCapabilities(before);
  const roleKnown = Object.prototype.hasOwnProperty.call(grants, role);

  console.log(`• ${pair.label}: call type "${CALL_TYPE}", role "${role}"${roleKnown ? '' : ' (no grants row yet)'}`);
  console.log(`    before: ${before.length ? before.join(', ') : '(none)'}`);
  console.log(`    after:  ${after.join(', ')}`);

  if (sameList(before, after)) {
    console.log('    already in the target state — nothing to change.');
    return { ok: true, changed: false };
  }

  if (!apply) {
    console.log('    dry run — pass --apply to write this.');
    return { ok: true, changed: false };
  }

  try {
    await streamRequest(auth, 'PUT', `/video/call_types/${encodeURIComponent(CALL_TYPE)}`, {
      grants: { [role]: after },
    });
  } catch (error) {
    console.error(`✗ ${pair.label}: update refused — ${error.message}`);
    return { ok: false, changed: false };
  }

  // Read it back so the log shows what Stream actually stored, not what was sent.
  try {
    const verify = await streamRequest(auth, 'GET', `/video/call_types/${encodeURIComponent(CALL_TYPE)}`);
    const stored = Array.isArray(verify?.grants?.[role]) ? verify.grants[role] : [];
    console.log(`    stored: ${stored.length ? stored.join(', ') : '(none)'}`);
    if (!LISTEN_CAPABILITIES.every((cap) => stored.includes(cap))) {
      console.error(`✗ ${pair.label}: write returned OK but the read-back is missing a listen capability.`);
      return { ok: false, changed: true };
    }
  } catch (error) {
    console.error(`✗ ${pair.label}: written, but the read-back failed — ${error.message}`);
    return { ok: false, changed: true };
  }

  console.log('    applied.');
  return { ok: true, changed: true };
}

async function main() {
  const { apply, target } = parseArgs(process.argv.slice(2));

  const role = readTrimmed('STREAM_GUEST_ROLE') || readTrimmed('CHYME_GUEST_STREAM_ROLE');
  if (!role) {
    console.error('✗ No role: CHYME_GUEST_STREAM_ROLE is unset (and no STREAM_GUEST_ROLE override). With it unset, guests already use the default role and can join — there is nothing to grant.');
    process.exit(1);
  }

  console.log(`${apply ? 'Applying' : 'Dry run —'} listener grants for role "${role}" on call type "${CALL_TYPE}" (${target}).`);

  const pairs = target === 'both' ? [PAIRS.production, PAIRS.staging] : [PAIRS[target]];
  let ok = true;
  for (const pair of pairs) {
    const result = await processPair(pair, role, apply);
    ok = ok && result.ok;
  }

  if (!ok) {
    console.error('\nAt least one Stream app is not in the target state. Read the lines above for which one and why.');
    process.exit(1);
  }
  console.log(apply ? '\nDone. Guests can join on the next page load; no redeploy is needed.' : '\nDry run complete. Re-run with --apply to write.');
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
