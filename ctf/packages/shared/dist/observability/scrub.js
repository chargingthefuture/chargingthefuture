// What leaves a member's browser or phone for Sentry, shared by web and Android so the two strip the
// same things. Session Replay and error reports carry page addresses, breadcrumbs and request
// details; none of them may carry an id that points at a person, card or code, anything a member
// typed, a request body, a cookie or a sign-in header. Text on screen is masked by the replay
// settings themselves; this module covers everything else. Pure functions: nothing here logs.
export const SE_SCRUB_ID = ':id';
export const SE_SCRUB_VALUE = ':value';
export const SE_SCRUB_EMAIL = ':email';
export const SE_SCRUB_PHONE = ':phone';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Clerk's ids: user_…, org_…, sess_….
const CLERK_ID = /\b(?:user|org|sess)_[A-Za-z0-9]{8,}\b/g;
// A Today card id, `${source}:${sourceId}` (see today/cards.ts), as one address segment.
const CARD_SEGMENT = /^[a-z][a-z0-9-]{0,39}:\S+$/;
// A 10-character match or invite code: lower-case letters and digits with at least one digit, so a
// ten-letter word such as "foundation" in an address is left alone.
const CODE_SEGMENT = /^(?=[a-z0-9]*\d)[a-z0-9]{10}$/;
const DIGITS_SEGMENT = /^\d+$/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Ten or more digits with the usual separators between them.
const PHONE = /\+?\d(?:[\s().-]*\d){9,}/g;
// An attribute value inside a CSS selector, e.g. [aria-label="A name"] in a click breadcrumb.
const SELECTOR_ATTRIBUTE_VALUE = /\[([\w-]+)=(?:"[^"]*"|'[^']*'|[^\]]*)\]/g;
const ADDRESS = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)?([^?#]*)(\?[^#]*)?(#.*)?$/i;
const DROPPED_HEADERS = new Set(['cookie', 'set-cookie', 'authorization', 'proxy-authorization', 'x-csrf-token']);
const ADDRESS_HEADERS = new Set(['referer', 'referrer', 'origin']);
const BODY_KEYS = ['body', 'request_body', 'response_body', 'data', 'input', 'response'];
const ADDRESS_KEYS = ['url', 'from', 'to', 'previous', 'http.url', 'http.query', 'url.full', 'url.query'];
// Ids inside free text: UUIDs and Clerk ids anywhere in the string.
export function seScrubIds(text) {
    return text.replace(UUID, SE_SCRUB_ID).replace(CLERK_ID, SE_SCRUB_ID);
}
// Ids and contact details inside free text: an error message, a log line.
export function seScrubText(text) {
    return seScrubIds(text.replace(EMAIL, SE_SCRUB_EMAIL).replace(PHONE, SE_SCRUB_PHONE));
}
function decodeSegment(segment) {
    try {
        return decodeURIComponent(segment);
    }
    catch {
        return segment;
    }
}
function isIdSegment(segment) {
    const plain = decodeSegment(segment);
    return DIGITS_SEGMENT.test(plain) || CARD_SEGMENT.test(plain) || CODE_SEGMENT.test(plain);
}
function scrubPath(path) {
    return path
        .split('/')
        .map((segment) => (isIdSegment(segment) ? SE_SCRUB_ID : segment))
        .join('/');
}
// Keeps each key and replaces each value: `?q=abc&page=2` → `?q=:value&page=:value`.
export function seScrubQuery(query) {
    const lead = query.startsWith('?') ? '?' : '';
    const body = lead ? query.slice(1) : query;
    if (!body)
        return query;
    return lead + body
        .split('&')
        .map((pair) => {
        const at = pair.indexOf('=');
        return at < 0 || at === pair.length - 1 ? pair : `${pair.slice(0, at)}=${SE_SCRUB_VALUE}`;
    })
        .join('&');
}
// A page address, request address or route name with every id replaced by `:id` and every query
// value by `:value`: /apps/directory/profile/<uuid>?ref=x → /apps/directory/profile/:id?ref=:value.
export function seScrubAddress(address) {
    if (!address)
        return address;
    const parts = ADDRESS.exec(address);
    if (!parts)
        return seScrubIds(address);
    const [, origin = '', path = '', query = '', hash = ''] = parts;
    const scrubbedHash = hash ? `#${scrubPath(hash.slice(1))}` : '';
    return seScrubIds(origin + scrubPath(path) + (query ? seScrubQuery(query) : '') + scrubbedHash);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function scrubAddressKeys(data) {
    for (const key of ADDRESS_KEYS) {
        if (typeof data[key] === 'string')
            data[key] = seScrubAddress(data[key]);
    }
}
function dropBodies(data) {
    for (const key of BODY_KEYS)
        delete data[key];
    for (const side of ['request', 'response']) {
        const part = data[side];
        if (isRecord(part))
            delete part.body;
    }
}
const TEXT_DROPPED_CATEGORIES = new Set(['ui.input', 'console']);
// A breadcrumb with typed text and console text removed, addresses scrubbed, bodies dropped, and
// attribute values cut from click selectors. Changes the breadcrumb in place and returns it.
export function seScrubBreadcrumb(crumb) {
    const category = crumb.category ?? '';
    if (TEXT_DROPPED_CATEGORIES.has(category)) {
        delete crumb.message;
        delete crumb.data;
        return crumb;
    }
    if (typeof crumb.message === 'string') {
        const message = crumb.message.replace(SELECTOR_ATTRIBUTE_VALUE, '[$1]');
        crumb.message = category === 'navigation' ? seScrubAddress(message) : seScrubText(message);
    }
    if (isRecord(crumb.data)) {
        scrubAddressKeys(crumb.data);
        dropBodies(crumb.data);
    }
    return crumb;
}
function scrubSpan(span) {
    if (typeof span.description === 'string')
        span.description = seScrubAddress(span.description);
    if (typeof span.name === 'string')
        span.name = seScrubAddress(span.name);
    if (isRecord(span.data)) {
        scrubAddressKeys(span.data);
        dropBodies(span.data);
    }
}
// One frame Session Replay is about to record (a breadcrumb or a performance span). Other frames
// pass through unchanged.
export function seScrubReplayFrame(frame) {
    const tag = frame.data?.tag;
    const payload = frame.data?.payload;
    if (!isRecord(payload))
        return frame;
    if (tag === 'breadcrumb')
        seScrubBreadcrumb(payload);
    if (tag === 'performanceSpan')
        scrubSpan(payload);
    return frame;
}
function scrubHeaders(headers) {
    for (const name of Object.keys(headers)) {
        const lower = name.toLowerCase();
        if (DROPPED_HEADERS.has(lower))
            delete headers[name];
        else if (ADDRESS_HEADERS.has(lower) && typeof headers[name] === 'string') {
            headers[name] = seScrubAddress(headers[name]);
        }
    }
}
function scrubQueryString(query) {
    if (typeof query === 'string')
        return seScrubQuery(query);
    if (Array.isArray(query)) {
        return query.map((pair) => (Array.isArray(pair) ? [pair[0], SE_SCRUB_VALUE] : SE_SCRUB_VALUE));
    }
    if (isRecord(query)) {
        return Object.fromEntries(Object.keys(query).map((key) => [key, SE_SCRUB_VALUE]));
    }
    return query;
}
function scrubRequest(request) {
    if (typeof request.url === 'string')
        request.url = seScrubAddress(request.url);
    if (request.query_string !== undefined)
        request.query_string = scrubQueryString(request.query_string);
    delete request.cookies;
    delete request.data;
    if (isRecord(request.headers))
        scrubHeaders(request.headers);
}
function scrubExceptionValues(event) {
    const exception = event.exception;
    if (!isRecord(exception) || !Array.isArray(exception.values))
        return;
    for (const value of exception.values) {
        if (isRecord(value) && typeof value.value === 'string')
            value.value = seScrubText(value.value);
    }
}
function scrubMessages(event) {
    if (typeof event.message === 'string')
        event.message = seScrubText(event.message);
    if (isRecord(event.logentry) && typeof event.logentry.message === 'string') {
        event.logentry.message = seScrubText(event.logentry.message);
    }
    scrubExceptionValues(event);
}
function scrubList(event, key, scrub) {
    const list = event[key];
    if (!Array.isArray(list))
        return;
    for (const item of list)
        if (isRecord(item))
            scrub(item);
}
// An error, transaction or replay event just before it is sent: request address, query, cookies
// and sign-in headers, the member (no rule allows a member id in a report, so it goes), message
// text that looks like an email address or phone number, the route name, span addresses and the
// addresses a replay lists. Changes the event in place and returns it.
export function seScrubEvent(event) {
    const record = event;
    if (isRecord(record.request))
        scrubRequest(record.request);
    delete record.user;
    scrubMessages(record);
    if (typeof record.transaction === 'string')
        record.transaction = seScrubAddress(record.transaction);
    if (Array.isArray(record.urls)) {
        record.urls = record.urls.map((url) => (typeof url === 'string' ? seScrubAddress(url) : url));
    }
    scrubList(record, 'breadcrumbs', (crumb) => seScrubBreadcrumb(crumb));
    scrubList(record, 'spans', (span) => scrubSpan(span));
    return event;
}
