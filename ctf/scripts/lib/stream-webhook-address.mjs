// The address Stream sends call events to, owned by code instead of a dashboard field.
//
// Why this exists: Stream delivers every call event (Beacon's feed and recording starts, the replay
// post, the Video minute meter) to one address, typed into the Stream dashboard by hand. When the app
// moved to app.lagatos.com (owner decision, 2026-10-28) and app.chargingthefuture.com stopped
// resolving, that field still named the old host, and Stream reported every delivery as failed:
// "unable to resolve url https://app.chargingthefuture.com/api/beacon/stream-webhook". Nothing in the
// app noticed, because a delivery that never arrives writes nothing.
//
// Target state, per Stream app:
//   - every webhook address on the app (the app-level `webhook_url` and the `webhook_url` of each
//     webhook-type entry in `event_hooks`) that names this app's webhook route, or a retired host,
//     is exactly TARGET;
//   - at least one of them is TARGET. When none is and the app-level field is empty, apply fills it.
// Any other address (a hook somebody pointed at another service) is left exactly as it is.
//
// Secrets safety: the addresses printed here carry no secret; Stream's error text is scrubbed by the
// caller.

const WEBHOOK_PATH = '/api/beacon/stream-webhook';
const RETIRED_HOSTS = ['app.chargingthefuture.com', 'chargingthefuture.com', 'www.chargingthefuture.com'];
const DEFAULT_TARGET = `https://app.lagatos.com${WEBHOOK_PATH}`;

// Fields Stream returns on an event hook that it sets itself; sent back, they are refused or ignored.
const HOOK_READ_ONLY_FIELDS = ['created_at', 'updated_at'];

export function webhookTarget() {
  const override = typeof process.env.STREAM_WEBHOOK_URL === 'string' ? process.env.STREAM_WEBHOOK_URL.trim() : '';
  return override || DEFAULT_TARGET;
}

function parse(address) {
  try {
    return new URL(address);
  } catch {
    // no-trace: an address that is not a URL is not ours; the caller leaves it alone.
    return null;
  }
}

// True when the address is meant for this app: our route on any host, or any path on a retired host.
function isOurs(address) {
  const url = parse(address);
  if (!url) return false;
  return url.pathname.replace(/\/+$/, '') === WEBHOOK_PATH || RETIRED_HOSTS.includes(url.hostname);
}

// The address it should be: TARGET for our route; for another path on a retired host, the same path
// on the target's host.
function corrected(address, target) {
  const url = parse(address);
  if (url.pathname.replace(/\/+$/, '') === WEBHOOK_PATH) return target;
  const next = new URL(target);
  next.pathname = url.pathname;
  next.search = url.search;
  return next.toString();
}

async function readApp(chat) {
  const res = await chat.getAppSettings();
  const app = res?.app ?? {};
  return {
    webhookUrl: typeof app.webhook_url === 'string' ? app.webhook_url : '',
    eventHooks: Array.isArray(app.event_hooks) ? app.event_hooks : [],
  };
}

function plan(state, target) {
  const changes = {};
  const lines = [];

  if (state.webhookUrl && isOurs(state.webhookUrl) && state.webhookUrl !== target) {
    changes.webhook_url = corrected(state.webhookUrl, target);
    lines.push(`webhook_url: ${state.webhookUrl} → ${changes.webhook_url}`);
  }

  let hooksChanged = false;
  const hooks = state.eventHooks.map((hook) => {
    const address = typeof hook?.webhook_url === 'string' ? hook.webhook_url : '';
    const copy = { ...hook };
    for (const field of HOOK_READ_ONLY_FIELDS) delete copy[field];
    if (address && isOurs(address) && address !== target) {
      copy.webhook_url = corrected(address, target);
      hooksChanged = true;
      lines.push(`event hook ${hook.id ?? '(no id)'}: ${address} → ${copy.webhook_url}`);
    }
    return copy;
  });
  if (hooksChanged) changes.event_hooks = hooks;

  const all = [changes.webhook_url ?? state.webhookUrl, ...hooks.map((h) => h?.webhook_url)].filter(Boolean);
  if (!all.includes(target)) {
    if (state.webhookUrl && !isOurs(state.webhookUrl)) {
      throw new Error(
        `no webhook address points at ${target}, and webhook_url already names another service (${state.webhookUrl}). ` +
          'Not overwriting it; add the address as an event hook in the Stream dashboard.',
      );
    }
    changes.webhook_url = target;
    lines.push(`webhook_url: (empty) → ${target}`);
  }

  return { changes, lines };
}

function printState(state, pad) {
  console.log(pad(`  webhook_url: ${state.webhookUrl || '(empty)'}`));
  for (const hook of state.eventHooks) {
    if (hook?.webhook_url) {
      console.log(pad(`  event hook ${hook.id ?? '(no id)'} (${hook.hook_type ?? 'webhook'}): ${hook.webhook_url}`));
    }
  }
}

export async function ensureWebhookAddress(chat, mode, pad) {
  const target = webhookTarget();
  const before = await readApp(chat);
  console.log(pad(`webhook address, target ${target}`));
  printState(before, pad);

  const { changes, lines } = plan(before, target);
  if (lines.length === 0) {
    console.log(pad('  webhook address: in the target state.'));
    return { drift: false, changed: false };
  }
  for (const line of lines) console.log(pad(`  ${mode === 'apply' ? 'setting' : 'would set'} ${line}`));
  if (mode !== 'apply') {
    console.log(pad('  webhook address: OUT OF TARGET STATE — apply would set it.'));
    return { drift: true, changed: false };
  }

  await chat.updateAppSettings(changes);

  // Read it back so the log shows what Stream stored, not what was sent.
  const after = await readApp(chat);
  console.log(pad('  stored:'));
  printState(after, pad);
  if (plan(after, target).lines.length > 0) {
    throw new Error('webhook address write returned OK but the read-back is not in the target state.');
  }
  console.log(pad('  webhook address: applied.'));
  return { drift: true, changed: true };
}
