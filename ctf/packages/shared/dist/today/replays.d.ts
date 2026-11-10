export declare const SE_REPLAY_ROTATION_START = "2026-11-03";
export type SeReplayRef = {
    id: string;
    broadcastIso: string;
};
export declare function seReplayIsRecent(replay: SeReplayRef, day: string): boolean;
export declare function seArchiveReplayForDay<T extends SeReplayRef>(replays: readonly T[], day: string): T | null;
export declare function seReplayBroadcastLine(iso: string): string;
