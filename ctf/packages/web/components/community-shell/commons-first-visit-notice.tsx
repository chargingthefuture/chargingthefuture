'use client';

import { useCallback, useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import styles from './community-shell.module.css';
import { NoticeParagraphs } from './notice-paragraphs';

// The one notice a member is shown on arrival rather than waiting for the rotation.
//
// The three standing Commons notices go out on a cadence, which is right for two of them: nobody is
// harmed by learning the topic rule on their fifth visit. This one is different. It says the room is
// readable by anyone, including people with no account — and a member who does not know that can post
// something identifying long before their first cadence hit arrives. Cadence cannot fix a risk that
// lands on the first post; only showing it up front can.
//
// Deliberately an inline card at the top of the stream, not a modal. A modal over a support channel
// trains people to dismiss without reading, and the members here have every reason to be wary of a
// box that appears over the content demanding a click.
//
// It must stay SHORT and it must never scroll. The card is a flex child of a fixed-height column whose
// message list is the flexible part; a tall card steals that space, pushes the header off screen, and
// leaves the member scrolling the CONVERSATION to get past the notice — into empty space below it. So:
// `flex: 0 0 auto` (never grow, never shrink into a scroller), no internal overflow, and short copy
// held separately from the standing notice, which is free to be long because it scrolls with the chat.

export function CommonsFirstVisitNotice() {
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    let canceled = false;
    void (async () => {
      try {
        const res = await fetch('/api/hub/first-visit-notice', { cache: 'no-store' });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; show?: boolean; title?: string; body?: string }
          | null;
        if (!canceled && res.ok && data?.ok && data.show && data.title && data.body) {
          setNotice({ title: data.title, body: data.body });
        }
      } catch {
        // Silent: a notice that cannot load is not worth an error in front of a member.
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const dismiss = useCallback(async () => {
    setDismissing(true);
    // Hidden immediately, recorded in the background. If the write fails the member sees it once more
    // on a later visit, which is a far smaller harm than a card that will not go away.
    setNotice(null);
    try {
      await fetch('/api/hub/first-visit-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch {
      // Deliberately swallowed — see above.
    } finally {
      setDismissing(false);
    }
  }, []);

  if (!notice) return null;

  // Uses the shell's own alert styling rather than hand-rolled colors: it must look like part of the
  // Commons, and the theme here is 'default' | 'comic', not light/dark, so picking colors by theme
  // name would have been wrong in the comic theme.
  return (
    <section
      aria-label={notice.title}
      className={styles.usernameAlert}
      // Never grows, never becomes its own scroller. See the note at the top of this file.
      style={{ flex: '0 0 auto', overflow: 'visible' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Info size={15} aria-hidden="true" />
        <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, flex: 1 }}>{notice.title}</h2>
        <button
          type="button"
          onClick={() => void dismiss()}
          disabled={dismissing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8,
            background: 'transparent', border: '1px solid currentColor', color: 'inherit', fontSize: 12,
            fontWeight: 600, cursor: dismissing ? 'not-allowed' : 'pointer', opacity: dismissing ? 0.6 : 1,
          }}
        >
          <X size={12} aria-hidden="true" /> Got it
        </button>
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
        <NoticeParagraphs body={notice.body} />
      </div>
    </section>
  );
}
