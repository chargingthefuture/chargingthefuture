// What only Weavers of the Commons badge holders may do (3.1 plan, Access): bring people into rooms,
// and put pictures and links in posts. Everybody else sees the line that says so where the action
// would be, and the server refuses it with the same words.
export const SE_WEAVERS_LIMIT_WORDS = {
    rule: 'Bringing people into rooms, and pictures and links in posts, are for Weavers of the Commons.',
    bring: 'Bringing people into rooms is for Weavers of the Commons.',
    picture: 'Pictures in posts are for Weavers of the Commons.',
    link: 'Links in posts are for Weavers of the Commons. Take the link out to post this.',
};
const LINK = /(?:https?:\/\/|www\.)\S|\b[a-z0-9][a-z0-9-]*\.(?:com|org|net|io|co|me|app|ly|gl|gg|tv|info|biz|us|uk|ca|xyz|link|page|site|dev)\b(?:\/|\s|$)/i;
// Whether text carries a link: an address with http(s):// or www., or a bare common web address.
export function seHasLink(text) {
    return LINK.test(text);
}
