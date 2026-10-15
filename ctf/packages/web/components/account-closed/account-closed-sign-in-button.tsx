'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { reportError } from '@/lib/observability/report';

// "Sign in to your other account" for a member whose second sign-up was closed as a duplicate.
//
// They are on this page only while signed in to the closed account. A plain link to the hosted sign-in
// page does not work for them: the provider sees the active session, skips the form, and returns them to
// the home page, which sends them straight back here. So this signs the closed session out first and
// lands on the sign-in form with nobody signed in.
export function AccountClosedSignInButton({ signInUrl }: { signInUrl: string }) {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setPending(true);
    setError(null);
    try {
      await signOut({ redirectUrl: signInUrl });
    } catch (err) {
      reportError(err, { area: 'account-closed', op: 'sign_out_for_other_account' });
      const reason = err instanceof Error && err.message ? err.message : 'no reason was given';
      setError(`Signing out of this account failed (${reason}). Reload the page and try again.`);
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 20px',
          borderRadius: 11,
          background: '#C084FC',
          border: 'none',
          color: '#1A1030',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: pending ? 'default' : 'pointer',
          opacity: pending ? 0.7 : 1,
        }}
      >
        Sign in to your other account
      </button>
      {error ? (
        <p role="alert" style={{ flexBasis: '100%', fontSize: 13, color: '#FCA5A5', lineHeight: 1.6, margin: 0 }}>
          {error}
        </p>
      ) : null}
    </>
  );
}
