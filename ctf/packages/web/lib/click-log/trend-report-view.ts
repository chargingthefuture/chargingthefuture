import { problemTagLabel, schemeTagLabel } from './tags';
import {
  CLICK_LOG_PROBLEM_CATEGORIES,
  CLICK_LOG_SCHEME_KIND_LABEL,
  schemeKindFor,
} from './tag-categories';
import type { SharedIncidentReport } from './types';

// Turns the raw report aggregate into the exact rows and words both readers see: the owner's
// trends screen and the shareable report image. Pure — no database, no request, no React — so the
// screen and the image can never drift apart in what they say, and so the wording is unit-testable.

export type ReportRow = {
  label: string;
  // Short qualifier under the label: a date span, a reporter count, or a scheme's kind.
  detail?: string;
  value: number;
};

export type ReportNote = { heading: string; body: string };

export type TrendReportView = {
  title: string;
  windowLine: string;
  stats: { label: string; value: string }[];
  days: ReportRow[];
  areas: ReportRow[];
  areasOmittedLine: string | null;
  areasTruncatedLine: string | null;
  categories: ReportRow[];
  problems: ReportRow[];
  schemes: ReportRow[];
  pairs: ReportRow[];
  notes: ReportNote[];
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// A ~11 km cell rendered the way a reader can act on: hemisphere letters rather than minus signs,
// and one decimal place, which is all the precision the aggregate holds.
export function areaCellLabel(latitudeCell: number, longitudeCell: number): string {
  const lat = `${Math.abs(latitudeCell).toFixed(1)}°${latitudeCell < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(longitudeCell).toFixed(1)}°${longitudeCell < 0 ? 'W' : 'E'}`;
  return `${lat}, ${lon}`;
}

function dayRows(report: SharedIncidentReport): ReportRow[] {
  const totals = new Map<string, number>();
  for (const bucket of report.buckets) {
    totals.set(bucket.day, (totals.get(bucket.day) ?? 0) + bucket.count);
  }
  return Array.from(totals.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, count]) => ({ label: day, value: count }));
}

function areaRows(report: SharedIncidentReport): ReportRow[] {
  return report.areas.map((area) => ({
    label: areaCellLabel(area.latitudeCell, area.longitudeCell),
    detail:
      area.firstDay === area.lastDay
        ? `${plural(area.reporters, 'member', 'members')} · ${area.firstDay}`
        : `${plural(area.reporters, 'member', 'members')} · ${area.firstDay} to ${area.lastDay}`,
    value: area.incidents,
  }));
}

function categoryRows(report: SharedIncidentReport): ReportRow[] {
  return report.categories
    .filter((row) => row.incidents > 0)
    .map((row) => {
      const category = CLICK_LOG_PROBLEM_CATEGORIES.find((c) => c.slug === row.category);
      return {
        label: category?.label ?? row.category,
        detail: plural(row.reporters, 'member', 'members'),
        value: row.incidents,
      };
    });
}

function schemeRows(report: SharedIncidentReport): ReportRow[] {
  return report.tagTrends
    .filter((row) => row.tagType === 'scheme')
    .map((row) => ({
      label: schemeTagLabel(row.tag),
      detail: CLICK_LOG_SCHEME_KIND_LABEL[schemeKindFor(row.tag)],
      value: row.count,
    }));
}

function pairRows(report: SharedIncidentReport): ReportRow[] {
  return report.pairs.map((pair) => ({
    label: `${problemTagLabel(pair.problemTag)} + ${schemeTagLabel(pair.schemeTag)}`,
    detail: plural(pair.reporters, 'member', 'members'),
    value: pair.incidents,
  }));
}

// The method statement. It travels with the numbers everywhere they go — on the screen, in the
// image, and in any copy of the image posted elsewhere — because a count of self-reported
// incidents with no statement of how it was collected and what it cannot show is not evidence a
// serious reader can use, and is easy to dismiss.
function notes(report: SharedIncidentReport): ReportNote[] {
  const { summary } = report;
  return [
    {
      heading: 'Where these numbers come from',
      body:
        'Members of Charging The Future log incidents in the app, one entry at a time, and choose per incident whether to share it. Only shared incidents are counted here. Sharing is off unless the member turns it on; tagging an incident requires sharing it, and the app says so before the member saves.',
    },
    {
      heading: 'What is counted, and what never leaves the member',
      body:
        'Counted: the date, an approximate area about 11 km across, and which items the member picked from two fixed lists — known problems and named schemes. Never counted and never visible to anyone, including the project: the member\'s written note, their exact location, and who they are. Every figure here is produced by a grouped database query that cannot return those.',
    },
    {
      heading: 'How to read the counts',
      body: `${plural(summary.reporters, 'member', 'members')} account for ${plural(summary.sharedIncidents, 'shared incident', 'shared incidents')} over ${summary.days} days, and ${plural(summary.repeatReporters, 'member', 'members')} logged more than one. A count is the number of times members reported something, not the number of times it happened — most incidents are never logged at all.`,
    },
    {
      heading: 'What these numbers cannot show',
      body:
        'These are first-hand accounts, recorded by the people they happened to and not checked against any outside source. The people logging chose to join and chose to share, so this is not a sample of any wider population and no rate can be calculated from it. Anything outside the two fixed lists is not counted at all.',
    },
    {
      heading: 'Why scheme totals are not comparable to each other',
      body:
        'Some named schemes run continuously in the background and can be reported almost any day; others are single operations with a start and an end. A larger count on a continuous one does not make it more serious or more frequent than a smaller count on an operation. Each row below its name says which kind it is.',
    },
    {
      heading: 'Location coverage',
      body:
        summary.withoutLocation === 0
          ? `All ${plural(summary.sharedIncidents, 'shared incident', 'shared incidents')} carry an approximate area.`
          : `${plural(summary.withLocation, 'shared incident', 'shared incidents')} carry an approximate area; ${summary.withoutLocation} do not and are absent from the area list, though they are counted in every other figure. An untagged incident can be logged without a location.`,
    },
  ];
}

export function buildTrendReportView(
  report: SharedIncidentReport,
  options: { includeAreas: boolean }
): TrendReportView {
  const { summary } = report;
  const areas = areaRows(report);
  const span =
    summary.firstDay && summary.lastDay
      ? summary.firstDay === summary.lastDay
        ? summary.firstDay
        : `${summary.firstDay} to ${summary.lastDay}`
      : 'no activity yet';
  return {
    title: 'ClickLog — shared incident trends',
    windowLine: `Last ${summary.days} days · ${span}`,
    stats: [
      { label: 'Shared incidents', value: String(summary.sharedIncidents) },
      { label: 'Members reporting', value: String(summary.reporters) },
      { label: 'Members who logged more than one', value: String(summary.repeatReporters) },
      { label: 'Days with activity', value: String(dayRows(report).length) },
      { label: 'Areas (about 11 km each)', value: String(summary.areas) },
      { label: 'Tagged incidents', value: String(summary.taggedIncidents) },
    ],
    days: dayRows(report),
    areas: options.includeAreas ? areas : [],
    areasOmittedLine:
      options.includeAreas || summary.areas === 0
        ? null
        : `${plural(summary.areas, 'area', 'areas')} recorded. Coordinates are left out of this shared copy: at these counts an area plus a date can point at one person.`,
    // The area list is capped in the query. Saying so is the difference between a short list and a
    // short list a reader wrongly believes is everything.
    areasTruncatedLine:
      options.includeAreas && summary.areas > areas.length
        ? `Showing the ${areas.length} busiest areas of ${summary.areas}.`
        : null,
    categories: categoryRows(report),
    problems: report.tagTrends
      .filter((row) => row.tagType === 'problem')
      .map((row) => ({ label: problemTagLabel(row.tag), value: row.count })),
    schemes: schemeRows(report),
    pairs: pairRows(report),
    notes: notes(report),
  };
}
