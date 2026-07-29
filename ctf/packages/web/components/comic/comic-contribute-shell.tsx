'use client';

import { useCallback, useEffect, useState } from 'react';
import { Upload, ShieldCheck, Check, Trash2 } from 'lucide-react';
import { MobileScreenHeader } from '@/components/shared/mobile-screen-header';
import { useTheme } from '@/hooks/useTheme';
import { getComicTokens } from './comic-shared';
import {
  CONTRIBUTION_CONSENT_CLAUSES,
  CONTRIBUTION_CONSENT_NOTES,
  CONTRIBUTION_CONSENT_VERSION,
} from '../../lib/comic/contribution-consent';

// The contribute page: where a member sends their own public Quora writing for the assistant's
// reference library, and where the consent that permits it is given.
//
// The consent form is ON this page, not a separate document behind a link, because a link is a thing
// people click past. The clauses render from lib/comic/contribution-consent.ts — the same module the
// server version-stamps into the stored record — so what is displayed and what is agreed to cannot
// come apart.
//
// Each clause is its own checkbox. There is deliberately no single "I agree to all of the above":
// the whole point is that six short statements get read, and one box makes that skippable.

type ContributionSummary = {
  id: string;
  status: 'pending_review' | 'accepted' | 'declined' | 'withdrawn';
  entryCount: number;
  discardedSections: string[];
  declineReason: string;
  createdAtIso: string;
};

const STATUS_LABEL: Record<ContributionSummary['status'], string> = {
  pending_review: 'Waiting to be read',
  accepted: 'In the library',
  declined: 'Not used',
  withdrawn: 'Withdrawn',
};

export function ComicContributeShell() {
  const { theme } = useTheme();
  const t = getComicTokens(theme);

  const [agreed, setAgreed] = useState<Set<string>>(new Set());
  const [thirdPartyNote, setThirdPartyNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ContributionSummary | null>(null);
  const [history, setHistory] = useState<ContributionSummary[]>([]);

  const allAgreed = CONTRIBUTION_CONSENT_CLAUSES.every((clause) => agreed.has(clause.id));

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/comic/contributions', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { contributions?: ContributionSummary[] };
      setHistory(Array.isArray(data.contributions) ? data.contributions : []);
    } catch {
      // Non-fatal: the history list is context, never a blocker on sending.
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  function toggleClause(id: string) {
    setAgreed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!file || !allAgreed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('archive', file);
      body.set('consentVersion', CONTRIBUTION_CONSENT_VERSION);
      body.set('agreedClauseIds', JSON.stringify([...agreed]));
      body.set('thirdPartyNote', thirdPartyNote.trim());
      const res = await fetch('/api/comic/contributions', {
        method: 'POST',
        headers: { 'x-ctf-csrf': '1' },
        body,
      });
      const data = (await res.json().catch(() => null)) as
        | { contribution?: ContributionSummary; message?: string }
        | null;
      if (!res.ok || !data?.contribution) {
        setError(data?.message ?? 'Could not send that file. Nothing was kept.');
      } else {
        setReceipt(data.contribution);
        setFile(null);
        setAgreed(new Set());
        setThirdPartyNote('');
        void loadHistory();
      }
    } catch {
      setError('Could not reach the server. Nothing was sent.');
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw(id: string) {
    try {
      const res = await fetch(`/api/comic/contributions/${id}/withdraw`, {
        method: 'POST',
        headers: { 'x-ctf-csrf': '1' },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? 'Could not withdraw that contribution.');
        return;
      }
      void loadHistory();
    } catch {
      setError('Could not reach the server.');
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: t.BG, color: t.TITLE, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <MobileScreenHeader title="Contribute your writing" accent={t.ACCENT} icon={<Upload size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px' }}>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: t.TEXT, marginTop: 0 }}>
          The assistant answers from one person&apos;s writing. Yours is different, and the next member
          asking for help deserves both. If you have written publicly on Quora about what you have
          lived through and how you manage it, you can lend that writing here.
        </p>

        <section style={cardStyle(t)}>
          <h2 style={cardTitleStyle}>Getting your file</h2>
          <p style={bodyStyle(t)}>
            In Quora: Settings → Privacy → Download your information. It arrives by email as a{' '}
            <strong>.zip</strong>. Send it here exactly as it arrived — do not unzip it, and do not try
            to clean it out first. The next section explains why you do not have to.
          </p>
        </section>

        <section style={cardStyle(t)}>
          <h2 style={cardTitleStyle}>
            <ShieldCheck size={16} color={t.ACCENT} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            What happens to your file
          </h2>
          <ul style={{ ...bodyStyle(t), paddingLeft: 18, margin: 0 }}>
            {CONTRIBUTION_CONSENT_NOTES.map((note) => (
              <li key={note} style={{ marginBottom: 10 }}>{note}</li>
            ))}
          </ul>
        </section>

        <section style={cardStyle(t)}>
          <h2 style={cardTitleStyle}>What is used</h2>
          <p style={bodyStyle(t)}>
            Posts where you describe what happened and what you did about it — practical, specific,
            from your own life. That is what someone asking the assistant for help actually needs.
          </p>
          <p style={{ ...bodyStyle(t), marginBottom: 0 }}>
            Posts that are only declaration — with no account of what you went through and nothing
            about how you coped — will not be used. That is not a judgment on anyone&apos;s faith or how
            they make sense of this. If you write about faith <em>and</em> about what you did on the
            ground, that is exactly what is wanted here.
          </p>
        </section>

        {/* The consent form itself. */}
        <section style={{ ...cardStyle(t), borderColor: `${t.ACCENT}55` }}>
          <h2 style={cardTitleStyle}>Your consent</h2>
          <p style={{ ...bodyStyle(t), marginTop: 0 }}>
            Read each line and tick it. All six are needed before a file can be sent.
          </p>
          {CONTRIBUTION_CONSENT_CLAUSES.map((clause) => (
            <label
              key={clause.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '10px 0',
                borderTop: `1px solid ${t.BORDER}`,
                fontSize: 14,
                lineHeight: 1.6,
                color: t.TEXT,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={agreed.has(clause.id)}
                onChange={() => toggleClause(clause.id)}
                style={{ marginTop: 4, width: 18, height: 18, flexShrink: 0, accentColor: t.ACCENT }}
              />
              <span>{clause.text}</span>
            </label>
          ))}

          <label style={{ display: 'block', marginTop: 16, fontSize: 13, fontWeight: 600, color: t.SUBTLE }}>
            Does your writing name or describe anyone else? (optional)
          </label>
          <textarea
            value={thirdPartyNote}
            onChange={(event) => setThirdPartyNote(event.target.value)}
            rows={3}
            placeholder="Tell me who, so those parts can be cut before anything is used."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginTop: 6,
              padding: '10px 12px',
              borderRadius: 10,
              background: t.INPUT_BG,
              border: `1px solid ${t.BORDER_SOLID}`,
              color: t.TITLE,
              fontSize: 14,
              resize: 'vertical',
            }}
          />
        </section>

        <section style={cardStyle(t)}>
          <h2 style={cardTitleStyle}>Send your file</h2>
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
            }}
            // Disabled until every clause is ticked, so the order is always read-then-choose. A file
            // is never even selected, let alone uploaded, before consent is given.
            disabled={!allAgreed}
            style={{ fontSize: 14, color: t.TEXT }}
          />
          {!allAgreed ? (
            <p style={{ ...bodyStyle(t), marginBottom: 0 }}>Tick all six consent lines above to choose a file.</p>
          ) : null}

          {error ? (
            <p role="alert" style={{ fontSize: 14, color: '#F87171', marginTop: 12, marginBottom: 0 }}>{error}</p>
          ) : null}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!file || !allAgreed || submitting}
            style={{
              marginTop: 14,
              padding: '12px 18px',
              borderRadius: 10,
              background: !file || !allAgreed ? `${t.ACCENT}22` : `${t.ACCENT}33`,
              border: `1px solid ${t.ACCENT}66`,
              color: t.ACCENT,
              fontSize: 15,
              fontWeight: 700,
              cursor: !file || !allAgreed || submitting ? 'not-allowed' : 'pointer',
              opacity: !file || !allAgreed ? 0.6 : 1,
            }}
          >
            {submitting ? 'Sending…' : 'Send my writing'}
          </button>
        </section>

        {/* The receipt is the evidence for the promise: it names what was kept and what was thrown
            away, immediately, rather than asking the contributor to take it on trust. */}
        {receipt ? (
          <section style={{ ...cardStyle(t), borderColor: `${t.ACCENT}55` }} role="status">
            <h2 style={cardTitleStyle}>
              <Check size={16} color={t.ACCENT} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              Received
            </h2>
            <p style={bodyStyle(t)}>
              <strong>{receipt.entryCount.toLocaleString()}</strong> public{' '}
              {receipt.entryCount === 1 ? 'piece' : 'pieces'} of your writing were kept and are waiting
              to be read.
            </p>
            {receipt.discardedSections.length > 0 ? (
              <p style={{ ...bodyStyle(t), marginBottom: 0 }}>
                Deleted on arrival, before anyone opened the file: {receipt.discardedSections.join(', ')}.
                The .zip itself was not stored.
              </p>
            ) : (
              <p style={{ ...bodyStyle(t), marginBottom: 0 }}>The .zip itself was not stored.</p>
            )}
          </section>
        ) : null}

        {history.length > 0 ? (
          <section style={cardStyle(t)}>
            <h2 style={cardTitleStyle}>What you have sent</h2>
            {history.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderTop: `1px solid ${t.BORDER}`,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{STATUS_LABEL[item.status]}</div>
                  <div style={{ fontSize: 12, color: t.MUTED }}>
                    {new Date(item.createdAtIso).toLocaleDateString()} ·{' '}
                    {item.entryCount.toLocaleString()} {item.entryCount === 1 ? 'piece' : 'pieces'}
                    {item.status === 'declined' && item.declineReason ? ` · ${item.declineReason}` : ''}
                  </div>
                </div>
                {item.status !== 'withdrawn' ? (
                  <button
                    type="button"
                    onClick={() => void withdraw(item.id)}
                    aria-label="Withdraw this contribution"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: `1px solid ${t.BORDER_SOLID}`,
                      color: t.SUBTLE,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={14} /> Withdraw
                  </button>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        <p style={{ fontSize: 13, color: t.MUTED, lineHeight: 1.6, marginTop: 20 }}>
          An accepted contribution earns a ServiceCredits grant. ServiceCredits are an internal credits
          unit inside this app — they are not money, not cash, and cannot be cashed out. It is
          recognition for building something we all use, not a payment for your story.
        </p>
      </div>
    </main>
  );
}

const cardStyle = (t: ReturnType<typeof getComicTokens>): React.CSSProperties => ({
  marginTop: 18,
  borderRadius: 14,
  background: t.HEADER,
  border: `1px solid ${t.BORDER_SOLID}`,
  padding: 18,
});
const cardTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '0 0 10px' };
const bodyStyle = (t: ReturnType<typeof getComicTokens>): React.CSSProperties => ({
  fontSize: 14,
  lineHeight: 1.65,
  color: t.TEXT,
  marginTop: 0,
  marginBottom: 10,
});
