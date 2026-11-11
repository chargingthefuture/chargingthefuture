import { seDayKey, seTalkSpan, seWeekDays } from './week';
// + New → Talk in 3.1, to the approved boards "Schedule a talk" and "Schedule a talk, not yet
// verified", shared by web and Android: booking 90 minutes on TI Radio, held in the Main Room.
export const SE_TALK_WORDS = {
    heading: 'Host a talk in the Main Room',
    roomRule: 'Room rule',
    loading: 'Reading the schedule…',
    days: 'Choose a day',
    slots: 'Times that day',
    about: 'What is it about?',
    aboutPlaceholder: 'Trading skills over the holidays',
    pickFirst: 'Pick a time above',
    open: 'Open',
    take: 'Take this slot',
    yours: 'Your talk',
    picked: 'Picked',
    started: 'Already started',
    submit: 'Book this slot',
    submitting: 'Booking…',
    tryAgain: 'Try again',
    noneThisDay: 'Nothing is left to book this day. Pick another day.',
    failed: 'Could not book the talk.',
    loadFailed: 'Could not read the TI Radio schedule.',
    lockedTitle: 'Booking a talk opens once you are verified',
    lockedText: 'A talk goes on the public schedule under your name, so it waits for one check. You can listen to every talk now.',
    finishUnlock: 'Finish Unlock',
    unlockHref: '/plugin/unlock',
    nextTalk: 'Next talk',
    nothingBooked: 'Nothing is booked yet.',
};
function zone(now) {
    return now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() ?? '';
}
function clock(iso) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
// "90 minutes, on the TI Radio schedule. Times are yours, CDT."
export function seTalkIntro(now = new Date()) {
    return `90 minutes, on the TI Radio schedule. Times are yours, ${zone(now)}.`;
}
export function seTalkBooked(dayLabel) {
    return `Booked for ${dayLabel}. It shows on Today and in the TI Radio schedule.`;
}
export function seSlotDay(startIso) {
    return new Date(startIso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
export function seTalkRow(slot, pickedIso) {
    const time = clock(slot.slotStartIso);
    const W = SE_TALK_WORDS;
    if (slot.booking)
        return { time, title: slot.booking.title, sub: `Hosted by ${slot.booking.hostUsername}`, look: 'booked', pickable: false };
    if (slot.isOnAir)
        return { time, title: W.open, sub: W.started, look: 'booked', pickable: false };
    if (slot.slotStartIso === pickedIso)
        return { time, title: W.yours, sub: W.picked, look: 'picked', pickable: true };
    return { time, title: W.open, sub: W.take, look: 'open', pickable: true };
}
// The seven days starting today, each with the slots on it that have not ended yet.
export function seTalkDays(slots, now = new Date()) {
    const nowMs = now.getTime();
    return seWeekDays([], now, true).map((day) => ({
        ...day,
        past: false,
        slots: slots.filter((slot) => seDayKey(new Date(slot.slotStartIso)) === day.key && Date.parse(slot.slotEndIso) > nowMs),
    }));
}
// The first day with a slot that can still be taken, so the list opens on something bookable.
export function seTalkFirstOpenDay(days) {
    const open = days.find((day) => day.slots.some((slot) => slot.state === 'open' && !slot.isOnAir));
    return (open ?? days[0])?.key ?? null;
}
// "7:00 to 8:30 PM CDT", beside "What is it about?" once a time is picked.
export function seTalkPickedSpan(startIso, endIso) {
    return seTalkSpan({ title: '', host: '', startIso, endIso, onAir: false });
}
// The next booked talk that has not ended, for the Talk screen of a member not verified yet.
export function seNextTalk(slots, now = new Date()) {
    const next = slots.find((slot) => slot.booking && Date.parse(slot.slotEndIso) > now.getTime());
    if (!next?.booking)
        return null;
    return { title: next.booking.title, host: next.booking.hostUsername, startIso: next.slotStartIso, endIso: next.slotEndIso, onAir: next.isOnAir };
}
// "Hosted by marisol_k · Wednesday, October 28, 2026 at 3:00 PM CDT"
export function seNextTalkLine(talk) {
    const start = new Date(talk.startIso);
    const day = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return `Hosted by ${talk.host} · ${day} at ${clock(talk.startIso)} ${zone(start)}`;
}
