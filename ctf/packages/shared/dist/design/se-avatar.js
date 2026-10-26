// Generated avatars for 3.1.0. Every member's picture is a pattern drawn from a hash of their account
// id, so no uploaded photo is ever shown or stored, and the same account gets the same picture on
// web and Android. Drawn on a 40 x 40 square: a background, then one shape, turned by `rotate`.
export const SE_AVATAR_VIEWBOX = 40;
// Background and shape colors in pairs, taken from the card accents and the four theme colors.
const SE_AVATAR_PAIRS = [
    ['#4f6b4a', '#f6efe8'],
    ['#3c5a74', '#f0a39a'],
    ['#c4566c', '#fffaf6'],
    ['#9c7631', '#2a1a1d'],
    ['#1f4a37', '#e3b74f'],
    ['#6b1f2e', '#f2c46d'],
    ['#2d6b70', '#c9b6f0'],
    ['#6a4c8c', '#f6efe8'],
];
const SE_AVATAR_SHAPES = [
    'M20 20h20v20H20zM0 0h20v20H0z',
    'M20 6L34 20L20 34L6 20Z',
    'M8 26l12-12l12 12v7l-12-12l-12 12z',
    'M0 12h40v6H0zM0 24h40v6H0z',
    'M20 8a12 12 0 1 1 0 24a12 12 0 1 1 0-24z',
    'M0 0h40L0 40z',
    'M6 6h12v12H6zM22 22h12v12H22zM22 6h12v12H22z',
    'M20 4L36 34H4z',
];
const ROTATIONS = [0, 90, 180, 270];
// FNV-1a, 32 bit. Stable across runtimes, which is all this needs; it is not a security hash.
function hash32(value) {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}
export function seAvatar(accountId) {
    const h = hash32(accountId);
    const [bg, fg] = SE_AVATAR_PAIRS[h % SE_AVATAR_PAIRS.length];
    const d = SE_AVATAR_SHAPES[(h >>> 8) % SE_AVATAR_SHAPES.length];
    const rotate = ROTATIONS[(h >>> 16) % ROTATIONS.length];
    return { bg, fg, d, rotate };
}
// The same picture as an SVG document, for places that take an image address rather than markup
// (Clerk's account button). Every value in it comes from the fixed lists above, never from input.
export function seAvatarSvg(accountId) {
    const { bg, fg, d, rotate } = seAvatar(accountId);
    const v = SE_AVATAR_VIEWBOX;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v} ${v}"><rect width="${v}" height="${v}" fill="${bg}"/><path d="${d}" fill="${fg}" transform="rotate(${rotate} ${v / 2} ${v / 2})"/></svg>`;
}
export function seAvatarDataUri(accountId) {
    return `data:image/svg+xml,${encodeURIComponent(seAvatarSvg(accountId))}`;
}
