import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lock, ArrowRight } from "lucide-react";

// Get account URLs based on environment
const getAccountUrls = () => {
  if (typeof window === 'undefined') {
    // Server-side: default to staging
    return {
      signIn: 'https://sure-oarfish-90.accounts.dev/sign-in',
      signUp: 'https://sure-oarfish-90.accounts.dev/sign-up',
      unauthorized: 'https://sure-oarfish-90.accounts.dev/unauthorized-sign-in',
    };
  }

  const baseUrl = window.location.origin;
  const hostname = window.location.hostname || '';
  const isProduction = hostname.includes('app.chargingthefuture.com');
  const isStaging = hostname.includes('the-comic.com') || hostname.includes('staging');
  
  if (isProduction) {
    return {
      signIn: 'https://accounts.app.chargingthefuture.com/sign-in',
      signUp: 'https://accounts.app.chargingthefuture.com/sign-up',
      unauthorized: 'https://accounts.app.chargingthefuture.com/unauthorized-sign-in',
    };
  }
  
  if (isStaging) {
    // For staging, check if custom domain is configured
    // Default to accounts.the-comic.com for the-comic.com domain
    const stagingCustomDomain = import.meta.env.VITE_CLERK_STAGING_DOMAIN || 
      (hostname.includes('the-comic.com') ? 'accounts.the-comic.com' : null);
    if (stagingCustomDomain) {
      return {
        signIn: `https://${stagingCustomDomain}/sign-in`,
        signUp: `https://${stagingCustomDomain}/sign-up`,
        unauthorized: `https://${stagingCustomDomain}/unauthorized-sign-in`,
      };
    }
    // Otherwise use a stable external accounts domain for staging/local fallback
    const fallbackStagingAccounts = 'accounts.the-comic.com';
    return {
      signIn: `https://${fallbackStagingAccounts}/sign-in`,
      signUp: `https://${fallbackStagingAccounts}/sign-up`,
      unauthorized: `https://${fallbackStagingAccounts}/unauthorized-sign-in`,
    };
  }
  
  // Staging (including localhost:5000)
  return {
    signIn: 'https://sure-oarfish-90.accounts.dev/sign-in',
    signUp: 'https://sure-oarfish-90.accounts.dev/sign-up',
    unauthorized: 'https://sure-oarfish-90.accounts.dev/unauthorized-sign-in',
  };
};

export function LoginForm() {
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const accountUrls = getAccountUrls();

  const handleSignIn = () => {
    setRedirectUrl(accountUrls.signIn);
    setIsDialogOpen(true);
  };

  const handleSignUp = () => {
    setRedirectUrl(accountUrls.signUp);
    setIsDialogOpen(true);
  };

  const handleConfirmRedirect = () => {
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setRedirectUrl(null);
  };

  return (
    <>
      <div className="flex flex-col items-center space-y-4">
        <Button
          onClick={handleSignIn}
          className="w-full text-base font-semibold"
          data-testid="button-login"
        >
          <Lock className="mr-2 h-4 w-4" />
          Sign In Securely
        </Button>
        
        <Button
          onClick={handleSignUp}
          variant="outline"
          className="w-full text-base font-semibold"
          data-testid="button-signup"
        >
          Create Account
        </Button>
        
        <p className="text-xs text-center text-muted-foreground">
          Passwordless authentication available. No password needed.
        </p>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redirecting to Accounts Portal</DialogTitle>
            <DialogDescription>
              You are about to be redirected to the accounts portal. This will take you to an external site to sign in or create an account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground break-all">{redirectUrl}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-redirect">
              Cancel
            </Button>
            <Button onClick={handleConfirmRedirect} data-testid="button-confirm-redirect">
              <ArrowRight className="w-4 h-4 mr-2" />
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

