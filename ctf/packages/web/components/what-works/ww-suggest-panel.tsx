'use client';

// Add-item / suggest form from design/.../survivor-hub/WhatWorksEmpty.tsx. In this app a
// suggestion is reviewed before it joins the shared list, so the submit + success copy is
// review-honest (the mockup's "added" framing assumes immediate publish).
import { useState, type CSSProperties, type ReactNode } from 'react';
import { ListChecks, Plus, ExternalLink, Send, CheckCircle, Tag, ChevronDown, ChevronLeft } from 'lucide-react';
import { BackChevronButton } from '@/lib/nav/back-history';
import { useTheme } from '@/hooks/useTheme';
import { getWhatWorksTokens, type SuggestDraft, type WhatWorksProblemOption, type WhatWorksTokens } from './ww-shared';
import { WhatWorksSuggestGuidance } from './ww-suggest-guidance';

type Props = {
  problems: WhatWorksProblemOption[];
  isFirst: boolean;
  onSubmit: (draft: SuggestDraft) => Promise<string | null>;
  onBack?: () => void;
};

const makeInputStyle = (t: WhatWorksTokens): CSSProperties => ({
  flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: t.TITLE, fontFamily: 'inherit',
});

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: t.SUBTLE, display: 'block', marginBottom: 8 }}>
        {label} {required ? <span style={{ color: t.ACCENT }}>*</span> : null}
      </label>
      {children}
    </div>
  );
}

// Success confirmation shown after a suggestion is submitted for review.
function SuggestSuccess({ t, onBack, onAddAnother }: { t: WhatWorksTokens; onBack?: () => void; onAddAnother: () => void }) {
  return (
    <div style={{ width: '100%', height: '100dvh', maxHeight: '100%', background: t.BG, fontFamily: "'Inter',system-ui", color: t.TITLE, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ maxWidth: 460, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '0 32px' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle size={34} color={t.ACCENT} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 800 }}>Suggestion submitted 🎉</div>
        <div style={{ fontSize: 14, color: t.MUTED, lineHeight: 1.7 }}>A reviewer will check it before it joins the shared list. Each tool you add helps the next survivor find what works faster.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onAddAnother} style={{ padding: '12px 24px', borderRadius: 10, background: t.ACCENT, border: 'none', color: '#0A0E06', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Plus size={15} /> Add another
          </button>
          {onBack ? (
            <button onClick={onBack} style={{ padding: '12px 24px', borderRadius: 10, background: t.BORDER, border: `1px solid ${t.BORDER_SOLID}`, color: t.TITLE, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Back to list
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Submit button — the shared "active" look is derived once from ready + submitting.
function SuggestSubmitButton({ t, ready, submitting }: { t: WhatWorksTokens; ready: boolean; submitting: boolean }) {
  const active = ready && !submitting;
  return (
    <button type="submit" disabled={!ready || submitting}
      style={{ padding: '14px', borderRadius: 12, background: active ? t.ACCENT : t.BORDER, border: 'none', color: active ? '#0A0E06' : t.MUTED, fontSize: 15, fontWeight: 700, cursor: active ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <Send size={16} /> {submitting ? 'Submitting…' : 'Submit for review'}
    </button>
  );
}

type SuggestFormProps = {
  t: WhatWorksTokens;
  inputStyle: CSSProperties;
  problems: WhatWorksProblemOption[];
  isFirst: boolean;
  error: string | null;
  problemId: string;
  setProblemId: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  link: string;
  setLink: (value: string) => void;
  why: string;
  setWhy: (value: string) => void;
  ready: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onBack?: () => void;
};

// The suggest layout: header bar, the entry form, and the guidance panel.
function SuggestForm({ t, inputStyle, problems, isFirst, error, problemId, setProblemId, name, setName, link, setLink, why, setWhy, ready, submitting, onSubmit, onBack }: SuggestFormProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxHeight: '100%', background: t.BG, fontFamily: "'Inter',system-ui", color: t.TITLE, overflow: 'hidden' }}>
      <div style={{ height: 56, borderBottom: `1px solid ${t.BORDER_SOLID}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, background: t.HEADER, flexShrink: 0 }}>
        <BackChevronButton accent={t.ACCENT} size={36} />
        <ListChecks size={18} color={t.ACCENT} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>What Works</div>
          <div style={{ fontSize: 12, color: t.MUTED }}>Add a survivor-verified tool to the shared list</div>
        </div>
        {onBack ? (
          <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, color: t.SUBTLE, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            <ChevronLeft size={14} /> Back to list
          </button>
        ) : null}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', padding: '24px 16px', gap: 24 }}>
        <div style={{ flex: 1, maxWidth: 540 }}>
          <div style={{ marginBottom: 26 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <ListChecks size={26} color={t.ACCENT} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>
              {isFirst ? 'The list is empty — add what worked first.' : 'Suggest a tool that worked.'}
            </div>
            <div style={{ fontSize: 14, color: t.MUTED, lineHeight: 1.7 }}>
              Pick the problem your product solves, then add a specific item that worked for you — with a direct purchase link and a short note on why. Example: <span style={{ color: '#C4CAD3' }}>“Noise &amp; Verbal Harassment”</span> → a pair of noise-cancelling headphones.
            </div>
          </div>

          {error ? (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fecaca', fontSize: 13 }}>{error}</div>
          ) : null}

          <form
            onSubmit={(event) => { event.preventDefault(); onSubmit(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <Field label="Problem it solves" required>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: t.INPUT_BG, border: `1px solid ${problemId ? t.ACCENT + '50' : t.BORDER_SOLID}`, borderRadius: 12 }}>
                <Tag size={14} color={t.MUTED} style={{ flexShrink: 0 }} />
                <select value={problemId} onChange={(event) => setProblemId(event.target.value)} style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', color: problemId ? t.TITLE : t.MUTED }}>
                  <option value="" disabled>Choose an existing problem…</option>
                  {problems.map((problem) => (
                    <option key={problem.id} value={problem.id} style={{ background: '#11141B', color: t.TITLE }}>{problem.title}</option>
                  ))}
                </select>
                <ChevronDown size={15} color={t.MUTED} style={{ flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: 11, color: t.MUTED, marginTop: 6, lineHeight: 1.5 }}>Pick an existing problem. New problems are added by admins to avoid duplicates.</div>
            </Field>

            <Field label="Product name" required>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Sony WH-1000XM5 Headphones" style={{ ...inputStyle, padding: '11px 14px', background: t.INPUT_BG, border: `1px solid ${name ? t.ACCENT + '50' : t.BORDER_SOLID}`, borderRadius: 12, boxSizing: 'border-box', width: '100%' }} />
            </Field>

            <Field label="Direct purchase link" required>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: t.INPUT_BG, border: `1px solid ${link ? t.ACCENT + '50' : t.BORDER_SOLID}`, borderRadius: 12 }}>
                <ExternalLink size={14} color={t.MUTED} style={{ flexShrink: 0 }} />
                <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" style={inputStyle} />
              </div>
            </Field>

            <Field label="Why it works (optional)">
              <textarea value={why} onChange={(event) => setWhy(event.target.value)} rows={3} placeholder="A short note from your experience — what it actually solved." style={{ ...inputStyle, padding: '11px 14px', background: t.INPUT_BG, border: `1px solid ${t.BORDER_SOLID}`, borderRadius: 12, boxSizing: 'border-box', width: '100%', resize: 'none', lineHeight: 1.5 }} />
            </Field>

            <SuggestSubmitButton t={t} ready={ready} submitting={submitting} />
          </form>
        </div>

        <WhatWorksSuggestGuidance />
      </div>
    </div>
  );
}

export function WhatWorksSuggestPanel({ problems, isFirst, onSubmit, onBack }: Props) {
  const { theme } = useTheme();
  const t = getWhatWorksTokens(theme);
  const inputStyle = makeInputStyle(t);
  const [problemId, setProblemId] = useState('');
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [why, setWhy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = Boolean(problemId.trim() && name.trim() && link.trim());

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
    return <SuggestSuccess t={t} onBack={onBack} onAddAnother={() => setAdded(false)} />;
  }

  return (
    <SuggestForm
      t={t}
      inputStyle={inputStyle}
      problems={problems}
      isFirst={isFirst}
      error={error}
      problemId={problemId}
      setProblemId={setProblemId}
      name={name}
      setName={setName}
      link={link}
      setLink={setLink}
      why={why}
      setWhy={setWhy}
      ready={ready}
      submitting={submitting}
      onSubmit={() => void submit()}
      onBack={onBack}
    />
  );
}
