'use client';

import { BookOpen, ShieldCheck, PenLine, KeyRound } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { getComicTokens } from './comic-shared';

// The signed-out landing page for the knowledge library.
//
// Every other plugin has one; this one carries more weight, because it is the page the invitation
// post links to from Quora. Most people who open it will not have an account, and what they read
// here decides whether they make one.
//
// It answers three questions in order — what is this, what happens to my writing, what do I get —
// because those are the three a survivor asks before handing anything over, and the second one is
// the one that decides it.

export function ComicKnowledgePublicShell({ signInUrl }: { signInUrl: string }) {
  const { theme } = useTheme();
  const t = getComicTokens(theme);

  return (
    <main style={{ minHeight: '100dvh', background: t.BG, color: t.TITLE, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <BookOpen size={22} color={t.ACCENT} />
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Knowledge library</h1>
        </div>

        <p style={{ fontSize: 16, lineHeight: 1.65, color: t.TEXT }}>
          Ask a commercial chat bot about organized stalking and you get the institutional line: deny,
          deflect, call the authorities. So I built one differently — self-hosted, and answering only
          from what our own community has written.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.65, color: t.TEXT }}>
          Right now it knows one person&apos;s experience. Yours is different, and the next person
          asking for help at 3am deserves both.
        </p>

        <section style={cardStyle(t)}>
          <h2 style={cardTitleStyle}>
            <PenLine size={16} color={t.ACCENT} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            What you would be lending
          </h2>
          <p style={bodyStyle(t)}>
            Your own public Quora posts about what you have lived through and — the part that actually
            helps someone — <strong>how you manage it</strong>. What you tried, what failed, what you
            would tell someone in their first year.
          </p>
          <p style={{ ...bodyStyle(t), marginBottom: 0 }}>
            You pick the posts. Most people write about all sorts of things, and only you can say
            which of yours belong here.
          </p>
        </section>

        <section style={{ ...cardStyle(t), borderColor: `${t.ACCENT}55` }}>
          <h2 style={cardTitleStyle}>
            <ShieldCheck size={16} color={t.ACCENT} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            What happens to it
          </h2>
          <ul style={{ ...bodyStyle(t), paddingLeft: 18, margin: 0 }}>
            <li style={{ marginBottom: 10 }}>
              Only what you choose. Nothing private, ever — and if you send a whole Quora export
              instead, your messages and drafts are deleted automatically on arrival, before a person
              opens it.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong>You can take it back.</strong> Your words go into a table the assistant searches,
              not into a trained model — so withdrawing actually removes them. A bot trained the usual
              way could not honestly promise that.
            </li>
            <li style={{ marginBottom: 10 }}>
              A person reads everything before it is used, and not everything is used. No answer
              reaches a member without a human reviewing it first.
            </li>
            <li style={{ marginBottom: 0 }}>
              You keep every right to your own writing. You are lending it, not signing it over.
            </li>
          </ul>
        </section>

        <section style={cardStyle(t)}>
          <h2 style={cardTitleStyle}>
            <KeyRound size={16} color={t.ACCENT} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            It also gets you in
          </h2>
          <p style={{ ...bodyStyle(t), marginBottom: 0 }}>
            Joining asks for your Quora profile so it can be checked you are a real person. If you
            contribute, that check happens on the writing you send — one step instead of two. An
            accepted contribution also earns a ServiceCredits grant: an internal credits unit inside
            this app, not money, and never cashable — but real inside the app, where members exchange
            credits for things they need: rides, housing stays, repairs, training, and more.
          </p>
        </section>

        <a
          href={signInUrl}
          style={{
            display: 'block',
            marginTop: 20,
            padding: '15px',
            borderRadius: 12,
            background: t.ACCENT,
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Join Skills Economy — Free
        </a>
        <p style={{ fontSize: 13, color: t.MUTED, textAlign: 'center', marginTop: 10 }}>
          Already have an account? <a href={signInUrl} style={{ color: t.ACCENT }}>Sign in</a> to
          contribute.
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
