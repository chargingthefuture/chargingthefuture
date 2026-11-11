// The week strip, the room cards and their words on Today in 3.1, from the approved board "Today",
// shared by web and Android so the two read the same.
export const SE_TODAY_ROOM_WORDS = {
    listen: 'Listen in',
    bring: 'Bring someone in',
    open: 'Open',
    mainAudience: 'open to everyone',
    weaversAudience: 'Private, badge holders only',
    quietNow: 'quiet now',
    quiet: 'Quiet right now',
    // What "Bring someone in" shares: the signed-out Today, where anybody can listen without an account.
    bringText: 'Listen in to the Main Room on Skills Economy. No account needed.',
    bringPath: '/today',
    copied: 'Link copied',
    copyFailed: 'The link could not be copied.',
    weekLabel: 'This week',
    noTalks: 'Nothing booked in the Main Room that day.',
};
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_MS = 86_400_000;
// A day in the reader's own timezone, as a key that two instants on the same day share.
export function seDayKey(d) {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
// Monday to Sunday of the reader's own week, in their own timezone, each with the talks booked
// that day. With `fromToday`, the seven days starting today instead (booking a talk in + New, where
// every day shown has to be one that can still be booked).
export function seWeekDays(talks, now = new Date(), fromToday = false) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!fromToday)
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const todayKey = seDayKey(now);
    return LETTERS.map((_letter, index) => {
        const day = new Date(start.getTime() + index * DAY_MS + 12 * 3_600_000);
        const key = seDayKey(day);
        return {
            key,
            letter: LETTERS[(day.getDay() + 6) % 7],
            date: day.getDate(),
            label: day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
            today: key === todayKey,
            past: day.getTime() < now.getTime() && key !== todayKey,
            talks: talks.filter((talk) => seDayKey(new Date(talk.startIso)) === key),
        };
    });
}
function clock(iso, zone = false) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...(zone ? { timeZoneName: 'short' } : {}) });
}
// "1:30 PM to 3:00 PM CDT", in the reader's own timezone.
export function seTalkTimes(talk) {
    return `${clock(talk.startIso)} to ${clock(talk.endIso, true)}`;
}
// "1:30 to 3:00 PM CDT": as seTalkTimes, with the first AM or PM left out when both ends share it.
export function seTalkSpan(talk) {
    const start = clock(talk.startIso);
    const end = clock(talk.endIso, true);
    const period = /\s(AM|PM)$/.exec(start);
    const first = period && new RegExp(`\\s${period[1]}(\\s|$)`).test(end) ? start.slice(0, period.index) : start;
    return `${first} to ${end}`;
}
// The line under the talk's title in the live room: "On TI Radio, hosted by teodor_b, 1:30 to 3:00 PM CDT".
export function seTalkOnAirLine(talk) {
    return `On TI Radio, hosted by ${talk.host}, ${seTalkSpan(talk)}`;
}
// "Since 1:53 PM CDT", from when the live room's call session started.
export function seRoomSince(startIso) {
    return `Since ${clock(startIso, true)}`;
}
// "Hosted by teodor_b · 1:30 PM to 3:00 PM CDT", with the day in front when it is not today.
export function seTalkHostLine(talk, now = new Date()) {
    const start = new Date(talk.startIso);
    const day = start.toDateString() === now.toDateString() ? '' : `${start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, `;
    return `Hosted by ${talk.host} · ${day}${seTalkTimes(talk)}`;
}
// "2 speaking, 3 listening", counting signed-out guests as listening.
export function seRoomCountsLine(room) {
    const listening = Math.max(0, room.members - room.speakers) + room.guests;
    if (room.speakers + listening === 0)
        return SE_TODAY_ROOM_WORDS.quiet;
    return `${room.speakers} speaking, ${listening} listening`;
}
// "Private, badge holders only · quiet now" or "· 3 here".
export function seWeaversLine(room) {
    const state = room.members > 0 ? `${room.members} here` : SE_TODAY_ROOM_WORDS.quietNow;
    return `${SE_TODAY_ROOM_WORDS.weaversAudience} · ${state}`;
}
