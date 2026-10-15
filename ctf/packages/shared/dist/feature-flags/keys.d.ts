export type FlagKey = string;
export declare const SYSTEM_FLAGS: {
    readonly DEMO_MODE: "demo-mode";
    readonly PUBLIC_SURFACE: "public-surface";
};
export declare const UNLOCK_FLAGS: {
    readonly QUORA_ONBOARDING: "feature-unlock-quora-onboarding";
};
export interface FeatureFlagContext {
    targetingKey?: string;
    attributes?: Record<string, string | number | boolean>;
}
