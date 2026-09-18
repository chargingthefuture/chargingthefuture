// Stream setup for the Chyme guest listener — the whole of it, done from code.
//
// Why this exists: when CHYME_GUEST_STREAM_ROLE is set, every signed-out listener is minted as a
// Stream user with that role, and Stream refuses the join unless (1) the role exists in the app and
// (2) the `default` call type grants it `join-call`. Both used to be dashboard steps in the runbook.
// The second was left undone once, and the result was every guest refused for months while members
// in the room saw nothing wrong:
//
//   Stream error code 17: JoinCall failed with error: "User 'chyme-guest-…' with role
//   'chyme_listener' is not allowed to perform action JoinCall in scope 'video:default'"
//
// A dashboard step cannot be tested, diffed, or re-run, and the dashboard does not work at phone
// width, which is the only screen the owner has. So this script owns the target state and applies
// it through Stream's APIs:
//
//   - the role named by CHYME_GUEST_STREAM_ROLE exists in the app (Chat API, roles are app-wide);
//   - on the call type, that role has `join-call` and `read-call`, does not have `send-audio`,
//     `send-video` or `screenshare`, and keeps anything else it already had (Video API).
//
// Members are untouched: only the named role changes, and only guests carry it.
//
// Modes (--mode=…, default plan):
//   plan   read everything, print the state and what apply would change, exit 0. Writes nothing.
//   check  same as plan but exit 1 when anything is out of the target state. For the schedule.
//   apply  write what is missing, read it back, exit 1 if the read-back is still short.
//
// Runbook:  ctf/docs/plugins/chyme/guest-listener-stream-role.md
// Workflow: .github/workflows/stream-guest-listener-setup.yml
//
// Secrets safety: this NEVER prints the secret or a token, and scrubs the api key out of any Stream
// error text — only role names, the call type, capability lists, and Stream's own message appear.
//
//   infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
//     node ctf/scripts/stream-guest-listener-setup.mjs [--mode=plan|check|apply] [--target=production|staging|both]

import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';

// stream-chat is a dependency of @ctf/web, not of the workspace root, so resolve it from there.
const requireFromWeb = createRequire(new URL('../packages/web/package.json', import.meta.url));
const { StreamChat } = requireFromWeb('stream-chat');

const VIDEO_API = 'https://video.stream-io-api.com';
const CALL_TYPE = process.env.STREAM_CALL_TYPE?.trim() || 'default';

// What a listener needs, and what a listener must not have. Mirrors the runbook.
const LISTEN_CAPABILITIES = ['join-call', 'read-call'];
const PUBLISH_CAPABILITIES = ['send-audio', 'send-video', 'screenshare'];

const MODES = ['plan', 'check', 'apply'];
const TARGETS = ['production', 'staging', 'both'];

const PAIRS = {
  production: { label: 'production', keyVar: 'STREAM_API_KEY', secretVar: 'STREAM_API_SECRET' },
  staging: { label: 'demo / staging', keyVar: 'STREAM_API_KEY_STAGING', secretVar: 'STREAM_API_SECRET_STAGING' },
};

function readTrimmed(name) {
  const raw = process.env[name];
  return typeof raw === 'string' ? raw.trim() : '';
}

function readOption(argv, name, allowed, fallback) {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  const value = arg ? arg.slice(name.length + 3) : fallback;
  if (!allowed.includes(value)) {
    throw new Error(`--${name} must be one of ${allowed.join(', ')} (got "${value}").`);
  }
  return value;
}

// Stream's own error text can carry the request URL, and the URL carries the api key.
function scrub(text) {
  return String(text).replace(/api_key=[^&\s"']+/g, 'api_key=[redacted]');
}

function describe(error) {
  return scrub(error instanceof Error ? error.message : String(error));
}

// Stream server-side auth for the Video REST API: a JWT signed with the API secret, { server: true }.
function serverToken(apiSecret) {
  return jwt.sign({ server: true }, apiSecret, { algorithm: 'HS256' });
}

async function videoRequest({ apiKey, token }, method, path, body) {
  const url = `${VIDEO_API}${path}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: token, 'stream-auth-type': 'jwt', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // no-trace: the body was not JSON, so the raw text below is the message; nothing is lost.
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${scrub(json?.message ?? text.slice(0, 300))}`);
  }
  return json;
}

function sameSet(a, b) {
  return a.length === b.length && a.every((cap) => b.includes(cap));
}

// The target capability list for the role: keep what it has, add the listen pair, drop publish.
function targetCapabilities(current) {
  const kept = current.filter((cap) => !PUBLISH_CAPABILITIES.includes(cap));
  for (const cap of LISTEN_CAPABILITIES) {
    if (!kept.includes(cap)) kept.push(cap);
  }
  return kept;
}

function pad(text) {
  return `    ${text}`;
}

// --- The role itself (Chat API; roles are app-wide and shared with Video) ---------------------

async function roleExists(chat, role) {
  const res = await chat.listRoles();
  const roles = Array.isArray(res?.roles) ? res.roles : [];
  return roles.some((r) => r?.name === role);
}

async function ensureRole(chat, role, mode) {
  const exists = await roleExists(chat, role);
  if (exists) {
    console.log(pad(`role "${role}": exists.`));
    return { drift: false, changed: false };
  }
  if (mode !== 'apply') {
    console.log(pad(`role "${role}": MISSING — apply would create it.`));
    return { drift: true, changed: false };
  }
  await chat.createRole(role);
  if (!(await roleExists(chat, role))) {
    throw new Error(`created role "${role}" but it is not in the list on read-back.`);
  }
  console.log(pad(`role "${role}": created.`));
  return { drift: true, changed: true };
}

// --- The call-type grants (Video API) -----------------------------------------------------------

async function readGrants(auth, role) {
  const callType = await videoRequest(auth, 'GET', `/video/call_types/${encodeURIComponent(CALL_TYPE)}`);
  const grants = callType?.grants ?? {};
  return Array.isArray(grants[role]) ? [...grants[role]] : [];
}

async function ensureGrants(auth, role, mode, roleJustCreated) {
  const before = await readGrants(auth, role);
  const after = targetCapabilities(before);
  console.log(pad(`call type "${CALL_TYPE}", role "${role}"`));
  console.log(pad(`  before: ${before.length ? before.join(', ') : '(none)'}`));
  console.log(pad(`  target: ${after.join(', ')}`));

  if (sameSet(before, after)) {
    console.log(pad('  grants: in the target state.'));
    return { drift: false, changed: false };
  }
  if (mode !== 'apply') {
    console.log(pad('  grants: OUT OF TARGET STATE — apply would set them.'));
    return { drift: true, changed: false };
  }

  // A role created seconds ago can take a moment to be visible to the Video side; retry briefly.
  const attempts = roleJustCreated ? 4 : 1;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await videoRequest(auth, 'PUT', `/video/call_types/${encodeURIComponent(CALL_TYPE)}`, { grants: { [role]: after } });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  if (lastError) throw lastError;

  // Read it back so the log shows what Stream stored, not what was sent.
  const stored = await readGrants(auth, role);
  console.log(pad(`  stored: ${stored.length ? stored.join(', ') : '(none)'}`));
  if (!LISTEN_CAPABILITIES.every((cap) => stored.includes(cap)) || PUBLISH_CAPABILITIES.some((cap) => stored.includes(cap))) {
    throw new Error('write returned OK but the read-back is not in the target state.');
  }
  console.log(pad('  grants: applied.'));
  return { drift: true, changed: true };
}

// --- One Stream app -----------------------------------------------------------------------------

async function processPair(pair, role, mode) {
  const apiKey = readTrimmed(pair.keyVar);
  const apiSecret = readTrimmed(pair.secretVar);

  if (!apiKey && !apiSecret) {
    console.log(`• ${pair.label}: not set (${pair.keyVar} / ${pair.secretVar}) — skipped.`);
    return { ok: true, drift: false };
  }
  if (!apiKey || !apiSecret) {
    console.error(`✗ ${pair.label}: half-configured — ${apiKey ? pair.secretVar : pair.keyVar} is empty.`);
    return { ok: false, drift: true };
  }

  console.log(`• ${pair.label}:`);
  const chat = new StreamChat(apiKey, apiSecret);
  const auth = { apiKey, token: serverToken(apiSecret) };
  try {
    const roleResult = await ensureRole(chat, role, mode);
    const grantResult = await ensureGrants(auth, role, mode, roleResult.changed);
    return { ok: true, drift: roleResult.drift || grantResult.drift };
  } catch (error) {
    console.error(`✗ ${pair.label}: ${describe(error)}`);
    return { ok: false, drift: true };
  } finally {
    await chat.disconnectUser().catch(() => {});
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const mode = readOption(argv, 'mode', MODES, 'plan');
  const target = readOption(argv, 'target', TARGETS, 'production');

  const role = readTrimmed('STREAM_GUEST_ROLE') || readTrimmed('CHYME_GUEST_STREAM_ROLE');
  if (!role) {
    console.error('✗ No role: CHYME_GUEST_STREAM_ROLE is unset (and no STREAM_GUEST_ROLE override). With it unset, guests use the default role and can already join — there is nothing to set up.');
    process.exit(1);
  }

  console.log(`Guest listener setup — mode ${mode}, role "${role}", call type "${CALL_TYPE}", target ${target}.`);

  const pairs = target === 'both' ? [PAIRS.production, PAIRS.staging] : [PAIRS[target]];
  let ok = true;
  let drift = false;
  for (const pair of pairs) {
    const result = await processPair(pair, role, mode);
    ok = ok && result.ok;
    drift = drift || result.drift;
  }

  if (!ok) {
    console.error('\nAt least one Stream app could not be read or written. The lines above say which and why.');
    process.exit(1);
  }
  if (mode === 'check' && drift) {
    console.error('\nOut of the target state. Run the workflow with mode "apply" to fix it; nothing was changed.');
    process.exit(1);
  }
  if (mode === 'apply') {
    console.log(drift ? '\nDone. Guests can join on the next page load; no redeploy is needed.' : '\nNothing to do — already in the target state.');
  } else {
    console.log(drift ? '\nPlan complete. Run with mode "apply" to make these changes.' : '\nIn the target state.');
  }
}

main().catch((error) => {
  console.error(`✗ ${describe(error)}`);
  process.exit(1);
});
