#!/usr/bin/env node
/* eslint-env node */
/* global console, process */
// Stream AI moderation and auto-translation (3.1.0 plan, Personal controls and safety), owned by
// code instead of dashboard clicks. Run by .github/workflows/stream-moderation-setup.yml.
//
// Target state on each Stream app:
//   - Chat auto-translation is on for the app (`auto_translation_enabled`), so a channel can
//     translate messages into each reader's language.
//   - Two moderation configs with the same rules:
//       se:posts       for the app's own posts and pictures, checked through the moderation check
//                      endpoint with this key;
//       chat:messaging for Stream chat channels of type messaging, the one type the app uses.
//     AI text: any harm Stream rates critical is removed, high is flagged for review. Rules by
//     severity rather than by label, so no label name has to be guessed and new labels are covered.
//     AI pictures: every label Stream offers is removed at 90% confidence and above.
//
// Modes:
//   plan   read and print the state and what apply would change. Writes nothing.
//   check  same, and exit 1 when anything is short of the target.
//   apply  write what is short, read it back, and exit 1 if the read-back is still short.
// Never prints a secret; the api key is scrubbed from any Stream error text.
import { createRequire } from 'node:module';

const requireFromWeb = createRequire(new URL('../packages/web/package.json', import.meta.url));
const { StreamChat } = requireFromWeb('stream-chat');
const { StreamClient } = requireFromWeb('@stream-io/node-sdk');

const MODES = ['plan', 'check', 'apply'];
const TARGETS = ['production', 'staging', 'both'];
const PAIRS = {
  production: { label: 'production', keyVar: 'STREAM_API_KEY', secretVar: 'STREAM_API_SECRET' },
  staging: { label: 'demo / staging', keyVar: 'STREAM_API_KEY_STAGING', secretVar: 'STREAM_API_SECRET_STAGING' },
};
const CONFIG_KEYS = ['se:posts', 'chat:messaging'];
const TEXT_SEVERITY_RULES = [
  { severity: 'critical', action: 'remove' },
  { severity: 'high', action: 'flag' },
];
const IMAGE_MIN_CONFIDENCE = 90;

function readTrimmed(name) {
  const raw = process.env[name];
  return typeof raw === 'string' ? raw.trim() : '';
}

function readOption(argv, name, allowed, fallback) {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  const value = arg ? arg.slice(name.length + 3) : fallback;
  if (!allowed.includes(value)) throw new Error(`--${name} must be one of ${allowed.join(', ')} (got "${value}").`);
  return value;
}

function describe(error) {
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/api_key=[^&\s"']+/g, 'api_key=[redacted]');
}

// The picture labels Stream offers on this app, read from Stream rather than written here.
async function imageLabels(client) {
  const res = await client.moderation.queryModerationRules({ limit: 1 });
  const labels = (res.ai_image_label_definitions ?? []).map((d) => d.key || d.label).filter(Boolean);
  return [...new Set(labels)];
}

function targetConfig(key, labels) {
  return {
    key,
    ai_text_config: { enabled: true, severity_rules: TEXT_SEVERITY_RULES },
    ai_image_config: {
      enabled: true,
      rules: labels.map((label) => ({ label, action: 'remove', min_confidence: IMAGE_MIN_CONFIDENCE })),
    },
  };
}

async function readConfig(client, key) {
  try {
    const res = await client.moderation.getConfig({ key });
    return res.config ?? null;
  } catch (error) {
    if (/404|not found/i.test(describe(error))) return null;
    throw error;
  }
}

function configShortfalls(config, labels) {
  const short = [];
  if (!config) return ['the config does not exist'];
  const text = config.ai_text_config ?? {};
  if (!text.enabled) short.push('AI text is off');
  for (const rule of TEXT_SEVERITY_RULES) {
    const found = (text.severity_rules ?? []).find((r) => r.severity === rule.severity);
    if (!found || found.action !== rule.action) short.push(`AI text: ${rule.severity} is not ${rule.action}`);
  }
  const image = config.ai_image_config ?? {};
  if (!image.enabled) short.push('AI pictures are off');
  const covered = new Set((image.rules ?? []).map((r) => r.label));
  const missing = labels.filter((label) => !covered.has(label));
  if (missing.length) short.push(`AI pictures: no rule for ${missing.join(', ')}`);
  return short;
}

async function readState(chat, client, labels) {
  const settings = await chat.getAppSettings();
  const state = { translation: Boolean(settings?.app?.auto_translation_enabled), configs: {} };
  for (const key of CONFIG_KEYS) state.configs[key] = configShortfalls(await readConfig(client, key), labels);
  return state;
}

function shortfalls(state) {
  const list = state.translation ? [] : ['chat auto-translation is off'];
  for (const [key, short] of Object.entries(state.configs)) for (const s of short) list.push(`${key}: ${s}`);
  return list;
}

async function runOne(pairName, mode) {
  const pair = PAIRS[pairName];
  const apiKey = readTrimmed(pair.keyVar);
  const secret = readTrimmed(pair.secretVar);
  if (!apiKey || !secret) {
    console.log(`\n${pair.label}: ${pair.keyVar} or ${pair.secretVar} is not set, so this app was not read.`);
    return false;
  }
  const chat = new StreamChat(apiKey, secret);
  const client = new StreamClient(apiKey, secret);
  const labels = await imageLabels(client);
  console.log(`\n${pair.label}: Stream offers ${labels.length} picture label(s): ${labels.join(', ') || 'none'}`);

  let short = shortfalls(await readState(chat, client, labels));
  console.log(short.length ? `Short of the target:\n  - ${short.join('\n  - ')}` : 'Already at the target.');
  if (mode !== 'apply' || short.length === 0) return short.length === 0 || mode === 'plan';

  await chat.updateAppSettings({ auto_translation_enabled: true });
  for (const key of CONFIG_KEYS) await client.moderation.upsertConfig(targetConfig(key, labels));
  short = shortfalls(await readState(chat, client, labels));
  console.log(short.length ? `Still short after apply:\n  - ${short.join('\n  - ')}` : 'Applied and read back: at the target.');
  return short.length === 0;
}

async function main() {
  const argv = process.argv.slice(2);
  const mode = readOption(argv, 'mode', MODES, 'plan');
  const target = readOption(argv, 'target', TARGETS, 'production');
  const names = target === 'both' ? ['production', 'staging'] : [target];
  let ok = true;
  for (const name of names) {
    try {
      ok = (await runOne(name, mode)) && ok;
    } catch (error) {
      console.log(`\n${PAIRS[name].label}: Stream refused or could not be reached: ${describe(error)}`);
      ok = false;
    }
  }
  process.exit(ok ? 0 : 1);
}

void main();
