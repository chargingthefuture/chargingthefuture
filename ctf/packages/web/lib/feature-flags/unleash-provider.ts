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
	// Unleash's Properties type accepts string | number; booleans are stringified so
	// strategy constraints can still match them ("true"/"false").
	const properties: Record<string, string | number> = {};
	for (const [key, value] of Object.entries(context)) {
		if (key === 'targetingKey') {
			continue;
		}
		if (typeof value === 'string' || typeof value === 'number') {
			properties[key] = value;
		} else if (typeof value === 'boolean') {
			properties[key] = String(value);
		} else if (value !== undefined && value !== null) {
			// Objects and arrays cannot be represented in Unleash context properties;
			// warn instead of dropping them silently so a mis-shaped attribute is visible.
			console.warn(`[feature-flags] dropping non-primitive context attribute "${key}" from Unleash context`);
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
		// isEnabled returns the caller-supplied default when the client has not synchronized
		// yet or the flag is unknown; report DEFAULT then so observability metadata is honest.
		const evaluated =
			this.unleash.isSynchronized() && this.unleash.getFeatureToggleDefinition(flagKey) !== undefined;
		return Promise.resolve({
			value,
			reason: evaluated ? StandardResolutionReasons.TARGETING_MATCH : StandardResolutionReasons.DEFAULT,
		});
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
