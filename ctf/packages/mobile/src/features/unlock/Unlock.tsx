// Unlock — the Android copy of the web /plugin/unlock screen (components/unlock/unlock-shell.tsx).
// It shows the loading screen, then the submission form when the member has not sent a profile
// address, or the status screen when they have. App.tsx shows it two ways: as the wall in front of
// the app for a member who has not passed it, and from Your account's Verification row.
//
// The one thing here the web screen does not have is the Sign out button on the wall (`showSignOut`).
// On the web a held member can still reach /account from the address bar; the app has no address bar
// and the wall covers everything else, so without it a held member could not leave or switch accounts.

import React, { useCallback, useEffect, useState } from 'react';
import { LoadingScreen } from '../../components/shared/LoadingScreen';
import { SignOutButton } from '../../components/shared/SessionControls';
import { fetchUnlockStatus, submitUnlockUrl, type UnlockStatus } from './api';
import { toDisplayStatus } from './unlock-tokens';
import { UnlockSubmissionView } from './UnlockSubmissionView';
import { UnlockStatusView } from './UnlockStatusView';

export function Unlock({
  onStatusChanged,
  onGoHome,
  onBack,
  showSignOut = false,
}: {
  /** Fires after each status read, so the host can re-check whether the member passes the wall. */
  onStatusChanged?: () => void;
  /** The web's links to "/" (the help button, "Continue to the Commons"): the app's home. */
  onGoHome: () => void;
  /** Present when the screen was opened from somewhere it can go back to. */
  onBack?: () => void;
  showSignOut?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<UnlockStatus | null>(null);
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      setStatus(await fetchUnlockStatus());
    } catch {
      setError('Unlock status unavailable.');
    } finally {
      if (initial) setLoading(false);
      onStatusChanged?.();
    }
  }, [onStatusChanged]);

  useEffect(() => {
    void loadStatus(true);
    // Load once when the screen opens, as the web does; a new onStatusChanged must not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(async (quoraProfileUrl: string) => {
    const trimmed = quoraProfileUrl.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitUnlockUrl(trimmed);
      setUrl('');
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, loadStatus]);

  if (loading) return <LoadingScreen />;

  const footer = showSignOut ? <SignOutButton /> : null;

  if (!status?.hasSubmission) {
    return (
      <UnlockSubmissionView
        url={url}
        onUrlChange={setUrl}
        onSubmit={() => void submit(url)}
        submitting={submitting}
        error={error}
        onGoHome={onGoHome}
        footer={footer}
      />
    );
  }

  return (
    <UnlockStatusView
      status={toDisplayStatus(status.reviewStatus)}
      resubmitUrl={url}
      onResubmitUrlChange={setUrl}
      onResubmit={() => void submit(url)}
      submitting={submitting}
      error={error}
      onGoHome={onGoHome}
      onBack={onBack}
      footer={footer}
    />
  );
}
