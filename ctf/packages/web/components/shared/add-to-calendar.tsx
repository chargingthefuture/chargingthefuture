'use client';

import { CalendarPlus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { seCalendarFileName, seCalendarIcs, type SeCalendarEvent, type SeTodayTalk } from '@ctf/shared';

// Add to calendar (3.1.0 plan): hands the phone an .ics file for one talk or booked call, and the
// phone offers to add it. The app never reads a calendar.
// color is a hex value; a CSS variable needs borderColor too, since the default border appends alpha.
export function AddToCalendarButton({
  event,
  color,
  borderColor,
  style,
}: {
  event: SeCalendarEvent;
  color: string;
  borderColor?: string;
  style?: CSSProperties;
}) {
  const download = () => {
    // A path is made absolute here, on the press, so the button renders the same on the server.
    const url = event.url ? new URL(event.url, window.location.origin).toString() : undefined;
    const blob = new Blob([seCalendarIcs({ ...event, url })], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = seCalendarFileName(event.title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  return (
    <button
      type="button"
      onClick={download}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 32,
        padding: '6px 10px',
        borderRadius: 10,
        background: 'transparent',
        border: `1px solid ${borderColor ?? `${color}55`}`,
        color,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        ...style,
      }}
    >
      <CalendarPlus size={13} aria-hidden="true" /> Add to calendar
    </button>
  );
}

// A talk in the Main Room, as the Today card and the room carry it.
export function talkCalendarEvent(talk: SeTodayTalk): SeCalendarEvent {
  return {
    uid: `talk-${talk.startIso}`,
    title: talk.title,
    startIso: talk.startIso,
    endIso: talk.endIso,
    description: `Hosted by ${talk.host} in the Main Room.`,
    url: '/ti-radio',
  };
}
