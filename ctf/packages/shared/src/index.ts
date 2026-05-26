export * from './auth/genericPluginAuth';
export * from './feature-flags';
export * from './mood';
// Do NOT export mood/hooks or mood/index.web here; import them directly in client components only.
export type HealthStatus = 'ok';

export const healthStatus: HealthStatus = 'ok';
