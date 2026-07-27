// Shared constants, types, and helpers for the PeerProgramming web shell.
// Palette/layout derive from design/.../survivor-hub/PeerProgramming.tsx.

import { getAppAccent, type ThemeName } from "@/lib/theme/theme-tokens";
import { getPluginShellTokens, type PluginShellTokens } from "@/components/shared/plugin-shell-theme";

export const COLOR = "#16A34A";
export const BG = "#0F1117";

// Theme-aware chrome tokens for the PeerProgramming shell. The shell paints its accent as the
// solid #8B5CF6 and as rgba(139,92,246,…) tints; the default theme returns those exact strings
// so it renders identically when the comic toggle is off. Comic uses the shared comic surface
// tokens plus the PeerProgramming comic-ink accent (as solid + matching alpha tints).
export type PeerProgrammingTokens = PluginShellTokens & {
  ACCENT_TINT_BG: string; // link/tab background tint (default 0.12)
  ACCENT_TINT_BORDER: string; // link icon border tint (default 0.3)
  ACCENT_TAB_BORDER: string; // active tab border tint (default 0.4)
};

export function getPeerProgrammingTokens(theme: ThemeName): PeerProgrammingTokens {
  if (theme === "comic") {
    const accent = getAppAccent("peer-programming", "comic");
    return {
      ...getPluginShellTokens(accent, theme),
      ACCENT_TINT_BG: `${accent}1F`,
      ACCENT_TINT_BORDER: `${accent}4D`,
      ACCENT_TAB_BORDER: `${accent}66`,
    };
  }
  return {
    ...getPluginShellTokens(COLOR, theme),
    ACCENT_TINT_BG: "rgba(139,92,246,0.12)",
    ACCENT_TINT_BORDER: "rgba(139,92,246,0.3)",
    ACCENT_TAB_BORDER: "rgba(139,92,246,0.4)",
  };
}

export interface Participant {
  id: string;
  name: string;
}

export interface Room {
  id: string;
  name?: string;
  cohortId?: string;
  participants?: Participant[];
  topic?: string;
  status?: string;
  // True when the open cohort has ended — the Direct Line is read-only (no composer).
  ended?: boolean;
}

export interface Message {
  id: string;
  // Required so every callsite must resolve a display name (mapMessages sets it from the cohort
  // roster or a short id fallback); prevents the chat silently rendering "Anonymous" for messages.
  author: string;
  authorId: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type Tab = "cohorts" | "session" | "chat";

// How the viewer relates to the cohort they currently have open (mirrors the room API).
export type RoomAccess = "member" | "admin" | "listener";

// One running cohort for the week, as shown in the "listen in" / admin list.
export interface CohortSummary {
  id: string;
  cohortLabel: string;
  memberCount: number;
  fallbackOpen: boolean;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
