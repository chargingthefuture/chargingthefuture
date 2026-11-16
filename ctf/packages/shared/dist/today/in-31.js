// 3.1 never opens a 3.0 page (owner decision, 2026-11-16). A link that only leads somewhere to read
// more is dropped when it points at an address inside this app that is not a 3.1 screen. Addresses
// on other sites (the blog, a recording) are not 3.0 pages and stay.
const SCREENS_31 = new Set(['/', '/today', '/games']);
export function seOpens30Page(href) {
    if (!href.startsWith('/') || href.startsWith('//'))
        return false;
    const path = href.split(/[?#]/)[0];
    return !SCREENS_31.has(path);
}
