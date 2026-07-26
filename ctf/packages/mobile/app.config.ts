import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Mobile runtime config.
 *
 * The mobile app reads the SAME environment names as the web app so there is one
 * source of truth and one production environment (see
 * docs/mobile/EXPO_CLOUD_WORKFLOW.md):
 *   - NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY  Clerk publishable key (sign-in)
 *   - APP_URL                           API base URL (the deployed web host)
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
    version: '0.1.1',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      // Brand dark (matches the Skills Economy logo backdrop) so the splash is seamless with the
      // centered mark instead of a white letterbox around it.
      backgroundColor: '#0F0E17',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.chargingthefuture.app',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        // Brand dark launcher backdrop for the Skills Economy mark (was a white stopgap).
        backgroundColor: '#0F0E17',
      },
      package: 'com.chargingthefuture.app',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    // Native build config for the Chyme live audio room (Stream Video).
    // Stream's React Native Video SDK needs native code (WebRTC), so it only
    // runs in an EAS dev/production build — NOT in Expo Go. These config
    // plugins write the required native permissions and build settings during
    // `expo prebuild` / EAS build:
    //   - @stream-io/video-react-native-sdk: Android Bluetooth/wake-lock
    //     permissions, iOS background audio mode, and the WebRTC build settings.
    //     `androidKeepCallAlive: true` additionally turns on the Android
    //     foreground service the SDK runs (via @notifee/react-native) so a Chyme
    //     audio call keeps playing and the member stays connected when the app is
    //     backgrounded — the owner's hard requirement that navigating away without
    //     closing must not drop you from the room (2026-07-20). At prebuild it
    //     writes the foreground-service permissions (FOREGROUND_SERVICE,
    //     FOREGROUND_SERVICE_MICROPHONE, FOREGROUND_SERVICE_MEDIA_PLAYBACK,
    //     POST_NOTIFICATIONS) and the service declaration. iOS background audio is
    //     unchanged (already handled by this plugin's iOS background mode above).
    //     The one-time runtime setup for the service lives in App.tsx
    //     (StreamVideoRN.updateConfig).
    //   - @config-plugins/react-native-webrtc: the microphone/camera permission
    //     text shown to the user (iOS Info.plist usage strings + Android
    //     RECORD_AUDIO). Chyme is audio-only, but the camera string is required
    //     by the WebRTC layer even when video is never published.
    //   - expo-notifications: the Foundation instant-call ring native push
    //     (issue #884). expo-notifications needs native code (it cannot run in
    //     Expo Go), so this config plugin must be present in the EAS build for a
    //     device to be woken by an incoming call. Registering the plugin sets up
    //     the Android notification channel/icon defaults; no per-user identity is
    //     baked in — the device's Expo push token is fetched at runtime when the
    //     member turns on "Call alerts on this device".
    plugins: [
      ...(config.plugins ?? []),
      ['@stream-io/video-react-native-sdk', { androidKeepCallAlive: true }],
      [
        '@config-plugins/react-native-webrtc',
        {
          microphonePermission:
            'Charging the Future needs microphone access so you can speak in a live Chyme audio room.',
          cameraPermission:
            'Charging the Future does not record video; this permission is required by the audio engine and is never used to capture video.',
        },
      ],
      'expo-notifications',
    ],
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
      appUrl: process.env.APP_URL,
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
