'use client';

// Add-item / suggest form from design/.../survivor-hub/WhatWorksEmpty.tsx. In this app a
// suggestion is reviewed before it joins the shared list, so the submit + success copy is
// review-honest (the mockup's "added" framing assumes immediate publish).
import { useState, type CSSProperties, type ReactNode } from 'react';
import { ListChecks, Plus, ExternalLink, Send, CheckCircle, Tag, ChevronDown, ChevronLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BG, BRAND, BORDER, SUBTLE, TEXT, type SuggestDraft, type WhatWorksProblemOption } from './ww-shared';
import { WhatWorksSuggestGuidance } from './ww-suggest-guidance';

type Props = {
  problems: WhatWorksProblemOption[];
  isFirst: boolean;
  onSubmit: (draft: SuggestDraft) => Promise<string | null>;
  onBack?: () => void;
};

const inputStyle: CSSProperties = {
  flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#F9FAFB', fontFamily: 'inherit',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 8 }}>
        {label} {required ? <span style={{ color: BRAND }}>*</span> : null}
      </label>
      {children}
    </div>
  );
}

export function WhatWorksSuggestPanel({ problems, isFirst, onSubmit, onBack }: Props) {
  const [problemId, setProblemId] = useState('');
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [why, setWhy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const ready = problemId.trim() && name.trim() && link.trim();

  async function submit(): Promise<void> {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    const failure = await onSubmit({ problemId, name: name.trim(), purchaseUrl: link.trim(), note: why.trim() });
    setSubmitting(false);
    if (failure) {
      setError(failure);
      return;
    }
    setProblemId('');
    setName('');
    setLink('');
    setWhy('');
    setAdded(true);
  }

  if (added) {
    return (
      <div style={{ width: '100%', height: '100vh', maxHeight: '100%', background: BG, fontFamily: "'Inter',system-ui", color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ maxWidth: 460, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '0 32px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${BRAND}15`, border: `1px solid ${BRAND}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={34} color={BRAND} />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>Suggestion submitted 🎉</div>
          <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.7 }}>A reviewer will check it before it joins the shared list. Each tool you add helps the next survivor find what works faster.</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setAdded(false)} style={{ padding: '12px 24px', borderRadius: 10, background: BRAND, border: 'none', color: '#0A0E06', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Plus size={15} /> Add another
            </button>
            {onBack ? (
              <button onClick={onBack} style={{ padding: '12px 24px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`, color: TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Back to list
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100%', background: BG, fontFamily: "'Inter',system-ui", color: TEXT, overflow: 'hidden' }}>
      <div style={{ height: 56, borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 12, background: '#0D0F14', flexShrink: 0 }}>
        <ListChecks size={18} color={BRAND} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>What Works</div>
          <div style={{ fontSize: 12, color: SUBTLE }}>Add a survivor-verified tool to the shared list</div>
        </div>
        {onBack ? (
          <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, color: '#9CA3AF', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            <ChevronLeft size={14} /> Back to list
          </button>
        ) : null}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? '24px 16px' : '44px 64px', gap: isMobile ? 24 : 44 }}>
        <div style={{ flex: 1, maxWidth: 540 }}>
          <div style={{ marginBottom: 26 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${BRAND}12`, border: `1px solid ${BRAND}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <ListChecks size={26} color={BRAND} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>
              {isFirst ? 'The list is empty — add what worked first.' : 'Suggest a tool that worked.'}
            </div>
            <div style={{ fontSize: 14, color: SUBTLE, lineHeight: 1.7 }}>
              Pick the problem your product solves, then add a specific item that worked for you — with a direct purchase link and a short note on why. Example: <span style={{ color: '#C4CAD3' }}>“Noise &amp; Verbal Harassment”</span> → a pair of noise-cancelling headphones.
            </div>
          </div>

          {error ? (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fecaca', fontSize: 13 }}>{error}</div>
          ) : null}

          <form
            onSubmit={(event) => { event.preventDefault(); void submit(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <Field label="Problem it solves" required>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${problemId ? BRAND + '50' : BORDER}`, borderRadius: 12 }}>
                <Tag size={14} color={SUBTLE} style={{ flexShrink: 0 }} />
                <select value={problemId} onChange={(event) => setProblemId(event.target.value)} style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', color: problemId ? '#F9FAFB' : SUBTLE }}>
                  <option value="" disabled>Choose an existing problem…</option>
                  {problems.map((problem) => (
                    <option key={problem.id} value={problem.id} style={{ background: '#11141B', color: '#F9FAFB' }}>{problem.title}</option>
                  ))}
                </select>
                <ChevronDown size={15} color={SUBTLE} style={{ flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: 11, color: SUBTLE, marginTop: 6, lineHeight: 1.5 }}>Pick an existing problem. New problems are added by admins to avoid duplicates.</div>
            </Field>

            <Field label="Product name" required>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Sony WH-1000XM5 Headphones" style={{ ...inputStyle, padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${name ? BRAND + '50' : BORDER}`, borderRadius: 12, boxSizing: 'border-box', width: '100%' }} />
            </Field>

            <Field label="Direct purchase link" required>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${link ? BRAND + '50' : BORDER}`, borderRadius: 12 }}>
                <ExternalLink size={14} color={SUBTLE} style={{ flexShrink: 0 }} />
                <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" style={inputStyle} />
              </div>
            </Field>

            <Field label="Why it works (optional)">
              <textarea value={why} onChange={(event) => setWhy(event.target.value)} rows={3} placeholder="A short note from your experience — what it actually solved." style={{ ...inputStyle, padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 12, boxSizing: 'border-box', width: '100%', resize: 'none', lineHeight: 1.5 }} />
            </Field>

            <button type="submit" disabled={!ready || submitting}
              style={{ padding: '14px', borderRadius: 12, background: ready && !submitting ? BRAND : 'rgba(255,255,255,0.06)', border: 'none', color: ready && !submitting ? '#0A0E06' : SUBTLE, fontSize: 15, fontWeight: 700, cursor: ready && !submitting ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Send size={16} /> {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
          </form>
        </div>

        <WhatWorksSuggestGuidance />
      </div>
    </div>
  );
}
