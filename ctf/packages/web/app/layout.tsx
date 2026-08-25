import type { Metadata, Viewport } from 'next';
// Self-host the brand typeface. globals.css declares `font-family: Inter` everywhere but the app never
// shipped the font, so it silently fell back to system-ui. @fontsource bundles the weights we use and
// registers the family as "Inter", so the existing declarations now render the real Inter offline.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import { ClerkProvider } from '@clerk/nextjs';
import { AuthProvider } from '@/hooks/useAuth';
import { NavHistoryTracker } from '@/lib/nav/back-history';
import { PwaServiceWorker } from '@/components/shared/pwa-service-worker';
import { ThemeProvider } from '@/hooks/useTheme';
import {
  getClerkRuntimeOptions,
  getHostedSignInUrl,
  getHostedSignUpUrl,
  getHostedAfterSignOutUrl,
  getAppUrl,
} from '@/lib/auth/clerk-env';
import { SENTRY_DSN_GLOBAL } from '@/lib/observability/sentry-config';
import './globals.css';

// No sharing-preview metadata (owner decision, 2026-08-25). We used to publish og:title and a
// twitter:card carrying the site title, so a pasted link on other sites was rewritten to show that
// phrase instead of the address. On Quora that turned a post listing several app links into the
// same sentence repeated once per link, and the reader could no longer tell where any of them went.
// The addresses are short and self-explaining on their own (/guide, /apps/socketrelay), so a plain
// URL reads better than a masked one. SITE_TITLE stays the browser tab title only — do not add
// openGraph or twitter blocks back without the owner asking for them.
const SITE_TITLE = 'Skills Economy (SE); Exit their economy, exit the psyop.';
const SITE_DESCRIPTION = 'A skills-based community economy for survivors — mutual support, real participation, no outside systems needed.';

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: 'Skills Economy',
  // Installable PWA (owner decision, 2026-07-20): the manifest + service worker make the web app
  // installable to the home screen on Android and iOS, so the mobile-responsive web app covers the
  // whole product on phones. appleWebApp enables the standalone (no browser chrome) mode on iOS.
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'SE',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

// Explicit phone viewport so the page lays out at device width (not a ~980px
// desktop fallback), which the mobile breakpoint depends on.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F1117',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkOptions = getClerkRuntimeOptions();

  // Point Clerk at its hosted Account Portal (accounts.<domain>) for sign-in and
  // sign-up rather than a page rendered on this app's own domain. After a completed
  // flow, force the return to the app home (the chat) regardless of which page started
  // sign-in — a *force* redirect (not fallback) so signing in from a deep page like
  // /apps still lands on the calmer chat home, which then routes by unlock tier.
  const signInUrl = getHostedSignInUrl();
  const signUpUrl = getHostedSignUpUrl();
  const afterSignOutUrl = getHostedAfterSignOutUrl();
  const appHomeUrl = getAppUrl();

  return (
    <html lang="en">
      <body>
        {/*
          Hands the browser the Sentry DSN the server already holds (SENTRY_DSN in Infisical). Next.js
          inlines only NEXT_PUBLIC_* names into client bundles, so without this the browser had no DSN
          and crash reporting never started there. Rendering it here keeps one secret key instead of a
          NEXT_PUBLIC_ duplicate, and keeps it a runtime value — rotating the secret takes effect on
          restart, with no image rebuild. A DSN only permits sending events to the project, so it is
          meant to travel to the client. JSON.stringify keeps the value a string literal.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window[${JSON.stringify(SENTRY_DSN_GLOBAL)}]=${JSON.stringify(process.env.SENTRY_DSN ?? '')};`,
          }}
        />
        {/*
          No-flash theme script: runs before paint, reads the saved theme from
          localStorage, and sets data-theme="comic" on <html> so a returning comic-theme
          user never sees a flash of the default theme. Default theme = no attribute.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('sh-theme')==='comic'){document.documentElement.setAttribute('data-theme','comic');}}catch(e){}})();",
          }}
        />
        <ClerkProvider
          {...clerkOptions}
          {...(signInUrl ? { signInUrl } : {})}
          {...(signUpUrl ? { signUpUrl } : {})}
          {...(appHomeUrl
            ? { signInForceRedirectUrl: appHomeUrl, signUpForceRedirectUrl: appHomeUrl }
            : {})}
          {...(afterSignOutUrl ? { afterSignOutUrl } : {})}
        >
          <AuthProvider>
            <ThemeProvider>
              <PwaServiceWorker />
              <NavHistoryTracker />
              {/*
                Mobile-first shell: every route renders inside the phone frame.
                Invisible at phone width; a centered phone-proportioned column
                on wide screens (see .ctf-phone-frame in globals.css).
              */}
              <div className="ctf-phone-frame">{children}</div>
            </ThemeProvider>
          </AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
