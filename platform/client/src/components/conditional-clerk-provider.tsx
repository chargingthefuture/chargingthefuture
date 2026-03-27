import { ClerkProvider } from "@clerk/clerk-react";
import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ClerkErrorBoundary } from "./clerk-error-boundary";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Get the base URL for redirects
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.VITE_APP_URL || 'https://app.chargingthefuture.com';
};

export function ConditionalClerkProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [scriptLoadError, setScriptLoadError] = useState<string | null>(null);

  // Monitor Clerk script loading
  useEffect(() => {
    if (!clerkPublishableKey) return;

    // Check if Clerk scripts are loading properly
    const checkScripts = () => {
      const scripts = Array.from(document.querySelectorAll('script[src*="clerk"]'));
      if (scripts.length === 0) {
        // Wait a bit for scripts to be injected
        const timer = setTimeout(() => {
          const scriptsAfterDelay = Array.from(document.querySelectorAll('script[src*="clerk"]'));
          if (scriptsAfterDelay.length === 0) {
            setScriptLoadError("Clerk scripts failed to load. This may indicate a network or CORS issue.");
          }
        }, 2000);
        return () => clearTimeout(timer);
      }
    };

    // Listen for script errors
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('clerk') || event.filename?.includes('clerk')) {
        setScriptLoadError(`Clerk script error: ${event.message}`);
      }
    };

    window.addEventListener('error', handleError);
    const cleanup = checkScripts();

    return () => {
      window.removeEventListener('error', handleError);
      if (cleanup) cleanup();
    };
  }, [clerkPublishableKey]);

  // Only render ClerkProvider if key is available and valid
  // Check for empty string, undefined, or the literal string "undefined"
  const isValidKey = clerkPublishableKey && 
                     clerkPublishableKey !== 'undefined' && 
                     clerkPublishableKey.trim() !== '' &&
                     clerkPublishableKey.startsWith('pk_');
  
  if (!isValidKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">Configuration Error</h1>
          <p className="text-muted-foreground">
            Missing or invalid VITE_CLERK_PUBLISHABLE_KEY environment variable.
          </p>
          <p className="text-sm text-muted-foreground">
            Please set VITE_CLERK_PUBLISHABLE_KEY in your environment variables.
            The key should start with "pk_" and be set at build time.
          </p>
          {typeof window !== 'undefined' && (
            <div className="mt-4 space-y-2 text-xs text-muted-foreground font-mono bg-muted p-4 rounded">
              <p><strong>Debug Info:</strong></p>
              <p>Environment: {import.meta.env.MODE}</p>
              <p>Key present: {clerkPublishableKey ? 'Yes' : 'No'}</p>
              <p>Key value: {clerkPublishableKey ? `${clerkPublishableKey.substring(0, 20)}...` : 'undefined'}</p>
              <p>Key valid: {isValidKey ? 'Yes' : 'No'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const baseUrl = getBaseUrl();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  
  // Detect environment
  const isProduction = hostname.includes('app.chargingthefuture.com');
  const isStaging = hostname.includes('the-comic.com') || 
    hostname.includes('staging') ||
    (typeof window !== 'undefined' && 
     (window.location.hostname.includes('railway.app') || 
      window.location.hostname.includes('up.railway.app')));
  const isLocalDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1');
  
  // Determine Clerk URLs based on environment
  // When using live keys with a separate Clerk project, Clerk automatically routes to the correct instance
  // based on the publishable key, so we can use relative URLs or let Clerk handle it
  let signInUrl: string;
  let signUpUrl: string;
  let unauthorizedSignInUrl: string;

  if (isProduction) {
    signInUrl = "https://accounts.app.chargingthefuture.com/sign-in";
    signUpUrl = "https://accounts.app.chargingthefuture.com/sign-up";
    unauthorizedSignInUrl = "https://accounts.app.chargingthefuture.com/unauthorized-sign-in";
  } else if (isStaging) {
    // For staging with live keys, check if custom domain is configured
    // Default to accounts.the-comic.com for the-comic.com domain
    const stagingCustomDomain = import.meta.env.VITE_CLERK_STAGING_DOMAIN || 
      (hostname.includes('the-comic.com') ? 'accounts.the-comic.com' : null);
    if (stagingCustomDomain) {
      // Custom domain configured (e.g., accounts.the-comic.com)
      signInUrl = `https://${stagingCustomDomain}/sign-in`;
      signUpUrl = `https://${stagingCustomDomain}/sign-up`;
      unauthorizedSignInUrl = `https://${stagingCustomDomain}/unauthorized-sign-in`;
    } else {
      // Use a stable external accounts domain for staging instead of relying on baseUrl.
      // This prevents Clerk from generating redirect_url back to the app origin.
      const fallbackStagingAccounts = 'accounts.the-comic.com';
      signInUrl = `https://${fallbackStagingAccounts}/sign-in`;
      signUpUrl = `https://${fallbackStagingAccounts}/sign-up`;
      unauthorizedSignInUrl = `https://${fallbackStagingAccounts}/unauthorized-sign-in`;
    }
  } else {
    // Local development - use dev instance
    signInUrl = "https://sure-oarfish-90.accounts.dev/sign-in";
    signUpUrl = "https://sure-oarfish-90.accounts.dev/sign-up";
    unauthorizedSignInUrl = "https://sure-oarfish-90.accounts.dev/unauthorized-sign-in";
  }

  // Wrap in error boundary to catch initialization errors
  return (
    <ClerkErrorBoundary>
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
    </ClerkErrorBoundary>
  );
}
