'use client';

import {
  TREND_ACCENT,
  TREND_BORDER,
  TREND_SUBTLE,
  TREND_SURFACE,
} from './click-log-trend-tokens';
import { SaveImageButton } from '@/components/shared/save-image-button';

// Saves the report as one tall PNG — the thing to post somewhere that takes an image, without
// stitching phone screenshots together and losing rows at the seams.
//
// One control, not two. There used to be a second link that opened the image in the browser, on
// the reasoning that a phone needs the picture on screen to hold and save it. Tested on iOS that
// reasoning was wrong twice over (owner report, 2026-08-24): the response is a bare image with no
// page around it, so there was no way back to the trends screen, and saving the file works fine on
// a phone anyway.
//
// Removing that second link did not settle it, and neither did the first replacement for it (owner
// reports, 2026-09-20, twice in one day). The picture is now drawn and then shown on this screen,
// to be pressed and held, shared, or saved from here — nothing is handed anywhere off the back of
// the press that fetched it, and nothing navigates. Both failures and why they looked right are
// written out in components/shared/save-image-button.tsx.
//
// The image never carries the area coordinates, and there is no control to put them back (owner
// directive, 2026-08-24). An exported image is made to be shared publicly, so the choice was
// removed rather than defaulted: an ~11 km cell with a date can point at one person at small
// counts. The countries stay in, so the image still says where the activity is, and the trends
// screen above still lists every area for the owner.
export function ClickLogTrendImageLink() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <SaveImageButton
      url="/api/click-log/admin/trends/image"
      filename={`clicklog-trends-${today}.png`}
      label="Show the report as one image"
      accent={TREND_ACCENT}
      surface={TREND_SURFACE}
      border={TREND_BORDER}
      muted={TREND_SUBTLE}
      area="click-log"
      op="trends_image"
    >
      <>
        <div>
          Draws the report as one tall picture and shows it here, named for today&apos;s date. You
          stay on this screen. On a phone, press and hold the picture to save it to your photos, or
          use Share to send it straight to another app.
        </div>
        <div style={{ marginTop: 12 }}>
          The image leaves the area coordinates out, because it is made to be shared — the countries
          in it still say where the activity is, and the full area list stays on this screen. It
          carries the numbers and the note below them, so anyone who sees the counts also sees where
          they came from and what they cannot show.
        </div>
      </>
    </SaveImageButton>
  );
}
