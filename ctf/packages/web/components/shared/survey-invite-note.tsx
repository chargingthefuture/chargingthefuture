'use client';

import Link from 'next/link';
import { ArchiveX } from 'lucide-react';
import { QUORA_SURVEY_PUBLIC_PATH } from 'lib/quora-deletion-survey/constants';

// The member-facing way into the Quora account-removal survey.
//
// The survey lives at a top-level path rather than under /apps, so the link reads well when it is
// posted on Quora or in a blog post. That is right for the audience outside the app and left the
// audience inside it with nothing: until this component, the only link anywhere in the product was
// the admin screen's "Member view" button (owner report, 2026-08-19).
//
// One component for both placements so the wording cannot drift between them. Both sit where a
// member has just been asked for a Quora profile URL, because the person who cannot produce one is
// usually the person whose accounts were taken:
//
//   - Unlock ('card'), beside the existing "can't find your profile URL?" help. That screen is
//     where an unapproved member is held, and the survey is one of only three things they are
//     allowed to do before approval — so with no link here, the exception carved out for them was
//     unreachable by them.
//   - Directory profile edit ('inline'), under the member's own Quora URL field, whose help text
//     already covers the case where their account changed. A removal is the harder version of that.
//
// Deliberately an invitation, not a requirement: nothing in either flow depends on answering, and
// the copy must not imply that verification or a profile is blocked on it.

const HEADING = 'Have your Quora accounts been removed?';
const BODY =
  'People writing about being targeted keep losing their accounts. If that happened to you, the survey records which ones and when — one place where the removals are written down instead of forgotten.';

export function SurveyInviteNote({
  variant = 'card',
  accent = '#C8A84B',
  muted = '#9CA3AF',
  title = '#F3F4F6',
}: {
  variant?: 'card' | 'inline';
  accent?: string;
  muted?: string;
  title?: string;
}) {
  if (variant === 'inline') {
    return (
      <div style={{ fontSize: 12, color: muted, marginTop: 6, lineHeight: 1.5 }}>
        Had an account removed rather than changed?{' '}
        <Link
          href={QUORA_SURVEY_PUBLIC_PATH}
          style={{ color: accent, fontWeight: 700, textDecoration: 'underline' }}
        >
          Record it in the account-removal survey
        </Link>{' '}
        — it is optional, and it does not affect your profile here.
      </div>
    );
  }

  return (
    <div
      role="note"
      style={{
        marginTop: 16,
        padding: '14px 16px',
        borderRadius: 12,
        background: `${accent}0D`,
        border: `1px solid ${accent}33`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <ArchiveX size={16} color={accent} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: title }}>{HEADING}</span>
      </div>
      <div style={{ fontSize: 13, color: muted, lineHeight: 1.6, marginBottom: 10 }}>{BODY}</div>
      <Link
        href={QUORA_SURVEY_PUBLIC_PATH}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          borderRadius: 10,
          border: `1px solid ${accent}55`,
          background: 'transparent',
          color: accent,
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        Tell us which accounts
      </Link>
    </div>
  );
}
