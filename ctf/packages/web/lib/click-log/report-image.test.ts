import { describe, expect, it } from 'vitest';
import { ImageResponse } from 'next/og';
import { buildTrendReportView } from './trend-report-view';
import {
  REPORT_IMAGE_WIDTH,
  buildReportImageElement,
  estimateReportImageHeight,
} from './report-image';
import type { SharedIncidentReport } from './types';

// The report image is drawn by satori, which supports only a subset of CSS and fails loudly on the
// rest. Nothing else in this repo renders that way, so this test actually produces the PNG rather
// than inspecting the element tree: if a style the renderer cannot take gets added to the layout,
// this goes red here instead of returning a broken download to the owner.

const report: SharedIncidentReport = {
  summary: {
    days: 90,
    sharedIncidents: 7,
    reporters: 3,
    repeatReporters: 2,
    areas: 1,
    taggedIncidents: 6,
    withLocation: 5,
    withoutLocation: 2,
    firstDay: '2026-08-13',
    lastDay: '2026-08-19',
  },
  buckets: [
    { day: '2026-08-19', latitudeCell: 40.7, longitudeCell: -74.0, count: 2 },
    { day: '2026-08-18', latitudeCell: 40.7, longitudeCell: -74.0, count: 4 },
    { day: '2026-08-13', latitudeCell: null, longitudeCell: null, count: 1 },
  ],
  areas: [
    {
      latitudeCell: 40.7,
      longitudeCell: -74.0,
      incidents: 6,
      reporters: 2,
      firstDay: '2026-08-18',
      lastDay: '2026-08-19',
      countryCode: 'US',
      countryName: 'United States',
    },
  ],
  countries: [
    {
      code: 'US',
      name: 'United States',
      incidents: 6,
      reporters: 2,
      areas: 1,
      firstDay: '2026-08-18',
      lastDay: '2026-08-19',
    },
  ],
  tagTrends: [
    { tagType: 'problem', tag: 'bright-lights-shined', count: 2 },
    { tagType: 'problem', tag: 'tinnitus', count: 2 },
    { tagType: 'scheme', tag: 'color-sensitization', count: 3 },
  ],
  categories: [
    { category: 'watched-and-followed', incidents: 4, reporters: 2 },
    { category: 'body-and-health', incidents: 3, reporters: 2 },
  ],
  pairs: [{ problemTag: 'tinnitus', schemeTag: 'color-sensitization', incidents: 2, reporters: 1 }],
};

async function render(includeAreas: boolean): Promise<Buffer> {
  const view = buildTrendReportView(report, { includeAreas });
  const response = new ImageResponse(buildReportImageElement(view, '2026-08-19'), {
    width: REPORT_IMAGE_WIDTH,
    height: estimateReportImageHeight(view),
  });
  return Buffer.from(await response.arrayBuffer());
}

describe('ClickLog report image', () => {
  it('renders a PNG the whole report fits into', async () => {
    const png = await render(true);
    // PNG magic number: any other bytes mean the renderer produced something else.
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    // Width and height live in the IHDR chunk, at fixed offsets right after the magic number.
    expect(png.readUInt32BE(16)).toBe(REPORT_IMAGE_WIDTH);
    expect(png.readUInt32BE(20)).toBeGreaterThan(1200);
  }, 30_000);

  it('renders the shared copy, which always leaves the area coordinates out', async () => {
    const png = await render(false);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }, 30_000);

  it('grows the canvas as the report grows', () => {
    const short = buildTrendReportView(report, { includeAreas: false });
    const tall = buildTrendReportView(
      { ...report, areas: [...report.areas, ...report.areas, ...report.areas] },
      { includeAreas: true }
    );
    expect(estimateReportImageHeight(tall)).toBeGreaterThan(estimateReportImageHeight(short));
  });
});
