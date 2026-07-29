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
import { MAX_LINKED_POSTS } from '../../lib/comic/contribution-links';

// The knowledge page (`/knowledge`): where a member lends their own public Quora writing to the
// assistant's reference library, and where the consent that permits it is given.
//
// Named "knowledge", not "contribute", because the Contributions plugin is a different thing
// entirely — the fundraiser and donation surface — and two member-facing paths a word apart would be
// a standing source of confusion (owner decision, 2026-07-29).
//
// The consent form is ON this page, not a separate document behind a link, because a link is a thing
// people click past. The clauses render from lib/comic/contribution-consent.ts — the same module the
// server version-stamps into the stored record — so what is displayed and what is agreed to cannot
// come apart.
//
// Each clause is its own checkbox. There is deliberately no single "I agree to all of the above":
// the whole point is that six short statements get read, and one box makes that skippable.

type LinkedPostDraft = { url: string; text: string };

type ContributionSummary = {
  id: string;
  kind: 'links' | 'export';
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

export function ComicKnowledgeShell() {
  const { theme } = useTheme();
  const t = getComicTokens(theme);

  // Links is the DEFAULT. Most people's public writing is mixed — dating, politics, faith, memes —
  // and nothing here sorts on-topic from off-topic automatically, so picking a few posts is both far
  // less work for the reviewer and a more honest consent than handing over a whole account.
  const [mode, setMode] = useState<'links' | 'export'>('links');
  const [posts, setPosts] = useState<LinkedPostDraft[]>([{ url: '', text: '' }]);
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

  const filledPosts = posts.filter((post) => post.url.trim().length > 0 || post.text.trim().length > 0);
  const canSend = allAgreed && (mode === 'export' ? file !== null : filledPosts.length > 0);

  async function submit() {
    if (!canSend || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('kind', mode);
      if (mode === 'export' && file) {
        body.set('archive', file);
      } else {
        body.set('posts', JSON.stringify(filledPosts.map((post) => ({ url: post.url.trim(), text: post.text.trim() }))));
      }
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
        setPosts([{ url: '', text: '' }]);
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
      <MobileScreenHeader title="Knowledge library" accent={t.ACCENT} icon={<Upload size={18} color={t.ACCENT} />} />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px' }}>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: t.TEXT, marginTop: 0 }}>
          The assistant answers from one person&apos;s writing. Yours is different, and the next member
          asking for help deserves both. If you have written publicly on Quora about what you have
          lived through and how you manage it, you can lend that writing here.
        </p>

        <section style={cardStyle(t)}>
          <h2 style={cardTitleStyle}>How you want to send it</h2>
          <div role="radiogroup" aria-label="How you want to send your writing" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(
              [
                {
                  value: 'links' as const,
                  label: 'Pick a few posts (recommended)',
                  hint: 'Paste the posts that are actually about being targeted. Most people write about all sorts of things — dating, politics, faith — and only you can tell which posts belong here.',
                },
                {
                  value: 'export' as const,
                  label: 'Send my whole Quora export',
                  hint: 'Better if nearly everything you have written publicly is on this subject. Your private messages and drafts are stripped out automatically on arrival.',
                },
              ]
            ).map((option) => (
              <div
                key={option.value}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: mode === option.value ? `${t.ACCENT}14` : 'transparent',
                  border: `1px solid ${mode === option.value ? `${t.ACCENT}55` : t.BORDER_SOLID}`,
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="radio"
                    id={`contribution-mode-${option.value}`}
                    name="contribution-mode"
                    checked={mode === option.value}
                    aria-describedby={`contribution-mode-${option.value}-hint`}
                    onChange={() => {
                      setMode(option.value);
                      setError(null);
                    }}
                    style={{ width: 18, height: 18, flexShrink: 0, accentColor: t.ACCENT }}
                  />
                  <label
                    htmlFor={`contribution-mode-${option.value}`}
                    style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, cursor: 'pointer' }}
                  >
                    {option.label}
                  </label>
                </div>
                <p
                  id={`contribution-mode-${option.value}-hint`}
                  style={{ fontSize: 13, lineHeight: 1.55, color: t.MUTED, margin: '4px 0 0 28px' }}
                >
                  {option.hint}
                </p>
              </div>
            ))}
          </div>

          {mode === 'export' ? (
            <p style={{ ...bodyStyle(t), marginTop: 12, marginBottom: 0 }}>
              In Quora: Settings → Privacy → Download your information. It arrives by email as a{' '}
              <strong>.zip</strong>. Send it exactly as it arrived — do not unzip it, and do not try to
              clean it out first. You do not have to.
            </p>
          ) : (
            <p style={{ ...bodyStyle(t), marginTop: 12, marginBottom: 0 }}>
              For each post: open it on Quora, copy the link, and paste the post&apos;s text. Nothing here
              goes and fetches the page — the link is so it can be checked that the post is public and
              yours, and the text is what the assistant reads.
            </p>
          )}
        </section>

        <section style={cardStyle(t)}>
          <h2 style={cardTitleStyle}>
            <ShieldCheck size={16} color={t.ACCENT} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            What happens to what you send
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

          <label
            htmlFor="third-party-note"
            style={{ display: 'block', marginTop: 16, fontSize: 13, fontWeight: 600, color: t.SUBTLE }}
          >
            Does your writing name or describe anyone else? (optional)
          </label>
          <textarea
            id="third-party-note"
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
          <h2 style={cardTitleStyle}>{mode === 'export' ? 'Send your file' : 'Your posts'}</h2>

          {/* Everything in here is disabled until all six consent lines are ticked, so the order is
              always read-then-send. A file is never even selected, and no post text is typed, before
              consent is given. */}
          {mode === 'export' ? (
            <>
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError(null);
                }}
                disabled={!allAgreed}
                style={{ fontSize: 14, color: t.TEXT }}
              />
              {!allAgreed ? (
                <p style={{ ...bodyStyle(t), marginBottom: 0 }}>Tick all six consent lines above to choose a file.</p>
              ) : null}
            </>
          ) : (
            <>
              {posts.map((post, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px 0',
                    borderTop: index === 0 ? 'none' : `1px solid ${t.BORDER}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.SUBTLE }}>Post {index + 1}</span>
                    {posts.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setPosts((current) => current.filter((_, i) => i !== index))}
                        aria-label={`Remove post ${index + 1}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: t.MUTED,
                          fontSize: 13,
                          cursor: 'pointer',
                          padding: 4,
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="url"
                    inputMode="url"
                    value={post.url}
                    disabled={!allAgreed}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPosts((current) => current.map((item, i) => (i === index ? { ...item, url: value } : item)));
                      setError(null);
                    }}
                    placeholder="Link to the post on Quora"
                    style={fieldStyle(t)}
                  />
                  <textarea
                    value={post.text}
                    disabled={!allAgreed}
                    onChange={(event) => {
                      const value = event.target.value;
                      setPosts((current) => current.map((item, i) => (i === index ? { ...item, text: value } : item)));
                      setError(null);
                    }}
                    rows={6}
                    placeholder="Paste the whole post here"
                    style={{ ...fieldStyle(t), marginTop: 8, resize: 'vertical' }}
                  />
                </div>
              ))}

              {posts.length < MAX_LINKED_POSTS ? (
                <button
                  type="button"
                  onClick={() => setPosts((current) => [...current, { url: '', text: '' }])}
                  disabled={!allAgreed}
                  style={{
                    marginTop: 10,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: `1px solid ${t.BORDER_SOLID}`,
                    color: t.SUBTLE,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: allAgreed ? 'pointer' : 'not-allowed',
                    opacity: allAgreed ? 1 : 0.6,
                  }}
                >
                  Add another post
                </button>
              ) : null}

              {!allAgreed ? (
                <p style={{ ...bodyStyle(t), marginTop: 10, marginBottom: 0 }}>
                  Tick all six consent lines above to add your posts.
                </p>
              ) : null}
            </>
          )}

          {error ? (
            <p role="alert" style={{ fontSize: 14, color: '#F87171', marginTop: 12, marginBottom: 0 }}>{error}</p>
          ) : null}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSend || submitting}
            style={{
              marginTop: 14,
              padding: '12px 18px',
              borderRadius: 10,
              background: canSend ? `${t.ACCENT}33` : `${t.ACCENT}22`,
              border: `1px solid ${t.ACCENT}66`,
              color: t.ACCENT,
              fontSize: 15,
              fontWeight: 700,
              cursor: !canSend || submitting ? 'not-allowed' : 'pointer',
              opacity: canSend ? 1 : 0.6,
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
            {receipt.kind === 'export' ? (
              receipt.discardedSections.length > 0 ? (
                <p style={{ ...bodyStyle(t), marginBottom: 0 }}>
                  Deleted on arrival, before anyone opened the file: {receipt.discardedSections.join(', ')}.
                  The .zip itself was not stored.
                </p>
              ) : (
                <p style={{ ...bodyStyle(t), marginBottom: 0 }}>The .zip itself was not stored.</p>
              )
            ) : (
              <p style={{ ...bodyStyle(t), marginBottom: 0 }}>
                Only what you pasted was kept — nothing else from your account was read or stored.
              </p>
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
const fieldStyle = (t: ReturnType<typeof getComicTokens>): React.CSSProperties => ({
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 10,
  background: t.INPUT_BG,
  border: `1px solid ${t.BORDER_SOLID}`,
  color: t.TITLE,
  fontSize: 14,
});
const bodyStyle = (t: ReturnType<typeof getComicTokens>): React.CSSProperties => ({
  fontSize: 14,
  lineHeight: 1.65,
  color: t.TEXT,
  marginTop: 0,
  marginBottom: 10,
});
