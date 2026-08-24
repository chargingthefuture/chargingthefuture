import { NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { buildSharedIncidentReport } from 'lib/click-log/report';
import { buildTrendReportView } from 'lib/click-log/trend-report-view';
import {
  REPORT_IMAGE_WIDTH,
  buildReportImageElement,
  estimateReportImageHeight,
} from 'lib/click-log/report-image';
import { canViewSharedTrends } from 'lib/click-log/policy';
import { logClickLogAudit } from 'lib/click-log/audit';
import { requireClickLogAdminAccess } from '../../../_lib';

// The whole shared-incident report as one tall PNG, for posting somewhere that takes an image.
// Opens in the browser by default so it can be saved or shared from there; `?download=1` saves it
// as a file instead.
//
// Admin-only and built from exactly the same aggregate as the trends screen, so there is no second
// data path to keep honest. The image carries the method statement with the numbers: anyone who
// sees the counts also sees where they came from and what they cannot show, even when the image is
// reposted with no surrounding text.
//
// The image never carries the ~11 km area coordinates (owner directive, 2026-08-24). Exporting the
// image is how the report gets shared publicly, so the coordinates cannot be an option on this
// route: at small counts a cell plus a date can point at one person, and members opted into sharing
// with the project, not into being placed on a public map. The country rollup stays in every copy,
// so the image still says where the activity is. The trends screen keeps the coordinates for the
// owner — that is the admin view, which nobody outside the project sees.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = await requireClickLogAdminAccess();
  if (!gate.allowed) {
    return gate.response;
  }
  if (!canViewSharedTrends(gate.auth.isAdmin)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  // Shown in the browser by default, saved as a file with ?download=1. On a phone an attachment
  // lands in the files app, which is the wrong place when the next step is posting it: the image
  // has to be on screen so it can be long-pressed and saved to the photo library or shared
  // straight into another app. The download stays for the desktop case.
  const asDownload = params.get('download') === '1';
  const report = await buildSharedIncidentReport();
  // Not a parameter: no query string can put the coordinates back into the image.
  const view = buildTrendReportView(report, { includeAreas: false });
  const generatedOn = new Date().toISOString().slice(0, 10);

  logClickLogAudit({
    actorId: gate.auth.userId,
    command: 'click-log.trends.image',
    result: 'success',
    // Kept in the log so a copy of the image can be matched to what it carried, now that the
    // answer is fixed rather than chosen.
    target: { areas: 'omitted' },
  });

  return new ImageResponse(buildReportImageElement(view, generatedOn), {
    width: REPORT_IMAGE_WIDTH,
    height: estimateReportImageHeight(view),
    headers: {
      'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="clicklog-trends-${generatedOn}.png"`,
      'Cache-Control': 'no-store',
    },
  });
}
