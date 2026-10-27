import type { CSSProperties } from 'react';
import { seTheme, type SeThemeColor, type SeThemeMode } from '@ctf/shared';

// The 3.1 theme as CSS custom properties on the frame's root, so the stylesheet reads one set of
// names whichever color and mode the member picks.
export function seThemeVars(color?: SeThemeColor, mode?: SeThemeMode): CSSProperties {
  const t = seTheme(color, mode);
  const vars: Record<string, string> = {
    '--se-bg': t.bg,
    '--se-card': t.card,
    '--se-sunk': t.sunk,
    '--se-ink': t.ink,
    '--se-soft': t.soft,
    '--se-hair': t.hair,
    '--se-line': t.line,
    '--se-hero': t.hero,
    '--se-on-hero': t.onHero,
    '--se-pick': t.pick,
    '--se-btn': t.btn,
    '--se-on-btn': t.onBtn,
    '--se-live': t.live,
    '--se-live-badge': t.liveBadge,
    '--se-on-live-badge': t.onLiveBadge,
  };
  for (const [kind, value] of Object.entries(t.kind)) vars[`--se-kind-${kind}`] = value;
  return vars as CSSProperties;
}
