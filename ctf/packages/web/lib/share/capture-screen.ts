// Turn a live screen into a picture of itself.
//
// Why a capture rather than a drawing (owner directive, 2026-09-20). The first two shareable
// pictures in this app were drawn server-side: a second design of the same screen, kept in step by
// hand. That is tedious to manage, it drifts from the screen the moment either side changes, and a
// member who sees the picture and then opens the app is not looking at the thing they were shown.
// A capture is the screen, so there is nothing to design, nothing to keep in step, and what a
// reader sees is what they will find.
//
// html2canvas-pro redraws the DOM into a canvas rather than serializing it into an SVG
// foreignObject. That matters on iOS, which is the phone this has to work on: foreignObject
// rendering there needs web fonts inlined as data URIs and still comes back blank often enough to
// be a problem, while the canvas path draws text with the browser's own text rendering and gets
// the font for free.
//
// What a caller controls, through the DOM rather than through arguments: `data-capture-hide` on
// any element keeps it out of the picture. The share control marks itself, so it never appears in
// its own output. A screen passes the node holding what it wants shown rather than its outermost
// element, which would drag in the app chrome.

import html2canvas from 'html2canvas-pro';

export type CaptureFooter = {
  /** The deep link, so a picture that travels alone says where to go. */
  line: string;
  note?: string;
  accent: string;
  muted: string;
};

export type CaptureOptions = {
  footer?: CaptureFooter;
  /** Matches the screen's own background, so the picture has no transparent edge. */
  background: string;
};

const FOOTER_FONT = 'Inter, system-ui, sans-serif';

// The footer is added to html2canvas's *clone* of the document, never to the live screen: the
// person watching does not see a line appear and vanish, and a failed capture cannot leave one
// behind.
function appendFooter(cloned: HTMLElement, footer: CaptureFooter): void {
  const doc = cloned.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.style.cssText = `padding:18px 20px 22px;font-family:${FOOTER_FONT};line-height:1.5`;

  const line = doc.createElement('div');
  line.textContent = footer.line;
  line.style.cssText = `font-size:15px;font-weight:700;color:${footer.accent}`;
  wrap.appendChild(line);

  if (footer.note) {
    const note = doc.createElement('div');
    note.textContent = footer.note;
    note.style.cssText = `font-size:12px;color:${footer.muted};margin-top:6px`;
    wrap.appendChild(note);
  }

  cloned.appendChild(wrap);
}

export async function captureScreen(node: HTMLElement, options: CaptureOptions): Promise<Blob> {
  const canvas = await html2canvas(node, {
    backgroundColor: options.background,
    // Twice the CSS pixels at most. One is soft on a phone; more than two makes a picture heavy
    // enough to be slow to share, for no gain anybody can see.
    scale: Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1),
    useCORS: true,
    logging: false,
    ignoreElements: (element) => element.hasAttribute('data-capture-hide'),
    onclone: (_doc, cloned) => {
      if (options.footer) appendFooter(cloned, options.footer);
    },
  });

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      // A canvas with no blob is the browser refusing to read it back, which on Safari means the
      // capture is tainted. Say that rather than handing back an empty file.
      else reject(new Error('The picture could not be read back from the page.'));
    }, 'image/png');
  });
}
