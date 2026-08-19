'use client';

import { useState } from 'react';
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
// The area checkbox is off to start. Members are told the grouped totals may be published, and a
// total is what they agreed to — an ~11 km cell next to a date is closer to one person's location
// than to a total, and at small counts it can point at them for anyone who already knows them. So
// putting the coordinates into a copy meant for posting is a deliberate choice made each time
// rather than a default.
export function ClickLogTrendImageLink({ areaCount }: { areaCount: number }) {
  const [includeAreas, setIncludeAreas] = useState(false);
  const query = includeAreas ? 'areas=1' : '';
  const viewHref = `/api/click-log/admin/trends/image${query ? `?${query}` : ''}`;
  const downloadHref = `/api/click-log/admin/trends/image?${query ? `${query}&` : ''}download=1`;
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
      {areaCount > 0 && (
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            marginTop: 12,
            fontSize: 12,
            color: TREND_TEXT,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={includeAreas}
            onChange={(event) => setIncludeAreas(event.target.checked)}
            style={{ marginTop: 2, accentColor: TREND_ACCENT }}
          />
          <span>
            Include the area coordinates
            <span style={{ display: 'block', color: TREND_SUBTLE, marginTop: 2, lineHeight: 1.5 }}>
              Off by default. With only a few incidents in an area, an area plus a date can point at
              one person — so leave this off for anything posted in public.
            </span>
          </span>
        </label>
      )}
      <div style={{ fontSize: 11, color: TREND_SUBTLE, marginTop: 10, lineHeight: 1.5 }}>
        The image carries the numbers and the note below them, so anyone who sees the counts also
        sees where they came from and what they cannot show.
      </div>
    </div>
  );
}
