'use client';

import { useEffect } from 'react';

// The app's root loading.tsx means a fresh load of /guide#workforce paints a
// loading screen first and streams the guide in after. The browser performs
// its jump-to-anchor exactly once, at document load — before the target
// section exists — so every deep link from the blog landed at the top of the
// guide. This re-runs that jump once the guide content is actually mounted.
// The retry loop covers the gap between this component hydrating and the
// browser finishing layout; it stops as soon as the jump happens.
export function ScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return undefined;

    let canceled = false;
    const deadline = Date.now() + 3000;

    const attempt = () => {
      if (canceled) return;
      let target: Element | null = null;
      try {
        target = document.getElementById(decodeURIComponent(hash.slice(1)));
      } catch {
        return; // malformed hash — nothing to scroll to
      }
      if (target) {
        target.scrollIntoView();
        return;
      }
      if (Date.now() < deadline) {
        requestAnimationFrame(attempt);
      }
    };

    attempt();
    return () => {
      canceled = true;
    };
  }, []);

  return null;
}
