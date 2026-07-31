import { Fragment } from 'react';
import { noticeParagraphs } from 'lib/feed/notice-paragraphs';

// Render a body of text as real paragraphs. The splitting logic lives in lib/feed/notice-paragraphs so
// the copy-preview script (and any test) can exercise it without pulling in React — the formatting bug
// this guards against is in the TEXT, and text logic should be checkable without a renderer.

export function NoticeParagraphs({ body, className }: { body: string; className?: string }) {
  const paragraphs = noticeParagraphs(body);

  return (
    <>
      {paragraphs.map((lines, i) => (
        // Spacing BETWEEN paragraphs only — no leading or trailing margin, so a one-paragraph body adds
        // no stray space inside a compact card.
        <p key={i} className={className} style={{ margin: 0, marginTop: i === 0 ? 0 : '0.75em' }}>
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
