export type FlagKey = string;
export declare const SYSTEM_FLAGS: {
    readonly DEMO_MODE: "demo-mode";
    readonly PUBLIC_SURFACE: "public-surface";
};
export type SystemFlagKey = (typeof SYSTEM_FLAGS)[keyof typeof SYSTEM_FLAGS];
export declare function featureFlagKey(pluginSlug: string, featureName: string): FlagKey;
export declare function releaseFlagKey(agent: string, fixName: string): FlagKey;
export declare const UNLOCK_FLAGS: {
    readonly QUORA_ONBOARDING: "feature-unlock-quora-onboarding";
};
export type UnlockFlagKey = (typeof UNLOCK_FLAGS)[keyof typeof UNLOCK_FLAGS];
export interface FeatureFlagContext {
    targetingKey?: string;
    attributes?: Record<string, string | number | boolean>;
}
