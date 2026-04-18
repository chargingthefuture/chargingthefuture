export declare const CHYME_STREAM_CHANNEL_ID = "chyme-main-room";
export type ChymeStreamJoinCredentials = {
    streamApiKey: string;
    streamChannelId: string;
    streamUserId: string;
    streamToken: string;
};
export declare function createChymeStreamJoinCredentials(userId: string, displayName: string): Promise<ChymeStreamJoinCredentials | null>;
export declare function sendChymeStreamMessage(input: {
    userId: string;
    displayName: string;
    text: string;
}): Promise<string | null>;
