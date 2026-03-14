import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import {
  getClerkPublishableKey,
  getClerkSignInUrl,
} from '@/src/lib/auth/clerk-env';
import './globals.css';

export const metadata: Metadata = {
  title: 'CTF Survivor Hub | From Survivor to Thriver',
  description: 'A trauma-informed, invite-only community platform for human trafficking survivors. Access support, resources, and opportunities designed for your journey forward.',
  keywords: ['survivor support', 'community', 'healing', 'resources', 'safe space'],
};

export const viewport: Viewport = {
  themeColor: '#c5f82a',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publishableKey = getClerkPublishableKey();
  const signInUrl = getClerkSignInUrl();
  const clerkProviderProps = {
    ...(publishableKey ? { publishableKey } : {}),
    ...(signInUrl ? { signInUrl } : {}),
  };

  return (
    <html lang="en">
      <body>
        <ClerkProvider {...clerkProviderProps}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
