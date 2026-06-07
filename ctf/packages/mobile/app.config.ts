import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Mobile runtime config.
 *
 * The mobile app reads the SAME environment names as the web app so there is one
 * source of truth and one production environment (see
 * docs/mobile/EXPO_CLOUD_WORKFLOW.md):
 *   - NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY  Clerk publishable key (sign-in)
 *   - NEXT_PUBLIC_APP_URL               API base URL (the deployed web host)
 *   - NEXT_PUBLIC_AUTH_PROVIDER         auth provider name (defaults to 'clerk')
 *   - NEXT_PUBLIC_AUTH_SIGN_IN_URL      optional hosted sign-in URL
 *   - EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID Clerk OAuth application client id (native sign-in)
 *   - EXPO_MOBILE_PROJECT_ID            EAS project id
 *   - EXPO_MOBILE_UPDATES_URL           EAS updates URL
 *
 * There is NO baked per-user identity. The signed-in user is resolved at runtime
 * by an OAuth 2.0 authorization-code flow with PKCE against Clerk (acting as an
 * OpenID Connect provider). The flow yields a Clerk-signed OpenID Connect
 * id_token; every API call carries it as an `Authorization: Bearer` token that
 * the backend verifies with @clerk/backend's verifyToken. No @clerk/clerk-expo /
 * @clerk/clerk-js is bundled. See src/auth/auth-context.tsx,
 * src/auth/clerkOAuth.ts, and src/auth/authedFetch.ts.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_MOBILE_PROJECT_ID;
  const updatesUrl = process.env.EXPO_MOBILE_UPDATES_URL;

  return {
    ...config,
    name: 'ChargingTheFuture',
    slug: 'charging-the-future',
    // App URL scheme for the OAuth sign-in redirect back into the app
    // (ctf://oauth-callback). Must match the redirect URI registered on the
    // Clerk OAuth application.
    scheme: 'ctf',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.chargingthefuture.app',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.chargingthefuture.app',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    updates: {
      ...(updatesUrl ? { url: updatesUrl } : {}),
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    extra: {
      ...(config.extra ?? {}),
      authProvider: process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'clerk',
      authPublishableKey: process.env.NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      signInUrl: process.env.NEXT_PUBLIC_AUTH_SIGN_IN_URL,
      oauthClientId: process.env.EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID,
      updatesUrl,
      mobileObservabilityProvider: process.env.MOBILE_OBSERVABILITY_PROVIDER || 'noop',
      mobileSentryDsn: process.env.EXPO_SENTRY_DSN,
      eas: {
        ...(config.extra?.eas ?? {}),
        ...(projectId ? { projectId } : {}),
      },
    },
  };
};
