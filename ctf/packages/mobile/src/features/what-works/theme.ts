// What Works accent inks that have no flat theme token — kept raw on purpose.
// Chrome colours (bg / surface / border / text / subtle) now come from the shared
// ThemeTokens via useTheme(), and the lime accent comes from getAppAccent('what-works', theme).
// Only the two colours below have no token counterpart, so they stay here as constants.
export const WW = {
  /** Dark ink for text on the lime accent — contrast-pinned to the accent, no flat token. */
  brandInk: '#0A0E06',
  /** Survivor quote text — no flat token, kept raw. */
  quote: '#C4CAD3',
};
