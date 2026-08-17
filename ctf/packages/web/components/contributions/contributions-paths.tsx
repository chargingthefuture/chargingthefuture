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
  const [amountError, setAmountError] = useState<string | null>(null);

  // Say what is wrong with the amount before a round trip does. The server enforces the same rule and
  // is the authority; this exists so a member who types 12.50 is told about cents rather than being
  // handed a rejection after submitting.
  function amountProblem(): string | null {
    const trimmed = cardValue.trim();
    if (!trimmed) return 'Enter the value of the card.';
    const amount = Number(trimmed);
    if (!Number.isFinite(amount)) return 'Enter the card value as a number, like 25.';
    if (!Number.isInteger(amount)) return 'Whole dollars only — no cents. Round to the nearest dollar.';
    if (amount < 1 || amount > 500) return 'The card value must be between $1 and $500.';
    return null;
  }

  function handleSubmit() {
    const problem = amountProblem();
    if (problem) {
      setAmountError(problem);
      return;
    }
    setAmountError(null);
    onSubmit({ method, claimedAmountUsd: Number(cardValue.trim()), signalContact: signalContact.trim() });
  }

  return (
    <div style={{ background: t.SURFACE, borderRadius: 12, padding: 20, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 8 }}>Gift card details</div>
      <p style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, margin: '0 0 10px' }}>
        Your gift card can be physical or digital. Don&apos;t enter the card number or code here — after you
        submit, send the card details privately to the platform owner on Signal (you&apos;ll get the link).
      </p>
      <p style={{ fontSize: 12, color: '#EF4444', lineHeight: 1.6, margin: '0 0 16px' }}>
        Never post your gift card code or details in the Commons. It&apos;s a public group chat, so if you share the
        code there you won&apos;t receive ServiceCredits and the owner won&apos;t receive the gift.
      </p>
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
        <label htmlFor="contrib-path-card-value" style={labelStyle(t)}>Card value (whole US dollars, $1 to $500)</label>
        {/* Numeric, not decimal: cents are not accepted, so the phone keypad should not offer a
            decimal point the member cannot use. */}
        <input
          id="contrib-path-card-value"
          value={cardValue}
          onChange={(e) => {
            setCardValue(e.target.value);
            if (amountError) {
              setAmountError(null);
            }
          }}
          inputMode="numeric"
          placeholder="e.g. 25"
          style={inputStyle(t)}
        />
        {amountError && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 5 }}>{amountError}</div>}
      </div>
      <div style={{ marginBottom: 18 }}>
        <label htmlFor="contrib-path-signal" style={labelStyle(t)}>
          Your Signal URL or phone number <span style={{ color: '#EF4444' }}>*</span>
        </label>
        <input id="contrib-path-signal" value={signalContact} onChange={(e) => setSignalContact(e.target.value)} placeholder="signal.me/+1… or +1 555-…" style={inputStyle(t)} />
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
  helpText,
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
  helpText: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (url: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState('');
  const [missing, setMissing] = useState(false);
  // The link is required: without it the owner cannot find and confirm the contribution. If the
  // member cannot find it, the help text points them to the Commons rather than letting them submit
  // an untrackable claim.
  function handleSubmit() {
    const trimmed = url.trim();
    if (!trimmed) {
      setMissing(true);
      return;
    }
    onSubmit(trimmed);
  }
  return (
    <div style={{ background: t.SURFACE, borderRadius: 12, padding: 20, border: `1px solid ${t.BORDER_SOLID}`, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.TITLE, marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 13, color: t.MUTED, margin: '0 0 14px', lineHeight: 1.6 }}>{blurb}</p>
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle(t)}>
          {fieldLabel} <span style={{ color: '#EF4444' }}>*</span>
        </label>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (missing) {
              setMissing(false);
            }
          }}
          placeholder={placeholder}
          style={inputStyle(t)}
        />
      </div>
      <p style={{ fontSize: 11, color: t.MUTED, margin: '0 0 14px', lineHeight: 1.6 }}>{helpText}</p>
      {missing && <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>Please paste the link so we can find and confirm your contribution.</div>}
      <ErrorLine error={error} />
      <FormActions t={t} submitting={submitting} onSubmit={handleSubmit} onCancel={onCancel} />
    </div>
  );
}

function pathCardStyle(t: ContributionsTokens, active: boolean, disabled: boolean): React.CSSProperties {
  return {
    background: active ? `${t.ACCENT}10` : t.SURFACE,
    borderRadius: 10,
    padding: 16,
    border: `1px solid ${active ? t.ACCENT : t.BORDER_SOLID}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  };
}

function PathCardHeader({ Icon, label, active, t }: { Icon: typeof Gift; label: string; active: boolean; t: ContributionsTokens }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: active ? `${t.ACCENT}20` : t.BORDER_SOLID, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={active ? t.ACCENT : t.MUTED} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: active ? t.ACCENT : t.TITLE }}>{label}</span>
    </div>
  );
}

function PathCardChooser({ active, t }: { active: boolean; t: ContributionsTokens }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 11, fontWeight: 600, color: active ? t.ACCENT : t.MUTED }}>
      {active ? 'Selected — form below' : 'Choose this'}
      <ChevronDown size={12} style={{ transform: active ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} />
    </div>
  );
}

function PathCard({
  path,
  active,
  disabled,
  t,
  onToggle,
}: {
  path: PathDef;
  active: boolean;
  disabled: boolean;
  t: ContributionsTokens;
  onToggle: (key: ContributionPath, disabled: boolean) => void;
}) {
  const { key, Icon, label, sub, credits } = path;
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => onToggle(key, disabled)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onToggle(key, disabled);
        }
      }}
      style={pathCardStyle(t, active, disabled)}
    >
      <PathCardHeader Icon={Icon} label={label} active={active} t={t} />
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 6 }}>{disabled ? ALREADY_CREDITED_NOTE : sub}</div>
      {!disabled && <div style={{ fontSize: 11, color: t.ACCENT, fontWeight: 500 }}>As a thank-you: {credits}</div>}
      {!disabled && <PathCardChooser active={active} t={t} />}
    </div>
  );
}

/**
 * The three contribution-path cards plus the thank-you credits note and the active path's inline
 * form. The GitHub-star path is grayed out and non-interactive when the member has already been
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
        {paths.map((path) => {
          const disabled = path.key === 'github_star' && githubStarAlreadyCredited;
          const active = activePath === path.key;
          return <PathCard key={path.key as string} path={path} active={active} disabled={disabled} t={t} onToggle={toggle} />;
        })}
      </div>

      {/* The chosen path's form opens here, directly under the cards. Nothing shows until a card is
          selected — the cards' own "Choose this" cue is the prompt. */}
      {activePath === 'gift_card' && (
        <GiftCardForm t={t} submitting={submitting} error={error} onSubmit={onSubmitGiftCard} onCancel={() => setActivePath(null)} />
      )}
      {activePath === 'quora_comment' && (
        <UrlForm
          t={t}
          title="Quora comment"
          blurb="Leave a comment on a Quora post in our space, then paste the link to your comment so we can find and confirm it."
          fieldLabel="Link to your Quora comment"
          placeholder="https://www.quora.com/…"
          helpText="Need help finding the link? Ask in the Commons — the group chat — and we'll help you find it."
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
          blurb="Star our repository on GitHub, then paste your GitHub profile link so we can confirm it."
          fieldLabel="Your GitHub profile URL"
          placeholder="https://github.com/your-username"
          helpText="Need help finding the link? Ask in the Commons — the group chat — and we'll help you find it."
          submitting={submitting}
          error={error}
          onSubmit={onSubmitGithub}
          onCancel={() => setActivePath(null)}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: `${t.ACCENT}08`, borderRadius: 8, border: `1px solid ${t.ACCENT}20`, marginTop: 4 }}>
        <AlertCircle size={13} color={t.ACCENT} style={{ flexShrink: 0, marginTop: 1 }} />
        {/* Built as one template-literal string, not interpolations mixed with JSX text: a bare
            `{expr} word` boundary drops its space when the formatter wraps the line (that produced
            "50 SC" but "SCfor"). A single string has no such boundary. */}
        <span style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>
          {`Confirmed contributions earn ServiceCredits as a thank-you — ${creditsPerUsd} SC per dollar for gift cards, and ${creditsPerAction} SC for a comment or star. Credits are a thank-you; they can't be turned back into cash.`}
        </span>
      </div>
    </div>
  );
}
