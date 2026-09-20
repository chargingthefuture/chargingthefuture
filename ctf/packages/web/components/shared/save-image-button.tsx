"use client";

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { Download } from "lucide-react";
import { reportError } from "lib/observability/report";

// THE shared way to hand a server-drawn picture to the person looking at the screen.
//
// Never a plain `<a href download>` to the route. That was how ClickLog's trend image and the
// SkillsHunt missions picture both shipped, and on an installed app on iOS it is a trap (owner
// report, 2026-09-20, the second time): the app runs in standalone mode with no browser chrome, so
// following the link navigates the app's own window to the downloaded file. iOS then draws its file
// preview — a PNG icon, the file name, and an "Open in…" link — with no back control anywhere,
// because the app has no address bar or back button to draw one on. The screen the person came from
// is gone and the only way out is to force the app closed. Fixing ClickLog by removing its second
// "view in the browser" link did not touch this: the remaining download link navigates just the
// same.
//
// So the picture is fetched instead, and the page never changes:
//
//   1. `fetch` the route with the session that is already signed in, and read the picture as a blob.
//   2. Offer it to the phone's own share sheet when the browser has one that takes files. That is
//      the natural place on a phone — save to photos, send it to someone, put it in another app —
//      and the sheet opens over the app rather than replacing it.
//   3. Otherwise save it as a file from a blob URL, which is what a desktop browser wants.
//
// Neither path leaves the screen, so there is nothing to come back from. A failure stays on the
// screen as a sentence under the button instead of a dead page.

// The person closed the share sheet. That is a choice, not a fault: nothing is saved and nothing
// is said about it.
function isDismissedByPerson(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

// Black or white text, whichever stays readable on the accent behind it. The shells hand over their
// own accent — ClickLog's is dark pink and wants white, SkillsHunt's is bright amber and wants
// near-black — and picking it here means neither caller has to think about it.
function readableTextOn(accent: string): string {
  const hex = accent.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return "#fff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  // Relative luminance (WCAG): the mid-point 0.45 puts amber and yellow on dark text and leaves
  // the darker brand colors on white.
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.45 ? "#111111" : "#ffffff";
}

function saveAsFile(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function failureMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export function SaveImageButton({
  url,
  filename,
  label,
  busyLabel = "Preparing the picture…",
  accent,
  surface,
  border,
  muted,
  area,
  op,
  children,
  style,
}: {
  /** Same-origin route that answers with the image. The signed-in session authorizes it. */
  url: string;
  /** What the saved or shared file is called. */
  filename: string;
  label: string;
  busyLabel?: string;
  accent: string;
  surface: string;
  border: string;
  muted: string;
  /** Observability tags, so a failure here is findable per plugin. */
  area: string;
  op: string;
  /** The note under the button saying what it does. */
  children?: ReactNode;
  /** Spacing for the card, so each screen places it the way its own layout wants. */
  style?: CSSProperties;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onAccent = readableTextOn(accent);

  const save = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // Rule 137: the route's own sentence goes on screen; this one is only the fallback for a
        // body that carries nothing.
        throw new Error(await failureMessage(res, `The picture could not be drawn (${res.status}).`));
      }
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || "image/png" });

      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (shareError) {
          if (isDismissedByPerson(shareError)) return;
          // Any other refusal — commonly a browser declining because the press that started this
          // has aged out while the picture was being drawn — falls through to saving the file, so
          // the person still gets the picture either way.
          reportError(shareError, { area, op: `${op}_share`, extra: { filename } });
        }
      }

      saveAsFile(blob, filename);
    } catch (caught) {
      reportError(caught, { area, op, extra: { url, filename } });
      setError(caught instanceof Error ? caught.message : "The picture could not be prepared.");
    } finally {
      setBusy(false);
    }
  }, [url, filename, area, op]);

  return (
    <div
      style={{
        marginTop: 20,
        padding: "14px 16px",
        borderRadius: 12,
        background: surface,
        border: `1px solid ${border}`,
        ...style,
      }}
    >
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "10px 14px",
          borderRadius: 10,
          background: accent,
          border: "none",
          color: onAccent,
          fontSize: 13,
          fontWeight: 700,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        <Download size={15} color={onAccent} />
        {busy ? busyLabel : label}
      </button>
      {error && (
        <div role="alert" style={{ fontSize: 12, color: "#EF4444", marginTop: 8, lineHeight: 1.5 }}>
          {error}
        </div>
      )}
      {children ? (
        <div style={{ fontSize: 11, color: muted, marginTop: 8, lineHeight: 1.5 }}>{children}</div>
      ) : null}
    </div>
  );
}
