import { firstNonEmpty } from './env-keys';

export type AuthProviderRuntimeConfig = {
  providerName: string;
  publishableKey?: string;
  secretKey?: string;
  signInUrl?: string;
  afterSignOutUrl?: string;
};

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('/')) return value;
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

export function getAppUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_APP_URL || undefined;
}

export function getConfiguredAuthProvider(): AuthProviderRuntimeConfig | null {
  const publishableKey = process.env.NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY || undefined;
  const secretKey = process.env.AUTH_SECRET_KEY || undefined;
  const signInUrl = normalizeUrl(process.env.NEXT_PUBLIC_AUTH_SIGN_IN_URL || undefined);
  const afterSignOutUrl = normalizeUrl(
    firstNonEmpty(process.env.NEXT_PUBLIC_AUTH_AFTER_SIGN_OUT_URL, signInUrl),
  );

  if (!publishableKey && !secretKey && !signInUrl && !afterSignOutUrl) {
    return null;
  }

  const providerName = firstNonEmpty(
    process.env.CTF_AUTH_PROVIDER,
    process.env.NEXT_PUBLIC_AUTH_PROVIDER,
  ) ?? 'clerk';

  return {
    providerName,
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
  const provider = getConfiguredAuthProvider();
  if (!provider) return {};
  return {
    ...(provider.publishableKey ? { publishableKey: provider.publishableKey } : {}),
    ...(provider.secretKey ? { secretKey: provider.secretKey } : {}),
  };
}

export function isConfiguredAuthSignInExternal(): boolean {
  const provider = getConfiguredAuthProvider();
  const signInUrl = provider?.signInUrl;
  if (!signInUrl || signInUrl.startsWith('/')) return false;

  try {
    const parsedSignIn = new URL(signInUrl);
    const appUrl = getAppUrl();
    if (!appUrl) return true;
    return parsedSignIn.hostname !== new URL(appUrl).hostname;
  } catch {
    return false;
  }
}
