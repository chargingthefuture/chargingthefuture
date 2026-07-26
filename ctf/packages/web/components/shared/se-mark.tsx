'use client';

import { useId } from 'react';

// Skills Economy brand mark — the "Stack" (skill progression) logo: three ascending rounded bars
// filled with the brand teal→purple gradient. Vector source: design/logo-options concept-d-stack-mark
// (Concept D, chosen 2026-07-26). Rendered inline so it stays crisp at every chip size and inherits
// no external asset. Each instance gets a unique gradient id (useId) so multiple marks on one page
// (icon rail + phone bar) don't share/clobber the <linearGradient>.
export function SeMark({ size = 40, className }: { size?: number; className?: string }) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="4 67.9 100 85"
      role="img"
      aria-label="Skills Economy"
      className={className}
    >
      <linearGradient id={gradientId} x1="11.51" x2="96.71" y1="110.4" y2="110.4" gradientUnits="userSpaceOnUse">
        <stop stopColor="#006D72" offset="0" />
        <stop stopColor="#8F4BB2" offset="1" />
      </linearGradient>
      <path
        fill={`url(#${gradientId})`}
        d="m94 105.7h-26v-7.7h25.5c1.5-0.1 3.1-1.3 3.1-3.3v-11.7c0-1.5-1.2-2.9-2.8-2.9l-22.5-0.1c-1.7 0-3.3 1.4-3.3 3.1l0.1 9.7h-24.8c-1.6 0-3 1.3-3 2.9v12.9h-25.7c-1.6 0-3.1 1.3-3.1 2.9v8.1c0 1.4 1.2 2.7 2.6 2.7h79.9c1.5 0 2.8-1.3 2.9-2.7v-11.3c-0.2-1.3-1.4-2.6-2.9-2.6zm-0.2 21.2h-79.3c-1.4 0-2.9 1.2-2.9 2.8v8.3c0 1.4 1.2 3 2.8 3h79.6c1.6 0 2.8-1.3 2.8-2.8v-8c0-1.8-1.4-3.2-3-3.3z"
      />
    </svg>
  );
}
