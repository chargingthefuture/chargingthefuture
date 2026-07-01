'use client';

import { useState } from 'react';
import { Gift, MessageSquare, Star, AlertCircle, ChevronDown } from 'lucide-react';
import type { GiftCardMethod } from '@/lib/contributions/types';
import {
  ALREADY_CREDITED_NOTE,
  GIFT_CARD_TYPES,
  type ContributionPath,
  type ContributionsTokens,
} from './contributions-shared';

export type SubmitGiftCardInput = { method: GiftCardMethod; claimedAmountUsd: number; signalContact: string };

export type PathsProps = {
  t: ContributionsTokens;
  creditsPerUsd: number;
  creditsPerAction: number;
  githubStarAlreadyCredited: boolean;
  submitting: boolean;
  error: string | null;
  onSubmitGiftCard: (input: SubmitGiftCardInput) => void;
  onSubmitQuora: (quoraPostUrl: string | undefined) => void;
  onSubmitGithub: (githubProfileUrl: string | undefined) => void;
};

type PathDef = {
  key: ContributionPath;
  Icon: typeof Gift;
  label: string;
  sub: string;
  credits: string;
};

function inputStyle(t: ContributionsTokens): React.CSSProperties {
  return {
    width: '100%',
    padding: '9px 12px',
    background: t.BG,
    border: `1px solid ${t.BORDER_SOLID}`,
    borderRadius: 8,
    fontSize: 14,
    color: t.TEXT,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function labelStyle(t: ContributionsTokens): React.CSSProperties {
  return { fontSize: 12, color: t.MUTED, display: 'block', marginBottom: 6 };
}

function FormActions({ t, submitting, onSubmit, onCancel }: { t: ContributionsTokens; submitting: boolean; onSubmit: () => void; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        style={{ flex: 1, padding: 10, borderRadius: 8, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}
      >
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{ padding: '10px 18px', borderRadius: 8, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 13, cursor: 'pointer' }}
      >
        Not now
      </button>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }
  return <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>{error}</div>;
}

function GiftCardForm({ t, submitting, error, onSubmit, onCancel }: { t: ContributionsTokens; submitting: boolean; error: string | null; onSubmit: (input: SubmitGiftCardInput) => void; onCancel: () => void }) {
  const [method, setMethod] = useState<GiftCardMethod>('amazon');
  const [cardValue, setCardValue] = useState('');
  const [signalContact, setSignalContact] = useState('');

  function handleSubmit() {
    const amount = Number(cardValue);
    onSubmit({ method, claimedAmountUsd: Number.isFinite(amount) ? amount : 0, signalContact: signalContact.trim() });
  }

  return (
    <div style={{ background: t.SURFACE, borderRadius: 12, padding: 20, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 16 }}>Gift card details</div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>Card type</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {GIFT_CARD_TYPES.map((type) => (
            <button
              key={type.method}
              type="button"
              onClick={() => setMethod(type.method)}
              style={{ padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: method === type.method ? t.ACCENT : t.BORDER_SOLID, color: method === type.method ? '#fff' : t.MUTED }}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle(t)}>Card value (USD, max $500)</label>
        <input value={cardValue} onChange={(e) => setCardValue(e.target.value)} inputMode="decimal" placeholder="e.g. 25" style={inputStyle(t)} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle(t)}>
          Your Signal URL or phone number <span style={{ color: '#EF4444' }}>*</span>
        </label>
        <input value={signalContact} onChange={(e) => setSignalContact(e.target.value)} placeholder="signal.me/+1… or +1 555-…" style={inputStyle(t)} />
        <div style={{ fontSize: 11, color: t.MUTED, marginTop: 5 }}>So we can match your card to your account.</div>
      </div>
      <ErrorLine error={error} />
      <FormActions t={t} submitting={submitting} onSubmit={handleSubmit} onCancel={onCancel} />
    </div>
  );
}

function UrlForm({
  t,
  title,
  blurb,
  fieldLabel,
  placeholder,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  t: ContributionsTokens;
  title: string;
  blurb: string;
  fieldLabel: string;
  placeholder: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (url: string | undefined) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState('');
  return (
    <div style={{ background: t.SURFACE, borderRadius: 12, padding: 20, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 13, color: t.MUTED, margin: '0 0 14px', lineHeight: 1.6 }}>{blurb}</p>
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle(t)}>{fieldLabel}</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={placeholder} style={inputStyle(t)} />
      </div>
      <ErrorLine error={error} />
      <FormActions t={t} submitting={submitting} onSubmit={() => onSubmit(url.trim() ? url.trim() : undefined)} onCancel={onCancel} />
    </div>
  );
}

/**
 * The three contribution-path cards plus the thank-you credits note and the active path's inline
 * form. The GitHub-star path is greyed out and non-interactive when the member has already been
 * credited for a star (githubStarAlreadyCredited); the gift-card and Quora paths stay active.
 */
export function ContributionPaths({
  t,
  creditsPerUsd,
  creditsPerAction,
  githubStarAlreadyCredited,
  submitting,
  error,
  onSubmitGiftCard,
  onSubmitQuora,
  onSubmitGithub,
}: PathsProps) {
  const [activePath, setActivePath] = useState<ContributionPath>(null);

  const paths: PathDef[] = [
    { key: 'gift_card', Icon: Gift, label: 'Gift card', sub: "Amazon, Apple, or Denny's", credits: `${creditsPerUsd} SC per dollar` },
    { key: 'quora_comment', Icon: MessageSquare, label: 'Quora comment', sub: 'Comment on a Quora post', credits: `${creditsPerAction} SC` },
    { key: 'github_star', Icon: Star, label: 'GitHub star', sub: 'Star our repository', credits: `${creditsPerAction} SC` },
  ];

  function toggle(key: ContributionPath, disabled: boolean) {
    if (disabled) {
      return;
    }
    setActivePath((prev) => (prev === key ? null : key));
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: t.TITLE }}>How would you like to help?</h2>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>
        Pick one of the three ways below. A short form opens right underneath so you can submit your gift card, Quora comment, or GitHub star.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {paths.map(({ key, Icon, label, sub, credits }) => {
          const disabled = key === 'github_star' && githubStarAlreadyCredited;
          const active = activePath === key;
          return (
            <div
              key={key as string}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-disabled={disabled}
              onClick={() => toggle(key, disabled)}
              onKeyDown={(e) => {
                if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  toggle(key, disabled);
                }
              }}
              style={{
                background: active ? `${t.ACCENT}10` : t.SURFACE,
                borderRadius: 10,
                padding: 16,
                border: `1px solid ${active ? t.ACCENT : t.BORDER_SOLID}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: active ? `${t.ACCENT}20` : t.BORDER_SOLID, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={14} color={active ? t.ACCENT : t.MUTED} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: active ? t.ACCENT : t.TITLE }}>{label}</span>
              </div>
              <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 6 }}>{disabled ? ALREADY_CREDITED_NOTE : sub}</div>
              {!disabled && <div style={{ fontSize: 11, color: t.ACCENT, fontWeight: 500 }}>As a thank-you: {credits}</div>}
              {!disabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 11, fontWeight: 600, color: active ? t.ACCENT : t.MUTED }}>
                  {active ? 'Selected — form below' : 'Choose this'}
                  <ChevronDown size={12} style={{ transform: active ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* The chosen path's form opens here, directly under the cards, so it is obviously connected
          to the card just selected. Until a card is chosen, a short prompt stands in its place so
          the screen never looks like a dead end. */}
      {activePath === null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', background: t.SURFACE, borderRadius: 10, border: `1px dashed ${t.BORDER_SOLID}`, marginBottom: 20 }}>
          <ChevronDown size={14} color={t.MUTED} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>
            Choose one of the three ways above and its form will open here.
          </span>
        </div>
      )}
      {activePath === 'gift_card' && (
        <GiftCardForm t={t} submitting={submitting} error={error} onSubmit={onSubmitGiftCard} onCancel={() => setActivePath(null)} />
      )}
      {activePath === 'quora_comment' && (
        <UrlForm
          t={t}
          title="Quora comment"
          blurb="Leave a comment on a Quora post in our space. If you have the link, paste it here — if not, that's fine, we'll find it."
          fieldLabel="Quora post URL (optional)"
          placeholder="https://www.quora.com/…"
          submitting={submitting}
          error={error}
          onSubmit={onSubmitQuora}
          onCancel={() => setActivePath(null)}
        />
      )}
      {activePath === 'github_star' && !githubStarAlreadyCredited && (
        <UrlForm
          t={t}
          title="GitHub star"
          blurb="Star our repository on GitHub. If you'd like to share your GitHub profile so we can confirm, paste it here — no obligation."
          fieldLabel="GitHub profile URL (optional)"
          placeholder="https://github.com/your-username"
          submitting={submitting}
          error={error}
          onSubmit={onSubmitGithub}
          onCancel={() => setActivePath(null)}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: `${t.ACCENT}08`, borderRadius: 8, border: `1px solid ${t.ACCENT}20`, marginTop: 4 }}>
        <AlertCircle size={13} color={t.ACCENT} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>
          Confirmed contributions earn ServiceCredits as a thank-you — {creditsPerUsd} SC per dollar for gift cards, and {creditsPerAction} SC for a comment or star. Credits are a thank-you; they can&apos;t be turned back into cash.
        </span>
      </div>
    </div>
  );
}
