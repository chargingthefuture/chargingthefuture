import {
  getConfiguredAuthProvider,
  getAuthRuntimeOptions,
  isConfiguredAuthSignInExternal,
} from './provider-env';

export {
  getAppUrl,
  getHostedSignInUrl,
  getHostedSignUpUrl,
  getHostedAfterSignOutUrl,
  getAccountPortalOrigin,
} from './provider-env';

export function getClerkPublishableKey(): string | undefined {
  return getConfiguredAuthProvider()?.publishableKey;
}

export function getClerkSecretKey(): string | undefined {
  return getConfiguredAuthProvider()?.secretKey;
}

export function getClerkSignInUrl(): string | undefined {
  return getConfiguredAuthProvider()?.signInUrl;
}

export function getClerkAfterSignOutUrl(): string | undefined {
  return getConfiguredAuthProvider()?.afterSignOutUrl;
}

export function isSignInUrlExternal(): boolean {
  return isConfiguredAuthSignInExternal();
}

export function getClerkRuntimeOptions(): {
  publishableKey?: string;
  secretKey?: string;
} {
  return getAuthRuntimeOptions();
}
