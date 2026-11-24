// Emoji rain (3.1 plan, Look: "Emoji rain when Days won goes up, off by default"). When the member
// has the switch on and the Days won total is higher than the last total their account saw, a short
// light shower of emoji falls over Today. Shared so the web and Android draw the same drops.
// Plain signs of a day won: a party popper, a sprout, a star, raised hands and a sparkle.
export const SE_EMOJI_RAIN = ['🎉', '🌱', '⭐', '🙌', '✨'];
// How many drops fall, and the longest any one takes from top to bottom, delay included.
export const SE_EMOJI_RAIN_DROPS = 18;
export const SE_EMOJI_RAIN_MS = 3200;
// The drops, spread evenly across the width with a fixed jitter so every run looks the same on both
// platforms and nothing depends on a random number.
export function seEmojiRainDrops(count = SE_EMOJI_RAIN_DROPS) {
    return Array.from({ length: count }, (_, i) => {
        const jitter = (i * 37) % 11;
        return {
            key: `drop-${i}`,
            emoji: SE_EMOJI_RAIN[i % SE_EMOJI_RAIN.length],
            leftPct: Math.min(94, Math.round(((i + 0.5) / count) * 100) - 3 + (jitter % 5)),
            delayMs: ((i * 7) % count) * 60,
            fallMs: 1600 + jitter * 50,
            sizePx: 22 + (jitter % 3) * 4,
        };
    });
}
// What Today does with the Days won total it has just read:
// - `rain`: draw the rain now (the switch is on and the total went up since the account last saw it);
// - `record`: the total to save as seen, or null when nothing needs saving.
// `seen` is undefined while the account has not answered yet (decide nothing), and null when it has
// never recorded a total (record this one; there is nothing to compare it with, so no rain).
// The total is recorded with the switch off too, so turning it on later does not rain for growth the
// member already saw. A sample total (shown while the real one cannot be read) is never recorded.
export function seEmojiRainStep(input) {
    const { on, total, sample, seen } = input;
    if (seen === undefined || typeof total !== 'number' || !Number.isFinite(total) || sample)
        return { rain: false, record: null };
    const days = Math.max(0, Math.floor(total));
    return { rain: on && seen !== null && days > seen, record: days === seen ? null : days };
}
// A saved total must be a count of days, zero or more.
export function isSeDaysWonSeen(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
}
// The total this device last saw on Today, kept in the browser (or phone) beside the account's own
// (owner request, 2026-11-24), so a rise rains on the next visit on each device the member uses,
// not only on the first one to open Today after it. The device's total wins when it has one; a
// device that has never recorded one falls back to the account's, so a new device does not rain for
// growth the member already saw elsewhere.
export function seDaysWonSeenOn(device, account) {
    return isSeDaysWonSeen(device) ? device : account;
}
