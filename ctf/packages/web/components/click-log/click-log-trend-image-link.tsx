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
// The area coordinates are in the image by default (owner directive, 2026-08-19). Recording where
// incidents happen is the reason location was added to ClickLog in the first place — a report that
// withholds it by default withholds the point of the plugin, and members are told the grouped
// totals may be published. The checkbox is kept as a way to leave the coordinates out of one
// particular copy, not as a standing default.
export function ClickLogTrendImageLink({ areaCount }: { areaCount: number }) {
  const [includeAreas, setIncludeAreas] = useState(true);
  const query = includeAreas ? '' : 'areas=0';
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
            checked={!includeAreas}
            onChange={(event) => setIncludeAreas(!event.target.checked)}
            style={{ marginTop: 2, accentColor: TREND_ACCENT }}
          />
          <span>
            Leave the area coordinates out of this copy
            <span style={{ display: 'block', color: TREND_SUBTLE, marginTop: 2, lineHeight: 1.5 }}>
              The coordinates are included unless you tick this. The countries stay in either way,
              so the image always says where the activity is.
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
