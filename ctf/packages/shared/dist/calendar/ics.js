// One calendar event as an .ics file (3.1.0 plan: Add to calendar on talks and booked calls). The
// app hands the file to the phone, which offers to add it; nothing here reads a calendar.
function icsTime(iso) {
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
// Commas, semicolons, backslashes and line breaks are escaped as the format requires.
function icsText(value) {
    return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
export function seCalendarIcs(event, now = new Date()) {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Skills Economy//Add to calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${icsText(event.uid)}@skills-economy`,
        `DTSTAMP:${icsTime(now.toISOString())}`,
        `DTSTART:${icsTime(event.startIso)}`,
        `DTEND:${icsTime(event.endIso)}`,
        `SUMMARY:${icsText(event.title)}`,
        ...(event.description ? [`DESCRIPTION:${icsText(event.description)}`] : []),
        ...(event.url ? [`URL:${event.url}`] : []),
        'END:VEVENT',
        'END:VCALENDAR',
    ];
    return `${lines.join('\r\n')}\r\n`;
}
// A file name from the title: letters, digits and hyphens only.
export function seCalendarFileName(title) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    return `${slug || 'event'}.ics`;
}
