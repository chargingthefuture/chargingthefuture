import { OpenFeature, type Client, type EvaluationContext } from '@openfeature/server-sdk';
import { initialize, UnleashEvents } from 'unleash-client';
import { type FeatureFlagContext, type FlagKey } from '@ctf/shared';
import { UnleashOpenFeatureProvider } from './unleash-provider';

// Connection details are injected by Infisical → Render Sync. Absent locally/in CI,
// in which case OpenFeature's default provider returns the caller-supplied default for
// every flag (flags safely OFF). This is the SDK's defined unconfigured behavior.
function getUnleashUrl(): string | undefined {
	return process.env.UNLEASH_API_URL;
}

function getUnleashToken(): string | undefined {
	return process.env.UNLEASH_API_TOKEN_BACKEND;
}

export function isFeatureFlagBackendConfigured(): boolean {
	return Boolean(getUnleashUrl() && getUnleashToken());
}

let initPromise: Promise<void> | null = null;

async function registerUnleashProvider(): Promise<void> {
	const url = getUnleashUrl();
	const token = getUnleashToken();
	if (!url || !token) {
		return;
	}
	// initialize() is non-blocking: it returns immediately and polls in the background.
	// isEnabled/getVariant return the supplied default until the first toggle fetch lands,
	// so app startup never blocks on Unleash availability.
	const unleash = initialize({
		url,
		appName: process.env.UNLEASH_APP_NAME ?? 'ctf-web',
		customHeaders: { Authorization: token },
		...(process.env.UNLEASH_ENVIRONMENT ? { environment: process.env.UNLEASH_ENVIRONMENT } : {}),
	});
	unleash.on(UnleashEvents.Error, (error: unknown) => {
		console.error('[feature-flags] Unleash client error', error);
	});
	await OpenFeature.setProviderAndWait(new UnleashOpenFeatureProvider(unleash));
}

// Idempotent: the first caller registers the provider; later callers reuse the same promise.
function ensureProvider(): Promise<void> {
	if (!initPromise) {
		initPromise = registerUnleashProvider().catch((error) => {
			console.error('[feature-flags] failed to initialize Unleash provider; using defaults', error);
			// Clear the cached promise so a later call can retry initialization.
			initPromise = null;
		});
	}
	return initPromise;
}

function toEvaluationContext(context?: FeatureFlagContext): EvaluationContext {
	const evaluationContext: EvaluationContext = {};
	if (!context) {
		return evaluationContext;
	}
	if (context.targetingKey) {
		evaluationContext.targetingKey = context.targetingKey;
	}
	if (context.attributes) {
		for (const [key, value] of Object.entries(context.attributes)) {
			evaluationContext[key] = value;
		}
	}
	return evaluationContext;
}

async function getClient(): Promise<Client> {
	await ensureProvider();
	return OpenFeature.getClient();
}

export async function evaluateBooleanFlag(
	flagKey: FlagKey,
	defaultValue: boolean,
	context?: FeatureFlagContext,
): Promise<boolean> {
	const client = await getClient();
	return client.getBooleanValue(flagKey, defaultValue, toEvaluationContext(context));
}

export async function evaluateStringFlag(
	flagKey: FlagKey,
	defaultValue: string,
	context?: FeatureFlagContext,
): Promise<string> {
	const client = await getClient();
	return client.getStringValue(flagKey, defaultValue, toEvaluationContext(context));
}

export async function evaluateNumberFlag(
	flagKey: FlagKey,
	defaultValue: number,
	context?: FeatureFlagContext,
): Promise<number> {
	const client = await getClient();
	return client.getNumberValue(flagKey, defaultValue, toEvaluationContext(context));
}
