// A 3.0 plugin's own shell tokens, as the plugin screens hold them (PPTokens and the like), for the
// shared pieces a 3.0 screen shows: a card's conversation and the share picture sheet. They are
// drawn with these so a 3.0 screen never shows the 3.1 look; the Android copy of the web's
// components/shared/classic-look-vars.ts. `r` squares corners in the comic theme.

export type ClassicLook = {
  ACCENT: string;
  BG: string;
  TEXT: string;
  TITLE: string;
  SUBTLE: string;
  BORDER_STRONG: string;
  BORDER_HI: string;
  INPUT_BG: string;
  SURFACE: string;
  r: (_radius: number) => number;
};
