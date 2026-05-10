import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { AuthProvider } from '@/hooks/useAuth';
import { getClerkRuntimeOptions } from '@/lib/auth/clerk-env';
import './globals.css';

export const metadata: Metadata = {
  title: 'CTF Survivor Hub',
  description: 'Dark theme plugin-first community shell for survivor-centered support.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkOptions = getClerkRuntimeOptions();
  return (
    <html lang="en">
      <body>
        <ClerkProvider {...clerkOptions}>
          <AuthProvider>{children}</AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
