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
// Area coordinates are left out unless `?areas=1` is passed. At small counts an ~11 km cell plus a
// date can point at one person, and members opted into sharing with the project, not into being
// placed on a public map — so putting the cells in a copy meant for posting is a deliberate choice
// the owner makes each time, not the default.

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
  // Areas are in unless explicitly turned off. Location is why ClickLog records a location at all
  // (owner directive, 2026-08-19), so leaving it out of the shareable copy by default withheld the
  // point of the report. `?areas=0` still produces a copy without the coordinates.
  const includeAreas = params.get('areas') !== '0';
  // Shown in the browser by default, saved as a file with ?download=1. On a phone an attachment
  // lands in the files app, which is the wrong place when the next step is posting it: the image
  // has to be on screen so it can be long-pressed and saved to the photo library or shared
  // straight into another app. The download stays for the desktop case.
  const asDownload = params.get('download') === '1';
  const report = await buildSharedIncidentReport();
  const view = buildTrendReportView(report, { includeAreas });
  const generatedOn = new Date().toISOString().slice(0, 10);

  logClickLogAudit({
    actorId: gate.auth.userId,
    command: 'click-log.trends.image',
    result: 'success',
    target: { areas: includeAreas ? 'included' : 'omitted' },
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
