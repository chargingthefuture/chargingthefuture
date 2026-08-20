'use client';

import { HelpCircle } from 'lucide-react';
import { getComicTokens } from './comic-shared';
import {
  QUORA_CONTACT_URL,
  QUORA_DATA_EXPORT_HELP_ATTRIBUTION,
  QUORA_DATA_EXPORT_HELP_PARAGRAPHS,
  QUORA_DATA_EXPORT_HELP_READ_ON,
  QUORA_DATA_EXPORT_HELP_TITLE,
  QUORA_DATA_EXPORT_HELP_URL,
  QUORA_PRIVACY_EMAIL,
} from '../../lib/comic/quora-export-help';

// The questions a member asks before they can send a whole Quora export: how do I get one, how long
// does it take, what do I send.
//
// Getting the archive happens entirely on Quora's side, so the answer is Quora's own instructions
// rather than ours. They are quoted in full — not linked and summarized — because help-center
// articles get renumbered, and someone who follows a dead link has no way to tell whether the
// process changed or the page simply moved. The link is still there for anyone who wants to check
// the source; the quote is what keeps this page usable when it breaks.
//
// It sits on `/knowledge` for both sending options, not only the export one: someone weighing the
// two needs to know what the export actually costs them in time before they can choose.

type ComicTokens = ReturnType<typeof getComicTokens>;

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: 'Do I need an export at all?',
    answer:
      'No. Picking a few posts is the recommended way and needs nothing from Quora — you open each post, copy the link, and paste the text. The export is for the rarer case where nearly everything you have written publicly belongs here.',
  },
  {
    question: 'How long does it take to arrive?',
    answer:
      'Quora says the archive usually reaches you within 72 hours of their team confirming they got the request. It comes to the email address on your Quora account.',
  },
  {
    question: 'What do I send once it arrives?',
    answer:
      'The file exactly as Quora sent it — the .zip, unopened. Do not unzip it and do not try to clean it out first. Your inbox messages, drafts, and profile data are stripped out on arrival here, before any person reads a word of it.',
  },
];

// The tokens come from the parent because the whole page shares one theme read.
export function QuoraExportFaqSection({ t }: { t: ComicTokens }) {
  return (
    <section style={cardStyle(t)}>
      <h2 style={cardTitleStyle}>
        <HelpCircle size={16} color={t.ACCENT} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        Getting a copy of your Quora data
      </h2>
      <p style={bodyStyle(t)}>
        Only Quora can produce your archive, and you ask them for it by hand — there is no button
        here that fetches it. Their instructions are quoted in full below, so this page still works if
        their help page moves.
      </p>

      <QuotedHelpArticle t={t} />

      <p style={{ ...bodyStyle(t), marginTop: 14 }}>
        In plain words: email{' '}
        <a href={`mailto:${QUORA_PRIVACY_EMAIL}`} style={linkStyle(t)}>
          {QUORA_PRIVACY_EMAIL}
        </a>{' '}
        and ask for a copy of your data, or open{' '}
        <a href={QUORA_CONTACT_URL} target="_blank" rel="noopener noreferrer" style={linkStyle(t)}>
          quora.com/contact
        </a>{' '}
        and choose <strong>I want a copy of my data</strong>. Ask from the account the writing is on,
        because the archive is sent to that account&apos;s email address.
      </p>

      {FAQ_ITEMS.map((item) => (
        <div key={item.question} style={{ borderTop: `1px solid ${t.BORDER}`, paddingTop: 12, marginTop: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: t.TITLE }}>{item.question}</h3>
          <p style={{ ...bodyStyle(t), marginBottom: 0 }}>{item.answer}</p>
        </div>
      ))}
    </section>
  );
}

// The quote itself, marked up as a quotation with its source so it is never mistaken for our own
// wording — these are Quora's terms, not ours, and we cannot change what they will do.
function QuotedHelpArticle({ t }: { t: ComicTokens }) {
  return (
    <blockquote
      cite={QUORA_DATA_EXPORT_HELP_URL}
      style={{
        margin: 0,
        padding: '12px 14px',
        borderRadius: 10,
        background: `${t.ACCENT}10`,
        borderLeft: `3px solid ${t.ACCENT}`,
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, margin: '0 0 8px' }}>
        {QUORA_DATA_EXPORT_HELP_TITLE}
      </p>
      {QUORA_DATA_EXPORT_HELP_PARAGRAPHS.map((paragraph) => (
        <p key={paragraph} style={{ ...bodyStyle(t), fontStyle: 'italic' }}>
          {paragraph}
        </p>
      ))}
      <footer style={{ fontSize: 12, lineHeight: 1.55, color: t.MUTED }}>
        {QUORA_DATA_EXPORT_HELP_ATTRIBUTION} — Quora Help Center, read {QUORA_DATA_EXPORT_HELP_READ_ON}.{' '}
        <a href={QUORA_DATA_EXPORT_HELP_URL} target="_blank" rel="noopener noreferrer" style={linkStyle(t)}>
          Open the original page
        </a>
      </footer>
    </blockquote>
  );
}

const cardStyle = (t: ComicTokens): React.CSSProperties => ({
  marginTop: 18,
  borderRadius: 14,
  background: t.HEADER,
  border: `1px solid ${t.BORDER_SOLID}`,
  padding: 18,
});
const cardTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '0 0 10px' };
const bodyStyle = (t: ComicTokens): React.CSSProperties => ({
  fontSize: 14,
  lineHeight: 1.65,
  color: t.TEXT,
  marginTop: 0,
  marginBottom: 10,
});
const linkStyle = (t: ComicTokens): React.CSSProperties => ({ color: t.ACCENT, fontWeight: 600 });
