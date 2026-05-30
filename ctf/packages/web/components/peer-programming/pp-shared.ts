// Shared constants, types, and helpers for the Peer Programming web shell.
// Palette/layout derive from design/.../survivor-hub/PeerProgramming.tsx.

export const COLOR = "#8B5CF6";
export const BG = "#0F1117";

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
}

export interface Message {
  id: string;
  author?: string;
  authorId?: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type Tab = "cohorts" | "session" | "chat";

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
