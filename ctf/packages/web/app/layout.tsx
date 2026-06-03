import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { AuthProvider } from '@/hooks/useAuth';
import {
  getClerkRuntimeOptions,
  getHostedSignInUrl,
  getHostedSignUpUrl,
  getHostedAfterSignOutUrl,
  getAppUrl,
} from '@/lib/auth/clerk-env';
import './globals.css';

export const metadata: Metadata = {
  title: 'CTF Survivor Hub',
  description: 'Dark theme plugin-first community shell for survivor-centered support.',
};

// Explicit phone viewport so the page lays out at device width (not a ~980px
// desktop fallback), which the mobile breakpoint depends on.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkOptions = getClerkRuntimeOptions();

  // Point Clerk at its hosted Account Portal (accounts.<domain>) for sign-in and
  // sign-up rather than a page rendered on this app's own domain. After a
  // completed flow, Clerk returns the user to the app (signInFallbackRedirectUrl).
  const signInUrl = getHostedSignInUrl();
  const signUpUrl = getHostedSignUpUrl();
  const afterSignOutUrl = getHostedAfterSignOutUrl();
  const appHomeUrl = getAppUrl();

  return (
    <html lang="en">
      <body>
        <ClerkProvider
          {...clerkOptions}
          {...(signInUrl ? { signInUrl } : {})}
          {...(signUpUrl ? { signUpUrl } : {})}
          {...(appHomeUrl
            ? { signInFallbackRedirectUrl: appHomeUrl, signUpFallbackRedirectUrl: appHomeUrl }
            : {})}
          {...(afterSignOutUrl ? { afterSignOutUrl } : {})}
        >
          <AuthProvider>{children}</AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
