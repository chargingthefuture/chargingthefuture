import {
	type Provider,
	type ResolutionDetails,
	type EvaluationContext,
	type JsonValue,
	StandardResolutionReasons,
} from '@openfeature/server-sdk';
import { type Unleash, type Context as UnleashContext, type Variant } from 'unleash-client';

// Maps the OpenFeature evaluation context onto Unleash's native context.
// targetingKey drives per-user targeting and sticky percentage rollout (Unleash userId).
function toUnleashContext(context: EvaluationContext): UnleashContext {
	const properties: Record<string, string | number> = {};
	for (const [key, value] of Object.entries(context)) {
		if (key === 'targetingKey') {
			continue;
		}
		if (typeof value === 'string' || typeof value === 'number') {
			properties[key] = value;
		} else if (typeof value === 'boolean') {
			properties[key] = String(value);
		}
	}
	return {
		userId: typeof context.targetingKey === 'string' ? context.targetingKey : undefined,
		properties,
	};
}

// Reads a typed value out of an Unleash variant payload, falling back to the caller default
// when the variant is disabled or its payload cannot be coerced to the requested type.
function variantValue<T>(variant: Variant, defaultValue: T, coerce: (raw: string) => T | undefined): ResolutionDetails<T> {
	if (!variant.enabled || !variant.payload) {
		return { value: defaultValue, reason: StandardResolutionReasons.DEFAULT };
	}
	const coerced = coerce(variant.payload.value);
	if (coerced === undefined) {
		return { value: defaultValue, reason: StandardResolutionReasons.DEFAULT };
	}
	return { value: coerced, reason: StandardResolutionReasons.TARGETING_MATCH, variant: variant.name };
}

// OpenFeature provider backed by the official Unleash Node SDK. The Unleash instance is
// created and synchronized by the caller (see server.ts) and injected here.
export class UnleashOpenFeatureProvider implements Provider {
	readonly metadata = { name: 'unleash-provider' } as const;
	readonly runsOn = 'server' as const;

	private readonly unleash: Unleash;

	constructor(unleash: Unleash) {
		this.unleash = unleash;
	}

	resolveBooleanEvaluation(
		flagKey: string,
		defaultValue: boolean,
		context: EvaluationContext,
	): Promise<ResolutionDetails<boolean>> {
		const value = this.unleash.isEnabled(flagKey, toUnleashContext(context), defaultValue);
		return Promise.resolve({ value, reason: StandardResolutionReasons.TARGETING_MATCH });
	}

	resolveStringEvaluation(
		flagKey: string,
		defaultValue: string,
		context: EvaluationContext,
	): Promise<ResolutionDetails<string>> {
		const variant = this.unleash.getVariant(flagKey, toUnleashContext(context));
		return Promise.resolve(variantValue(variant, defaultValue, (raw) => raw));
	}

	resolveNumberEvaluation(
		flagKey: string,
		defaultValue: number,
		context: EvaluationContext,
	): Promise<ResolutionDetails<number>> {
		const variant = this.unleash.getVariant(flagKey, toUnleashContext(context));
		return Promise.resolve(
			variantValue(variant, defaultValue, (raw) => {
				const parsed = Number(raw);
				return Number.isFinite(parsed) ? parsed : undefined;
			}),
		);
	}

	resolveObjectEvaluation<T extends JsonValue>(
		flagKey: string,
		defaultValue: T,
		context: EvaluationContext,
	): Promise<ResolutionDetails<T>> {
		const variant = this.unleash.getVariant(flagKey, toUnleashContext(context));
		return Promise.resolve(
			variantValue(variant, defaultValue, (raw) => {
				try {
					return JSON.parse(raw) as T;
				} catch {
					return undefined;
				}
			}),
		);
	}
}
