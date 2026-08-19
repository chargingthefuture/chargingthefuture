import type { ReactElement } from 'react';
import type { ReportNote, ReportRow, TrendReportView } from './trend-report-view';

// The shareable ClickLog report, drawn as one tall image.
//
// Why an image and not a screenshot: a phone screenshot of the trends screen stops at the bottom of
// the screen, and stitching several together loses rows and produces seams. This renders the whole
// report — every section, in order, plus the method statement — into a single PNG that can be posted
// anywhere as-is.
//
// Written for satori (the renderer behind `next/og`), which supports a subset of CSS: flexbox only,
// every element gets an explicit `display`, spacing comes from margins rather than `gap`, and the
// image height must be known before rendering, so `estimateReportImageHeight` below sizes the
// canvas from the content. Sizes are deliberately generous — spare space at the bottom is harmless,
// a clipped final row is not.

export const REPORT_IMAGE_WIDTH = 900;

const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#F9FAFB';
const SUBTLE = '#8A93A6';
const ACCENT = '#EC4899';

const PAD = 44;
const ROW_HEIGHT = 52;
const ROW_HEIGHT_WITH_DETAIL = 66;
const SECTION_HEADING = 46;
const CONTENT_WIDTH = REPORT_IMAGE_WIDTH - PAD * 2;

// Stat tiles wrap on their own once the row is full, so the width arithmetic has to leave room for
// every gutter — one tile too wide and the whole row falls to the next line, which would put the
// rendered height out of step with the estimate below.
const STATS_PER_ROW = 2;
const STAT_GUTTER = 12;
const STAT_TILE_HEIGHT = 96;

// Characters that fit on one line of note body text at 17px in the bundled font. Deliberately
// conservative: underestimating the width overestimates the height, which is the safe direction.
const NOTE_CHARS_PER_LINE = 90;
const NOTE_LINE_HEIGHT = 26;

function noteHeight(note: ReportNote): number {
  const lines = Math.ceil(note.body.length / NOTE_CHARS_PER_LINE);
  return 30 + lines * NOTE_LINE_HEIGHT + 18;
}

function sectionHeight(rows: ReportRow[]): number {
  if (rows.length === 0) return 0;
  const hasDetail = rows.some((row) => row.detail);
  return SECTION_HEADING + rows.length * (hasDetail ? ROW_HEIGHT_WITH_DETAIL : ROW_HEIGHT) + 16;
}

// Total canvas height for a report. Exported so the route can size the image and so the arithmetic
// can be tested on its own.
export function estimateReportImageHeight(view: TrendReportView): number {
  const header = 150;
  const stats = Math.ceil(view.stats.length / STATS_PER_ROW) * (STAT_TILE_HEIGHT + STAT_GUTTER) + 20;
  const asides = (view.areasOmittedLine ? 74 : 0) + (view.areasTruncatedLine ? 60 : 0);
  const sections =
    sectionHeight(view.days) +
    sectionHeight(view.areas) +
    sectionHeight(view.categories) +
    sectionHeight(view.problems) +
    sectionHeight(view.schemes) +
    sectionHeight(view.pairs);
  const notes = SECTION_HEADING + view.notes.reduce((sum, note) => sum + noteHeight(note), 0);
  const footer = 76;
  return PAD * 2 + header + stats + asides + sections + notes + footer;
}

function StatTile({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: (CONTENT_WIDTH - STAT_GUTTER * STATS_PER_ROW) / STATS_PER_ROW,
        height: STAT_TILE_HEIGHT,
        marginRight: STAT_GUTTER,
        marginBottom: STAT_GUTTER,
        padding: '14px 18px',
        borderRadius: 14,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: 34, color: ACCENT }}>{value}</div>
      <div style={{ display: 'flex', fontSize: 15, color: SUBTLE, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Row({ row }: { row: ReportRow }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        width: CONTENT_WIDTH,
        height: row.detail ? ROW_HEIGHT_WITH_DETAIL - 8 : ROW_HEIGHT - 8,
        marginBottom: 8,
        padding: '0 18px',
        borderRadius: 12,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', fontSize: 18, color: TEXT }}>{row.label}</div>
        {row.detail ? (
          <div style={{ display: 'flex', fontSize: 14, color: SUBTLE, marginTop: 4 }}>{row.detail}</div>
        ) : null}
      </div>
      <div style={{ display: 'flex', fontSize: 22, color: ACCENT, marginLeft: 16 }}>{row.value}</div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: ReportRow[] }): ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
      <div style={{ display: 'flex', fontSize: 22, color: TEXT, marginBottom: 14 }}>{title}</div>
      {rows.map((row) => (
        <Row key={`${row.label}-${row.value}`} row={row} />
      ))}
    </div>
  );
}

// A single line of context beside a section — why coordinates were left out, or how much of a
// capped list is being shown.
function Aside({ text }: { text: string }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        width: CONTENT_WIDTH,
        marginTop: 16,
        padding: '14px 18px',
        borderRadius: 12,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        fontSize: 16,
        color: SUBTLE,
      }}
    >
      {text}
    </div>
  );
}

function Note({ note }: { note: ReportNote }): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 18, width: CONTENT_WIDTH }}>
      <div style={{ display: 'flex', fontSize: 17, color: ACCENT, marginBottom: 6 }}>{note.heading}</div>
      <div style={{ display: 'flex', fontSize: 17, color: SUBTLE, lineHeight: 1.5 }}>{note.body}</div>
    </div>
  );
}

// Builds the whole image. `generatedOn` is passed in rather than read from the clock here so the
// output is reproducible in tests.
export function buildReportImageElement(view: TrendReportView, generatedOn: string): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: REPORT_IMAGE_WIDTH,
        padding: PAD,
        background: BG,
        color: TEXT,
      }}
    >
      <div style={{ display: 'flex', fontSize: 16, color: ACCENT, marginBottom: 10 }}>
        CHARGING THE FUTURE
      </div>
      <div style={{ display: 'flex', fontSize: 38, color: TEXT }}>{view.title}</div>
      <div style={{ display: 'flex', fontSize: 18, color: SUBTLE, marginTop: 10 }}>{view.windowLine}</div>
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: 26 }}>
        {view.stats.map((stat) => (
          <StatTile key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
      <Section title="Days with shared incidents" rows={view.days} />
      <Section title="Areas (each about 11 km across)" rows={view.areas} />
      {view.areasTruncatedLine ? <Aside text={view.areasTruncatedLine} /> : null}
      {view.areasOmittedLine ? <Aside text={view.areasOmittedLine} /> : null}
      <Section title="Kinds of harm reported" rows={view.categories} />
      <Section title="Problems reported" rows={view.problems} />
      <Section title="Named schemes reported" rows={view.schemes} />
      <Section title="Problem and scheme reported together" rows={view.pairs} />
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 30 }}>
        <div style={{ display: 'flex', fontSize: 22, color: TEXT, marginBottom: 16 }}>
          How this was collected, and what it cannot show
        </div>
        {view.notes.map((note) => (
          <Note key={note.heading} note={note} />
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: 15, color: SUBTLE, marginTop: 18 }}>
        Charging The Future · chargingthefuture.com · report made {generatedOn}
      </div>
    </div>
  );
}
