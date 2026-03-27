import { ClerkProvider } from "@clerk/clerk-react";
import { ReactNode } from "react";
import { useLocation } from "wouter";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Get the base URL for redirects
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.VITE_APP_URL || 'https://app.chargingthefuture.com';
};

export function AppClerkProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  
  // Only render ClerkProvider if key is available
  // If not available, show error message instead of crashing
  if (!clerkPublishableKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">Configuration Error</h1>
          <p className="text-muted-foreground">
            Missing VITE_CLERK_PUBLISHABLE_KEY environment variable.
          </p>
          <p className="text-sm text-muted-foreground">
            Please set VITE_CLERK_PUBLISHABLE_KEY in your .env.local file.
          </p>
        </div>
      </div>
    );
  }

  const baseUrl = getBaseUrl();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  // Determine environment based on domain
  const isProduction = hostname.includes('app.chargingthefuture.com');
  const isStaging = hostname.includes('the-comic.com') || hostname.includes('staging');
  const isDevelopment = !isProduction && !isStaging;

  // Use appropriate URLs based on environment
  // For staging with live keys, use custom domain if configured, otherwise use Clerk's default
  // For production, use custom domain
  // For development, use Clerk dev instance
  let signInUrl: string;
  let signUpUrl: string;
  let unauthorizedSignInUrl: string;

  if (isProduction) {
    signInUrl = "https://accounts.app.chargingthefuture.com/sign-in";
    signUpUrl = "https://accounts.app.chargingthefuture.com/sign-up";
    unauthorizedSignInUrl = "https://accounts.app.chargingthefuture.com/unauthorized-sign-in";
  } else if (isStaging) {
    // For staging, check if custom domain is configured
    // Default to accounts.the-comic.com for the-comic.com domain
    const stagingCustomDomain = import.meta.env.VITE_CLERK_STAGING_DOMAIN || 
      (hostname.includes('the-comic.com') ? 'accounts.the-comic.com' : null);
    if (stagingCustomDomain) {
      // Custom domain configured (e.g., accounts.the-comic.com)
      signInUrl = `https://${stagingCustomDomain}/sign-in`;
      signUpUrl = `https://${stagingCustomDomain}/sign-up`;
      unauthorizedSignInUrl = `https://${stagingCustomDomain}/unauthorized-sign-in`;
    } else {
      // Use a stable external accounts domain for staging/local fallback
      const fallbackStagingAccounts = 'accounts.the-comic.com';
      signInUrl = `https://${fallbackStagingAccounts}/sign-in`;
      signUpUrl = `https://${fallbackStagingAccounts}/sign-up`;
      unauthorizedSignInUrl = `https://${fallbackStagingAccounts}/unauthorized-sign-in`;
    }
  } else {
    // Development - use dev instance
    signInUrl = "https://sure-oarfish-90.accounts.dev/sign-in";
    signUpUrl = "https://sure-oarfish-90.accounts.dev/sign-up";
    unauthorizedSignInUrl = "https://sure-oarfish-90.accounts.dev/unauthorized-sign-in";
  }

  return (
    <ClerkProvider 
      publishableKey={clerkPublishableKey}
      // Use Clerk's hosted Account Portal (dev or prod based on environment)
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      // Redirect to home after sign-up (users need admin approval)
      signInFallbackRedirectUrl={`${baseUrl}/`}
      // Redirect to sign-in page after sign-out
      afterSignOutUrl={signInUrl}
      routerPush={(to) => setLocation(to)}
      routerReplace={(to) => setLocation(to, { replace: true })}
      appearance={{
        elements: {
          rootBox: "mx-auto",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}


