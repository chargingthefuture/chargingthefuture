import { describe, expect, it } from 'vitest';
import { areaCellLabel, buildTrendReportView } from './trend-report-view';
import type { SharedIncidentReport } from './types';

// A small report with one of everything, so the shape of the view can be checked without a database.
const report: SharedIncidentReport = {
  summary: {
    days: 90,
    sharedIncidents: 7,
    reporters: 3,
    repeatReporters: 2,
    areas: 2,
    taggedIncidents: 6,
    withLocation: 5,
    withoutLocation: 2,
    firstDay: '2026-08-13',
    lastDay: '2026-08-19',
  },
  buckets: [
    { day: '2026-08-19', latitudeCell: 40.7, longitudeCell: -74.0, count: 2 },
    { day: '2026-08-18', latitudeCell: 40.7, longitudeCell: -74.0, count: 3 },
    { day: '2026-08-18', latitudeCell: 51.5, longitudeCell: 0.1, count: 1 },
    { day: '2026-08-13', latitudeCell: null, longitudeCell: null, count: 1 },
  ],
  areas: [
    {
      latitudeCell: 40.7,
      longitudeCell: -74.0,
      incidents: 5,
      reporters: 2,
      firstDay: '2026-08-18',
      lastDay: '2026-08-19',
    },
    {
      latitudeCell: 51.5,
      longitudeCell: 0.1,
      incidents: 1,
      reporters: 1,
      firstDay: '2026-08-18',
      lastDay: '2026-08-18',
    },
  ],
  tagTrends: [
    { tagType: 'problem', tag: 'tinnitus', count: 2 },
    { tagType: 'problem', tag: 'parked-cars-outside-home', count: 2 },
    { tagType: 'scheme', tag: 'color-sensitization', count: 3 },
    { tagType: 'scheme', tag: 'poisoned-well', count: 1 },
  ],
  categories: [
    { category: 'watched-and-followed', incidents: 4, reporters: 2 },
    { category: 'body-and-health', incidents: 2, reporters: 1 },
    { category: 'set-up-for-blame', incidents: 0, reporters: 0 },
  ],
  pairs: [{ problemTag: 'tinnitus', schemeTag: 'color-sensitization', incidents: 2, reporters: 1 }],
};

describe('areaCellLabel', () => {
  it('uses hemisphere letters rather than minus signs', () => {
    expect(areaCellLabel(40.7, -74.0)).toBe('40.7°N, 74.0°W');
    expect(areaCellLabel(-33.9, 151.2)).toBe('33.9°S, 151.2°E');
  });
});

describe('buildTrendReportView', () => {
  it('totals each day across its area cells, newest first', () => {
    const view = buildTrendReportView(report, { includeAreas: true });
    expect(view.days).toEqual([
      { label: '2026-08-19', value: 2 },
      { label: '2026-08-18', value: 4 },
      { label: '2026-08-13', value: 1 },
    ]);
  });

  it('shows areas with their member count and date span when asked', () => {
    const view = buildTrendReportView(report, { includeAreas: true });
    expect(view.areas).toEqual([
      { label: '40.7°N, 74.0°W', detail: '2 members · 2026-08-18 to 2026-08-19', value: 5 },
      { label: '51.5°N, 0.1°E', detail: '1 member · 2026-08-18', value: 1 },
    ]);
    expect(view.areasOmittedLine).toBeNull();
  });

  it('withholds area coordinates by default and says how many were held back', () => {
    const view = buildTrendReportView(report, { includeAreas: false });
    expect(view.areas).toEqual([]);
    expect(view.areasOmittedLine).toContain('2 areas recorded');
  });

  it('says when the area list is only part of what was recorded', () => {
    const many = { ...report, summary: { ...report.summary, areas: 240 } };
    const view = buildTrendReportView(many, { includeAreas: true });
    expect(view.areasTruncatedLine).toBe('Showing the 2 busiest areas of 240.');
    // The headline count is the real total, not the length of the capped list.
    expect(view.stats.find((stat) => stat.label.startsWith('Areas'))?.value).toBe('240');
  });

  it('drops categories nothing was reported in', () => {
    const view = buildTrendReportView(report, { includeAreas: true });
    expect(view.categories.map((row) => row.label)).toEqual(['Watched and followed', 'Body and health']);
  });

  it('labels each scheme with its kind so counts are not read against each other', () => {
    const view = buildTrendReportView(report, { includeAreas: true });
    expect(view.schemes[0].detail).toBe('Runs continuously in the background');
    expect(view.schemes[1].detail).toBe('A setup with a start and an end');
  });

  it('carries the method statement with the numbers', () => {
    const view = buildTrendReportView(report, { includeAreas: true });
    const headings = view.notes.map((note) => note.heading);
    expect(headings).toContain('Where these numbers come from');
    expect(headings).toContain('What these numbers cannot show');
    const howToRead = view.notes.find((note) => note.heading === 'How to read the counts');
    expect(howToRead?.body).toContain('3 members account for 7 shared incidents over 90 days');
    const coverage = view.notes.find((note) => note.heading === 'Location coverage');
    expect(coverage?.body).toContain('2 do not');
  });

  it('reads sensibly when nothing has been shared yet', () => {
    const empty: SharedIncidentReport = {
      summary: {
        days: 90,
        sharedIncidents: 0,
        reporters: 0,
        repeatReporters: 0,
        areas: 0,
        taggedIncidents: 0,
        withLocation: 0,
        withoutLocation: 0,
        firstDay: null,
        lastDay: null,
      },
      buckets: [],
      areas: [],
      tagTrends: [],
      categories: [],
      pairs: [],
    };
    const view = buildTrendReportView(empty, { includeAreas: true });
    expect(view.windowLine).toBe('Last 90 days · no activity yet');
    expect(view.days).toEqual([]);
    expect(view.areasOmittedLine).toBeNull();
  });
});
