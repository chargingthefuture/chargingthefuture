import type { CSSProperties } from 'react';

// The 3.1 pill for a ShareLink trigger. ShareLink sets its trigger's look inline, so the pill is
// passed back inline too; the focus ring stays in the stylesheet (the .pill class).
export const SE_PILL_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  width: 'auto',
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 999,
  border: '1.5px solid var(--se-line)',
  background: 'var(--se-card)',
  color: 'var(--se-ink)',
  fontSize: 13,
  fontWeight: 600,
  boxShadow: '0 2px 0 var(--se-line)',
};
