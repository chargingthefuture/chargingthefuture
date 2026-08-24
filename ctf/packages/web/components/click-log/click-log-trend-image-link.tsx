'use client';

import { Download } from 'lucide-react';
import {
  TREND_ACCENT,
  TREND_BORDER,
  TREND_SUBTLE,
  TREND_SURFACE,
} from './click-log-trend-tokens';

// Saves the whole report as one tall PNG — the thing to post somewhere that takes an image,
// without stitching phone screenshots together and losing rows at the seams.
//
// One control, not two. There used to be a second link that opened the image in the browser, on
// the reasoning that a phone needs the picture on screen to hold and save it. Tested on iOS that
// reasoning was wrong twice over (owner report, 2026-08-24): the response is a bare image with no
// page around it, so there was no way back to the trends screen, and saving the file works fine on
// a phone anyway — from the Files app the picture can be saved to photos or shared into another
// app. So the save is all that is left, and it never leaves this screen.
//
// A plain link, not a fetch: the endpoint answers with the image itself, and the same signed-in
// session that loaded this screen authorizes the request. The route sends it as an attachment, so
// the browser saves it and this screen stays exactly where it was.
//
// The image never carries the area coordinates, and there is no control to put them back (owner
// directive, 2026-08-24). An exported image is made to be shared publicly, so the choice was
// removed rather than defaulted: an ~11 km cell with a date can point at one person at small
// counts. The countries stay in, so the image still says where the activity is, and the trends
// screen above still lists every area for the owner.
export function ClickLogTrendImageLink() {
  return (
    <div
      style={{
        marginTop: 20,
        padding: '14px 16px',
        borderRadius: 12,
        background: TREND_SURFACE,
        border: `1px solid ${TREND_BORDER}`,
      }}
    >
      <a
        href="/api/click-log/admin/trends/image"
        download
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 10,
          background: TREND_ACCENT,
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        <Download size={15} color="#fff" />
        Save the report as one image
      </a>
      <div style={{ fontSize: 11, color: TREND_SUBTLE, marginTop: 8, lineHeight: 1.5 }}>
        Saves the whole report as one tall picture, named for today&apos;s date. You stay on this
        screen. On a phone, open it from your downloads to save it to your photos or send it to
        another app.
      </div>
      <div style={{ fontSize: 11, color: TREND_SUBTLE, marginTop: 12, lineHeight: 1.5 }}>
        The image leaves the area coordinates out, because it is made to be shared — the countries in
        it still say where the activity is, and the full area list stays on this screen. It carries
        the numbers and the note below them, so anyone who sees the counts also sees where they came
        from and what they cannot show.
      </div>
    </div>
  );
}
