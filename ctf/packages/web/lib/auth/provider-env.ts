import {
  AUTH_AFTER_SIGN_OUT_URL_KEYS,
  AUTH_PUBLISHABLE_KEY_KEYS,
  AUTH_SECRET_KEY_KEYS,
  AUTH_SIGN_IN_URL_KEYS,
  LEGACY_CLERK_DETECTION_KEYS,
  firstNonEmpty,
  hasAnyConfiguredValue,
  readEnvValue,
} from './env-keys';

export type AuthProviderRuntimeConfig = {
  providerName: string;
  publishableKey?: string;
  secretKey?: string;
  signInUrl?: string;
  afterSignOutUrl?: string;
};

function parseUrl(value: string | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.startsWith('/')) {
    return value;
  }

  const parsed = parseUrl(value);
  return parsed ? parsed.toString() : undefined;
}

function getAuthPublishableKey(): string | undefined {
  return readEnvValue(AUTH_PUBLISHABLE_KEY_KEYS);
}

function getAuthSecretKey(): string | undefined {
  return readEnvValue(AUTH_SECRET_KEY_KEYS);
}

function getAuthSignInUrl(): string | undefined {
  return normalizeUrl(readEnvValue(AUTH_SIGN_IN_URL_KEYS));
}

function getAuthAfterSignOutUrl(): string | undefined {
  return normalizeUrl(firstNonEmpty(readEnvValue(AUTH_AFTER_SIGN_OUT_URL_KEYS), getAuthSignInUrl()));
}

function detectProviderName(hasLegacyClerkValues: boolean): string {
  const explicitProviderName = firstNonEmpty(
    process.env.CTF_AUTH_PROVIDER,
    process.env.NEXT_PUBLIC_AUTH_PROVIDER,
  );

  if (explicitProviderName) {
    return explicitProviderName;
  }

  return hasLegacyClerkValues ? 'clerk' : 'auth-provider';
}

export function getAppUrl(): string | undefined {
  return firstNonEmpty(
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RAILWAY_NEXT_PUBLIC_APP_URL,
  );
}

export function getConfiguredAuthProvider(): AuthProviderRuntimeConfig | null {
  const publishableKey = getAuthPublishableKey();
  const secretKey = getAuthSecretKey();
  const signInUrl = getAuthSignInUrl();
  const afterSignOutUrl = getAuthAfterSignOutUrl();

  if (!publishableKey && !secretKey && !signInUrl && !afterSignOutUrl) {
    return null;
  }

  const hasLegacyClerkValues = hasAnyConfiguredValue(LEGACY_CLERK_DETECTION_KEYS);

  return {
    providerName: detectProviderName(hasLegacyClerkValues),
    ...(publishableKey ? { publishableKey } : {}),
    ...(secretKey ? { secretKey } : {}),
    ...(signInUrl ? { signInUrl } : {}),
    ...(afterSignOutUrl ? { afterSignOutUrl } : {}),
  };
}

export function getAuthRuntimeOptions(): {
  publishableKey?: string;
  secretKey?: string;
} {
  const configuredProvider = getConfiguredAuthProvider();
  if (!configuredProvider) {
    return {};
  }

  return {
    ...(configuredProvider.publishableKey ? { publishableKey: configuredProvider.publishableKey } : {}),
    ...(configuredProvider.secretKey ? { secretKey: configuredProvider.secretKey } : {}),
  };
}

export function isConfiguredAuthSignInExternal(): boolean {
  const provider = getConfiguredAuthProvider();
  const signInUrl = provider?.signInUrl;
  if (!signInUrl) {
    return false;
  }

  if (signInUrl.startsWith('/')) {
    return false;
  }

  const parsedSignIn = parseUrl(signInUrl);
  if (!parsedSignIn) {
    return false;
  }

  const appUrl = getAppUrl();
  const parsedApp = parseUrl(appUrl);
  if (!parsedApp) {
    return true;
  }

  return parsedSignIn.hostname !== parsedApp.hostname;
}
