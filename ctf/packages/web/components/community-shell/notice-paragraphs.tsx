import { Fragment } from 'react';

// Render a body of text as real paragraphs.
//
// Written after a formatting bug reached members: a notice body was authored as an array of
// source-wrapped lines joined with '\n', and rendered under `white-space: pre-wrap` every one of those
// source wraps became a hard break, chopping sentences mid-clause. The content was fixed at the source,
// but announcements already published carry the bad text in the database, and no renderer should be one
// stray newline away from that result anyway.
//
// So this does two things:
//   1. Splits on blank lines into <p> elements, giving paragraph SPACING that is typographic rather than
//      an empty line of text.
//   2. Inside a paragraph, treats a lone newline as a soft wrap and collapses it to a space — unless the
//      paragraph looks like a deliberate list of short lines, where each line is its own thought.
//
// That second exception matters: an announcement's trailing "Open <Plugin>: <url>" block is several
// single-newline-separated lines that must stay on separate lines. The test is whether EVERY line in the
// paragraph ends in sentence punctuation or is short — prose that was source-wrapped has lines breaking
// mid-clause, a real list does not.

function looksLikeLineList(lines: string[]): boolean {
  if (lines.length < 2) return false;
  // A real list: every line stands alone — short, or ended deliberately. Source-wrapped prose fails this
  // because its lines break wherever the column ran out, mid-clause and long.
  return lines.every((line) => line.length <= 60 || /[.!?:]$/.test(line.trim()));
}

export function noticeParagraphs(body: string): string[][] {
  return body
    .split(/\n{2,}/)
    .map((block) => block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0))
    .filter((lines) => lines.length > 0)
    .map((lines) => (looksLikeLineList(lines) ? lines : [lines.join(' ')]));
}

export function NoticeParagraphs({ body, className }: { body: string; className?: string }) {
  const paragraphs = noticeParagraphs(body);

  return (
    <>
      {paragraphs.map((lines, i) => (
        <p key={i} className={className} style={{ margin: i === 0 ? '0 0 0.75em' : '0.75em 0 0' }}>
          {lines.map((line, j) => (
            <Fragment key={j}>
              {j > 0 ? <br /> : null}
              {line}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}
