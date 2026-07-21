'use client';

import { CheckCircle, MessageSquare, Clock } from 'lucide-react';
import { SIGNAL_BLUE, STATUS_PENDING, type ContributionsTokens } from './contributions-shared';

export type ConfirmationProps = {
  t: ContributionsTokens;
  // The owner's Signal contact from the server-only env var; when null we fall back to the
  // editable instructions text so the screen never breaks.
  ownerSignalUrl: string | null;
  signalInstructions: string;
  onViewHistory: () => void;
  onBackToHub: () => void;
};

// Render the owner's Signal URL inline as a tappable link, or fall back to the editable
// instructions text. The surrounding copy — the never-in-the-Commons warning and the "ask in the
// Commons" line — is always shown.
function SignalLine({ ownerSignalUrl, signalInstructions, t }: { ownerSignalUrl: string | null; signalInstructions: string; t: ContributionsTokens }) {
  if (ownerSignalUrl) {
    return (
      <p style={{ margin: '0 0 12px', fontSize: 13, color: t.MUTED, lineHeight: 1.7 }}>
        Send your gift card code on Signal:{' '}
        <a href={ownerSignalUrl} target="_blank" rel="noopener noreferrer" style={{ color: SIGNAL_BLUE, fontWeight: 600, wordBreak: 'break-all' }}>
          {ownerSignalUrl}
        </a>{' '}
        Once the card is matched to your submission, your ServiceCredits will be added.
      </p>
    );
  }

  const fallback =
    signalInstructions.trim().length > 0
      ? signalInstructions
      : "Send your gift card code directly to the platform owner on Signal. The contact details are in the owner's platform profile. Once the card is matched to your submission, your ServiceCredits will be added.";

  return <p style={{ margin: '0 0 12px', fontSize: 13, color: t.MUTED, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{fallback}</p>;
}

function SignalBox({ ownerSignalUrl, signalInstructions, t, compact }: { ownerSignalUrl: string | null; signalInstructions: string; t: ContributionsTokens; compact?: boolean }) {
  return (
    <div style={{ background: t.SURFACE, borderRadius: 12, padding: compact ? 16 : '20px 22px', border: `1px solid ${t.BORDER_SOLID}`, marginBottom: compact ? 14 : 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: compact ? 10 : 12 }}>
        <MessageSquare size={14} color={SIGNAL_BLUE} />
        <span style={{ fontSize: 13, fontWeight: 600, color: t.TITLE }}>Send the code on Signal</span>
      </div>
      <SignalLine ownerSignalUrl={ownerSignalUrl} signalInstructions={signalInstructions} t={t} />
      <div style={{ padding: '10px 14px', background: '#EF44440F', borderRadius: 8, border: '1px solid #EF444440', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600, marginBottom: 4 }}>Send the code only on Signal — never in the Commons</div>
        <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6 }}>
          The Commons is a public group chat. If you post your gift card code or details there, you will not receive
          ServiceCredits and the owner will not receive the gift. The code goes only to the owner on Signal, using the
          link above.
        </div>
      </div>
      <div style={{ padding: '10px 14px', background: t.BG, borderRadius: 8, border: `1px solid ${t.BORDER_SOLID}` }}>
        <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 4 }}>Questions or need help?</div>
        <div style={{ fontSize: 12, color: SIGNAL_BLUE }}>Ask in the Commons — the group chat. It&apos;s the place for anything other than sending the code.</div>
      </div>
    </div>
  );
}

function CreditsPending({ t, compact }: { t: ContributionsTokens; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: `${t.ACCENT}08`, borderRadius: 10, border: `1px solid ${t.ACCENT}20`, marginBottom: 28 }}>
      <Clock size={16} color={STATUS_PENDING} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.TITLE, marginBottom: 2 }}>ServiceCredits pending confirmation</div>
        <div style={{ fontSize: 12, color: t.MUTED }}>{compact ? 'Credits will appear in your wallet after confirmation.' : 'Once your gift card is matched, your credits will appear in your wallet automatically.'}</div>
      </div>
    </div>
  );
}

function MobileConfirmation({ t, ownerSignalUrl, signalInstructions, onViewHistory, onBackToHub }: ConfirmationProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 18px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: `${t.ACCENT}18`, border: `1px solid ${t.ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <CheckCircle size={30} color={t.ACCENT} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: t.TITLE }}>Submission received</h2>
        <p style={{ margin: 0, fontSize: 14, color: t.MUTED }}>Your gift card submission is being reviewed.</p>
      </div>
      <SignalBox ownerSignalUrl={ownerSignalUrl} signalInstructions={signalInstructions} t={t} compact />
      <CreditsPending t={t} compact />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" onClick={onBackToHub} style={{ width: '100%', padding: 12, borderRadius: 9, background: t.ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Back to Hub
        </button>
        <button type="button" onClick={onViewHistory} style={{ width: '100%', padding: 12, borderRadius: 9, background: 'transparent', border: `1px solid ${t.BORDER_SOLID}`, color: t.MUTED, fontSize: 14, cursor: 'pointer' }}>
          View my contributions
        </button>
      </div>
    </div>
  );
}

export function ContributionsConfirmation(props: ConfirmationProps & { isMobile: boolean }) {
  return <MobileConfirmation {...props} />;
}
