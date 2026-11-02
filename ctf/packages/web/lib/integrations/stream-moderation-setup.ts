import { StreamClient } from '@stream-io/node-sdk';
import { StreamChat } from 'stream-chat';
import { STREAM_POSTS_CONFIG_KEY } from './stream-content-check';
import { streamCredentialsFor, type StreamAppName } from './stream-credentials';

// Stream AI moderation and chat auto-translation (3.1.0 plan, Personal controls and safety),
// applied with the app's own Stream keys. The stream-moderation-setup workflow calls
// POST /api/internal/stream/moderation-setup; the workflow itself holds no Stream key.
//
// Target state on each Stream app:
//   - chat auto-translation is on (`auto_translation_enabled`);
//   - the moderation configs se:posts (the app's own posts, checked through the moderation check
//     endpoint) and chat:messaging (Stream chat channels of type messaging, the one type the app
//     uses) carry the same rules: AI text removes what Stream rates critical and flags what it
//     rates high, by severity so no label name is guessed; AI pictures remove every label Stream
//     offers at 90% confidence and above.
// Stream lists its picture labels only through its moderation rules feature, which Stream switches
// on per app. Where it is off, the text rules and auto-translation are still applied, the picture
// rules are left as they are, and the report says why, so the run is short rather than stopped.

export type StreamSetupMode = 'plan' | 'check' | 'apply';
export type StreamSetupTarget = StreamAppName | 'both';

export type StreamAppSetupReport = {
  app: StreamAppName;
  configured: boolean;
  imageLabels: string[];
  shortBefore: string[];
  shortAfter: string[] | null;
  error: string | null;
};

const CONFIG_KEYS = [STREAM_POSTS_CONFIG_KEY, 'chat:messaging'];
const TEXT_SEVERITY_RULES = [
  { severity: 'critical', action: 'remove' },
  { severity: 'high', action: 'flag' },
] as const;
const IMAGE_MIN_CONFIDENCE = 90;

type Clients = { chat: StreamChat; client: StreamClient };
type ConfigShape = {
  ai_text_config?: { enabled?: boolean; severity_rules?: { severity: string; action: string }[] };
  ai_image_config?: { enabled?: boolean; rules?: { label: string }[] };
};

const RULES_FEATURE_OFF = /feature flag|ModerationRuleV2Query/i;

export const STREAM_PICTURE_LABELS_UNAVAILABLE =
  'AI pictures: not set, because Stream has not switched on its moderation rules feature for this app, which is where it lists the picture labels. Ask Stream support to enable it, then run apply again.';

// Stream's picture labels, or null when its moderation rules feature is off for this app.
async function imageLabels({ client }: Clients): Promise<string[] | null> {
  try {
    const res = await client.moderation.queryModerationRules({ limit: 1 });
    const labels = (res.ai_image_label_definitions ?? []).map((d) => d.key || d.label).filter(Boolean);
    return [...new Set(labels)];
  } catch (error) {
    if (RULES_FEATURE_OFF.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}

async function readConfig({ client }: Clients, key: string): Promise<ConfigShape | null> {
  try {
    const res = await client.moderation.getConfig({ key });
    return (res.config as ConfigShape | undefined) ?? null;
  } catch (error) {
    if (/404|not found/i.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}

function textShortfalls(config: ConfigShape): string[] {
  const text = config.ai_text_config ?? {};
  const short = text.enabled ? [] : ['AI text is off'];
  for (const rule of TEXT_SEVERITY_RULES) {
    const found = (text.severity_rules ?? []).find((r) => r.severity === rule.severity);
    if (found?.action !== rule.action) short.push(`AI text: ${rule.severity} is not ${rule.action}`);
  }
  return short;
}

function imageShortfalls(config: ConfigShape, labels: string[]): string[] {
  const image = config.ai_image_config ?? {};
  const short = image.enabled ? [] : ['AI pictures are off'];
  const covered = new Set((image.rules ?? []).map((r) => r.label));
  const missing = labels.filter((label) => !covered.has(label));
  if (missing.length) short.push(`AI pictures: no rule for ${missing.join(', ')}`);
  return short;
}

async function shortfalls(clients: Clients, labels: string[] | null): Promise<string[]> {
  const settings = await clients.chat.getAppSettings();
  const list = settings?.app?.auto_translation_enabled ? [] : ['chat auto-translation is off'];
  for (const key of CONFIG_KEYS) {
    const config = await readConfig(clients, key);
    const short = config ? [...textShortfalls(config), ...(labels ? imageShortfalls(config, labels) : [])] : ['the config does not exist'];
    for (const s of short) list.push(`${key}: ${s}`);
  }
  if (!labels) list.push(STREAM_PICTURE_LABELS_UNAVAILABLE);
  return list;
}

// Without Stream's label list the picture rules are left untouched rather than written empty.
async function apply(clients: Clients, labels: string[] | null): Promise<void> {
  await clients.chat.updateAppSettings({ auto_translation_enabled: true });
  for (const key of CONFIG_KEYS) {
    await clients.client.moderation.upsertConfig({
      key,
      ai_text_config: { enabled: true, severity_rules: [...TEXT_SEVERITY_RULES] },
      ...(labels
        ? {
            ai_image_config: {
              enabled: true,
              rules: labels.map((label) => ({ label, action: 'remove' as const, min_confidence: IMAGE_MIN_CONFIDENCE })),
            },
          }
        : {}),
    });
  }
}

async function runOne(app: StreamAppName, mode: StreamSetupMode): Promise<StreamAppSetupReport> {
  const report: StreamAppSetupReport = { app, configured: false, imageLabels: [], shortBefore: [], shortAfter: null, error: null };
  const credentials = streamCredentialsFor(app);
  if (!credentials) return report;
  report.configured = true;
  try {
    const clients = {
      chat: new StreamChat(credentials.apiKey, credentials.apiSecret),
      client: new StreamClient(credentials.apiKey, credentials.apiSecret),
    };
    const labels = await imageLabels(clients);
    report.imageLabels = labels ?? [];
    report.shortBefore = await shortfalls(clients, labels);
    if (mode === 'apply' && report.shortBefore.length > 0) {
      await apply(clients, labels);
      report.shortAfter = await shortfalls(clients, labels);
    }
  } catch (error) {
    report.error = (error instanceof Error ? error.message : String(error)).replace(/api_key=[^&\s"']+/g, 'api_key=[redacted]');
  }
  return report;
}

// True when the run left nothing short: plan always passes; check passes only at the target; apply
// passes when the read-back after writing is at the target. An app without keys is not a failure.
export function setupPassed(mode: StreamSetupMode, reports: StreamAppSetupReport[]): boolean {
  return reports.every((r) => {
    if (!r.configured) return true;
    if (r.error) return false;
    if (mode === 'plan') return true;
    return (r.shortAfter ?? r.shortBefore).length === 0;
  });
}

export async function runStreamModerationSetup(mode: StreamSetupMode, target: StreamSetupTarget): Promise<StreamAppSetupReport[]> {
  const apps: StreamAppName[] = target === 'both' ? ['production', 'staging'] : [target];
  const reports: StreamAppSetupReport[] = [];
  for (const app of apps) reports.push(await runOne(app, mode));
  return reports;
}
