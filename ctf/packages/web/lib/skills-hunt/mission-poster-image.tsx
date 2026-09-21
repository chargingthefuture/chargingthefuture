import type { ReactElement } from 'react';
import type { MissionPosterRow, MissionPosterView } from './mission-poster-view';

// The SkillsHunt missions list drawn as one tall picture, ready to post.
//
// Written for satori (the renderer behind `next/og`), which takes only a subset of CSS: flexbox
// only, every element carries an explicit `display`, spacing comes from margins rather than `gap`,
// and the canvas height has to be known before anything is drawn — so `estimateMissionPosterHeight`
// below works the height out from the content. The estimates are deliberately generous: spare space
// at the bottom is harmless, a clipped last card is not.

export const MISSION_POSTER_WIDTH = 900;

const BG = '#0F1117';
const SURFACE = '#161B27';
const BORDER = '#1E2A3A';
const TEXT = '#D5D9E2';
const SUBTLE = '#8A93A6';
const ACCENT = '#FACC15';

const PAD = 44;
const CONTENT_WIDTH = MISSION_POSTER_WIDTH - PAD * 2;
const CARD_PAD_X = 26;
const CARD_TEXT_WIDTH = CONTENT_WIDTH - CARD_PAD_X * 2;

// Characters that fit on one line at each size in the bundled font. Deliberately low: guessing a
// narrower line overestimates the height, which is the safe direction.
const TITLE_CHARS_PER_LINE = 34;
const TITLE_LINE_HEIGHT = 34;
const BODY_CHARS_PER_LINE = 72;
const BODY_LINE_HEIGHT = 26;

function lineCount(text: string, charsPerLine: number): number {
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

function cardHeight(row: MissionPosterRow): number {
  const title = lineCount(row.title, TITLE_CHARS_PER_LINE) * TITLE_LINE_HEIGHT;
  const description = row.description
    ? lineCount(row.description, BODY_CHARS_PER_LINE) * BODY_LINE_HEIGHT + 12
    : 0;
  const target = lineCount(row.targetLine, BODY_CHARS_PER_LINE) * BODY_LINE_HEIGHT + 14;
  return 24 + title + description + target + 24 + 16;
}

// Total canvas height. Exported so the route can size the picture and so the arithmetic can be
// tested without producing a file.
export function estimateMissionPosterHeight(view: MissionPosterView): number {
  const header = 190;
  const cards = view.missions.reduce((sum, row) => sum + cardHeight(row), 0);
  const empty = view.emptyLine ? 80 : 0;
  const footer = 120;
  return PAD * 2 + header + cards + empty + footer;
}

function MissionCard({ row }: { row: MissionPosterRow }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: CONTENT_WIDTH,
        marginBottom: 16,
        padding: `24px ${CARD_PAD_X}px`,
        borderRadius: 16,
        background: SURFACE,
        border: `1px solid ${row.accent}45`,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: CARD_TEXT_WIDTH,
          fontSize: 26,
          fontWeight: 700,
          color: TEXT,
          lineHeight: 1.3,
        }}
      >
        {row.title}
      </div>
      {row.description ? (
        <div
          style={{
            display: 'flex',
            width: CARD_TEXT_WIDTH,
            fontSize: 18,
            color: SUBTLE,
            marginTop: 12,
            lineHeight: 1.45,
          }}
        >
          {row.description}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
        <div style={{ display: 'flex', flex: 1, fontSize: 18, color: SUBTLE }}>{row.targetLine}</div>
        {row.bonusLine ? (
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: row.accent, marginLeft: 16 }}>
            {row.bonusLine}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Builds the entire picture. `generatedOn` is passed in rather than read from the clock here so the
// output is the same every time in tests.
export function buildMissionPosterElement(view: MissionPosterView, generatedOn: string): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: MISSION_POSTER_WIDTH,
        padding: PAD,
        background: BG,
        color: TEXT,
      }}
    >
      <div style={{ display: 'flex', fontSize: 16, color: ACCENT, marginBottom: 10 }}>
        CHARGING THE FUTURE · SKILLSHUNT
      </div>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: TEXT }}>{view.title}</div>
      <div style={{ display: 'flex', width: CONTENT_WIDTH, fontSize: 19, color: SUBTLE, marginTop: 12 }}>
        {view.subtitle}
      </div>
      <div style={{ display: 'flex', width: CONTENT_WIDTH, fontSize: 17, color: SUBTLE, marginTop: 8 }}>
        {view.roundLine}
      </div>
      <div style={{ display: 'flex', width: CONTENT_WIDTH, height: 1, background: BORDER, marginTop: 24, marginBottom: 24 }} />
      {view.emptyLine ? (
        <div
          style={{
            display: 'flex',
            width: CONTENT_WIDTH,
            padding: '18px 26px',
            borderRadius: 14,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            fontSize: 18,
            color: SUBTLE,
          }}
        >
          {view.emptyLine}
        </div>
      ) : null}
      {view.missions.map((row) => (
        <MissionCard key={`${row.title}-${row.targetLine}`} row={row} />
      ))}
      <div style={{ display: 'flex', width: CONTENT_WIDTH, fontSize: 19, color: ACCENT, marginTop: 14, lineHeight: 1.45 }}>
        {view.joinLine}
      </div>
      <div style={{ display: 'flex', fontSize: 15, color: SUBTLE, marginTop: 16 }}>
        Missions as they stood on {generatedOn}
      </div>
    </div>
  );
}
