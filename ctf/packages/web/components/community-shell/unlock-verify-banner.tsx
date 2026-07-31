'use client';

import { useState } from 'react';
import { ExternalLink, Send, ShieldCheck } from 'lucide-react';
import type { UnlockReviewStatus } from '../../lib/unlock/types';

// The calm "under review" note shown once a submission is in the queue. The member keeps Commons
// access while a human reviews.
function UnlockPendingNote() {
  return (
    <p style={{ fontSize: 13, color: 'var(--ctf-text-secondary)', lineHeight: 1.6, margin: 0 }}>
      Thanks — your Quora profile is submitted and a human is reviewing it. You have Commons access
      while you wait.
    </p>
  );
}

type UnlockSubmitFormProps = {
  url: string;
  submitting: boolean;
  error: string | null;
  wasRejected: boolean;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
};

// The inline verification form: prompt copy, the Quora profile URL input, the submit button, any
// error, and the universal help note for a member who can't find their profile URL.
function UnlockSubmitForm({ url, submitting, error, wasRejected, onUrlChange, onSubmit }: UnlockSubmitFormProps) {
  const disabled = url.trim().length === 0 || submitting;
  const inputBorderColor = url ? 'rgba(192,132,252,0.5)' : 'rgba(255,255,255,0.12)';
  const buttonBackground = disabled ? 'rgba(255,255,255,0.10)' : '#C084FC';
  const buttonColor = disabled ? 'var(--ctf-text-secondary)' : '#1A1030';
  const buttonCursor = disabled ? 'default' : 'pointer';
  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--ctf-text-secondary)', lineHeight: 1.6, margin: '0 0 10px' }}>
        {wasRejected
          ? 'Your last submission could not be verified. Re-submit your Quora profile URL below — a human reviews every one.'
          : 'Submit your Quora profile URL so we can confirm you are a real person. A human reviews every submission.'}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            minWidth: 240,
            padding: '10px 12px',
            background: 'rgba(0,0,0,0.25)',
            border: `1px solid ${inputBorderColor}`,
            borderRadius: 10,
          }}
        >
          {/* stroke defaults to currentColor, so the CSS color var themes the icon */}
          <ExternalLink size={14} style={{ color: 'var(--ctf-text-secondary)', flexShrink: 0 }} />
          <input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit();
            }}
            placeholder="https://quora.com/profile/your-name"
            aria-label="Your Quora profile URL"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              color: 'var(--ctf-text)',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            borderRadius: 10,
            border: 'none',
            background: buttonBackground,
            color: buttonColor,
            fontSize: 14,
            fontWeight: 700,
            cursor: buttonCursor,
          }}
        >
          <Send size={14} /> {submitting ? 'Submitting…' : 'Submit for verification'}
        </button>
      </div>
      {error ? <div style={{ fontSize: 12, color: '#F87171', marginTop: 8 }}>{error}</div> : null}

      {/* Prominent, universal help for a member who can't find their Quora profile URL. */}
      <div
        role="note"
        style={{
          marginTop: 12,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(192,132,252,0.12)',
          border: '1.5px solid rgba(192,132,252,0.45)',
          fontSize: 12.5,
          color: 'var(--ctf-text-secondary)',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: 'var(--ctf-text)' }}>Can’t find your Quora profile URL?</strong> Go to{' '}
        <a
          href="https://skillseconomy.quora.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#C084FC', fontWeight: 700 }}
        >
          skillseconomy.quora.com
        </a>{' '}
        and comment on any post asking for help — I&apos;ll reply with your profile URL.
      </div>
    </>
  );
}

// Shown at the top of the Commons for a signed-in member who has not yet completed Quora verification
// (including members in the early-Commons A/B treatment bucket, who now land on the Commons instead of
// the Unlock screen). Without this, a treatment member sees the chat with no indication they still need
// to verify. It prompts for the Quora profile URL inline — posting to the same POST /api/unlock/submission
// the Unlock screen uses — and tells a stuck member to just ask for help here in the Commons chat.
export function UnlockVerifyBanner({
  hasSubmission,
  reviewStatus,
}: {
  hasSubmission: boolean;
  reviewStatus: UnlockReviewStatus | null;
}) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Flip to a "pending review" state after a successful inline submission without a full reload.
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Awaiting review — either a prior pending submission or one just made here. Show a calm status note
  // rather than the input, so the member knows they are in the queue and still have Commons access.
  const isPending = justSubmitted || (hasSubmission && reviewStatus === 'pending');
  // A rejected/spam prior submission should re-prompt for a corrected URL.
  const wasRejected = hasSubmission && (reviewStatus === 'rejected' || reviewStatus === 'spam');

  async function submit() {
    const trimmed = url.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/unlock/submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoraProfileUrl: trimmed }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? 'Submission failed. Try again.');
      }
      setUrl('');
      setJustSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Verify your account"
      style={{
        margin: '0 0 14px',
        padding: '14px 16px',
        borderRadius: 14,
        background: 'linear-gradient(180deg, rgba(192,132,252,0.10), rgba(192,132,252,0.04))',
        border: '1px solid rgba(192,132,252,0.30)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <ShieldCheck size={16} color="#C084FC" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ctf-text)' }}>
          {isPending ? 'Your verification is under review' : 'Verify your account to unlock full access'}
        </span>
      </div>

      {isPending ? (
        <UnlockPendingNote />
      ) : (
        <UnlockSubmitForm
          url={url}
          submitting={submitting}
          error={error}
          wasRejected={wasRejected}
          onUrlChange={setUrl}
          onSubmit={() => void submit()}
        />
      )}
    </section>
  );
}
