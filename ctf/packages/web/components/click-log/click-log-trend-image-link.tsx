'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import {
  TREND_ACCENT,
  TREND_BORDER,
  TREND_SUBTLE,
  TREND_SURFACE,
  TREND_TEXT,
} from './click-log-trend-tokens';

// Downloads the whole report as one tall PNG — the thing to post somewhere that takes an image,
// without stitching phone screenshots together and losing rows at the seams.
//
// A plain link, not a fetch: the endpoint answers with the image and a filename, so the browser
// saves it and the same signed-in session that loaded this screen authorizes the request.
//
// The area checkbox is off to start. Members opted into sharing trend data with the project, not
// into having their approximate area posted publicly, and at small counts an ~11 km cell plus a
// date can point at one person — so putting the coordinates into a copy meant for posting is a
// deliberate choice made each time rather than a default.
export function ClickLogTrendImageLink({ areaCount }: { areaCount: number }) {
  const [includeAreas, setIncludeAreas] = useState(false);
  const href = `/api/click-log/admin/trends/image${includeAreas ? '?areas=1' : ''}`;
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
        href={href}
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
