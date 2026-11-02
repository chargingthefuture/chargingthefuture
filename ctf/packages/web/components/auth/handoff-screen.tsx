'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth, useSignIn } from '@clerk/nextjs';

// Spends the one-time sign-in token the Android app put after the # and opens the page asked for.
// The token is removed from the address at once, so it is not kept in the browser's history. A
// browser already signed in goes straight on; a token that fails shows why and a way to sign in.

function readHandoff(): { ticket: string | null; next: string } {
  const ticket = new URLSearchParams(window.location.hash.slice(1)).get('ticket');
  const next = new URLSearchParams(window.location.search).get('next') ?? '/';
  const safe = next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/';
  window.history.replaceState(null, '', window.location.pathname);
  return { ticket, next: safe };
}

function go(url: string) {
  window.location.replace(url);
}

export function HandoffScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);
  const handoff = useRef<{ ticket: string | null; next: string } | null>(null);

  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    handoff.current = readHandoff();
    const { ticket, next } = handoff.current;
    if (isSignedIn) return go(next);
    if (!ticket) return setProblem('This link has no sign-in in it.');
    void (async () => {
      const { error } = await signIn.ticket({ ticket });
      if (error) return setProblem(`The sign-in link did not work: ${error.message}.`);
      if (signIn.status !== 'complete') return setProblem('The sign-in link needs another step that this page cannot do.');
      const done = await signIn.finalize({ navigate: ({ decorateUrl }) => go(decorateUrl(next)) });
      if (done.error) setProblem(`Signed in, but the session could not start: ${done.error.message}.`);
    })();
  }, [isLoaded, isSignedIn, signIn]);

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
      {problem ? (
        <>
          <p role="alert">{problem} The link lasts one minute and works once; open the page from the app again.</p>
          <p>
            <a href={handoff.current?.next ?? '/'}>Open the page and sign in here instead</a>
          </p>
        </>
      ) : (
        <p>Signing you in…</p>
      )}
    </main>
  );
}
