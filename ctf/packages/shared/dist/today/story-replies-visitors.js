// Visitors may read my replies on members' stories (owner decision, 2026-11-16). A member agrees once,
// in Settings, that what they write in the conversation on a member's story can be read by visitors
// without an account. The server keeps the version of these words and when they agreed; turning it
// off clears both and hides their replies from visitors at once. Only replies written since they
// agreed are shown: what they wrote before was written for members. Shared by web and Android.
// The version of the words below. A new wording gets a new version; only versions listed in
// SE_STORY_REPLIES_VISITORS_VERSIONS show a member's replies to visitors.
export const SE_STORY_REPLIES_VISITORS_VERSION = '2026-11-16';
export const SE_STORY_REPLIES_VISITORS_VERSIONS = [SE_STORY_REPLIES_VISITORS_VERSION];
export const SE_STORY_REPLIES_VISITORS_WORDS = {
    title: "Replies on members' stories",
    toggle: "Visitors can read what I write on members' stories",
    hint: "When this is on, people without an account can read what you write from now on in the conversation under a member's story, with your username. What you wrote before stays for members. Turn it off at any time and visitors stop seeing all of it at once.",
    failed: 'Not changed:',
};
