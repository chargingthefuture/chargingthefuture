import * as React from 'react';

// What a member sees when a page fails to render. Used by app/error.tsx (inside the root layout) and
// app/global-error.tsx (when the layout itself failed). The digest is the reference Next attaches to
// a server-side failure and also sends with the error report, so a screenshot of this screen can be
// tied to the log line. Inline styles with fallbacks, because global-error renders without the
// stylesheet the layout loads.
export function PageErrorNotice({ digest }: { digest?: string }): React.JSX.Element {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '24px 16px',
        textAlign: 'center',
        background: 'var(--ctf-bg, #0f1117)',
        color: 'var(--ctf-text, #d5d9e2)',
        fontFamily: "'Figtree Variable', system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>This page could not be shown.</h1>
      <p style={{ margin: 0, maxWidth: 360, color: 'var(--ctf-text-secondary, #9ca3af)' }}>
        Something went wrong while loading it. The error has been reported.
      </p>
      {digest ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ctf-text-secondary, #9ca3af)' }}>
          Reference: <code>{digest}</code>
        </p>
      ) : null}
      <a href="/" style={{ color: 'var(--ctf-brand, #e91e8c)', fontWeight: 600 }}>
        Go to the home page
      </a>
    </main>
  );
}
