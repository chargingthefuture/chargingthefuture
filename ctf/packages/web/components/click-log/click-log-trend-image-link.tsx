'use client';

import { Download, Image as ImageIcon } from 'lucide-react';
import {
  TREND_ACCENT,
  TREND_BORDER,
  TREND_SUBTLE,
  TREND_SURFACE,
  TREND_TEXT,
} from './click-log-trend-tokens';

// Produces the whole report as one tall PNG — the thing to post somewhere that takes an image,
// without stitching phone screenshots together and losing rows at the seams.
//
// Two links, not one, because the two devices need different things. On a phone the image has to
// open on screen: from there it can be held to save it to the photo library or shared straight
// into another app, which is where it is going. A file download on a phone lands in the files app
// instead, one step away from anywhere useful — so that is the second link, for a computer.
//
// Plain links, not a fetch: the endpoint answers with the image itself, and the same signed-in
// session that loaded this screen authorizes the request.
//
// The image never carries the area coordinates, and there is no control to put them back (owner
// directive, 2026-08-24). An exported image is made to be shared publicly, so the choice was
// removed rather than defaulted: an ~11 km cell with a date can point at one person at small
// counts. The countries stay in, so the image still says where the activity is, and the trends
// screen above still lists every area for the owner.
export function ClickLogTrendImageLink() {
  const viewHref = '/api/click-log/admin/trends/image';
  const downloadHref = '/api/click-log/admin/trends/image?download=1';
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
        href={viewHref}
        target="_blank"
        rel="noopener noreferrer"
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
        <ImageIcon size={15} color="#fff" />
        Show the report as one image
      </a>
      <div style={{ fontSize: 11, color: TREND_SUBTLE, marginTop: 8, lineHeight: 1.5 }}>
        Opens the whole report as one tall picture. On a phone, press and hold it to save it to your
        photos or send it straight to another app.
      </div>
      <a
        href={downloadHref}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: 10,
          padding: '9px 14px',
          borderRadius: 10,
          background: 'transparent',
          border: `1px solid ${TREND_BORDER}`,
          color: TREND_TEXT,
          fontSize: 12,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        <Download size={14} color={TREND_SUBTLE} />
        Save it as a file instead
      </a>
      <div style={{ fontSize: 11, color: TREND_SUBTLE, marginTop: 12, lineHeight: 1.5 }}>
        The image leaves the area coordinates out, because it is made to be shared — the countries in
        it still say where the activity is, and the full area list stays on this screen. It carries
        the numbers and the note below them, so anyone who sees the counts also sees where they came
        from and what they cannot show.
      </div>
    </div>
  );
}
