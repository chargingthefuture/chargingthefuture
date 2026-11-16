import type { CSSProperties } from 'react';
import type { PluginShellTokens } from './plugin-shell-theme';

// A 3.0 plugin's shell tokens as --c30-* custom properties, for the shared pieces a 3.0 screen
// shows (a card's conversation, the share picture sheet, What Works' add and review screens) so
// they are drawn in that screen's own look and never in the 3.1 one.
export function classicLookVars(look: PluginShellTokens): CSSProperties {
  return {
    '--c30-accent': look.ACCENT,
    '--c30-bg': look.BG,
    '--c30-text': look.TEXT,
    '--c30-title': look.TITLE,
    '--c30-subtle': look.SUBTLE,
    '--c30-border': look.BORDER_STRONG,
    '--c30-border-hi': look.BORDER_HI,
    '--c30-input': look.INPUT_BG,
    '--c30-surface': look.SURFACE,
  } as CSSProperties;
}
