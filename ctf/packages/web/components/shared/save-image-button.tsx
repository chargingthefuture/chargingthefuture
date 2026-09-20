"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Download, Image as ImageIcon, Share2, X } from "lucide-react";
import { reportError } from "lib/observability/report";

// THE shared way to hand a server-drawn picture to the person looking at the screen.
//
// Three attempts got here, and the two that failed are worth keeping written down, because each
// one looked obviously correct.
//
// A plain `<a href download>` to the route (ClickLog since August, SkillsHunt on 2026-09-20).
// In the installed app on iOS there is no browser chrome, so following the link navigates the
// app's own window to the downloaded file. iOS draws its file preview — a PNG icon, the file
// name, an "Open in…" link — with no back control, because a standalone app has no address bar to
// put one on. Force-closing the app was the only way back.
//
// Fetch it, then hand it to the share sheet, and fall back to clicking a blob-URL anchor
// (2026-09-20, later the same day). Both halves broke on the owner's phone. The share sheet never
// opened: drawing the picture server-side takes a second or two, and by the time `navigator.share`
// was called Safari had expired the transient activation from the press that started it, so it
// refused with NotAllowedError. The fallback then clicked an anchor at a `blob:` URL — which in
// standalone mode navigates rather than downloading — at a URL the next line had already revoked.
// The result was "Safari can't open the page … WebKitBlobResource error 1", a dead page again.
//
// So this no longer tries to hand the file anywhere off the back of the press that fetched it.
// The picture is fetched and then **shown on the screen it was asked for from**, and the ways to
// keep it sit under it as their own controls:
//
//   * Press and hold the picture — the iOS way to put an image in the photo library, and it needs
//     nothing from us.
//   * Share, where the browser has a share sheet that takes files. Its own press, so the
//     activation is fresh and Safari has no reason to refuse.
//   * Save the file, for a desktop browser. The blob URL it uses is revoked a minute later rather
//     than on the next line, because the browser reads it after the click, not before.
//
// Nothing navigates on any path, so there is never anything to come back from, and the picture is
// on screen either way — which is most of what was wanted.

// How long a blob URL is left alive after a save is started. The browser reads it asynchronously,
// so revoking it immediately is what produced WebKitBlobResource error 1; a minute is far longer
// than any read needs and the URL dies with the tab regardless.
const BLOB_LIFETIME_MS = 60_000;

function isDismissedByPerson(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

// Black or white text, whichever stays readable on the accent behind it. The shells hand over
// their own accent — ClickLog's is dark pink and wants white, SkillsHunt's is bright amber and
// wants near-black — and picking it here means neither caller has to think about it.
function readableTextOn(accent: string): string {
  const hex = accent.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return "#fff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.45 ? "#111111" : "#ffffff";
}

function messageFrom(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

async function failureMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

type Ready = { objectUrl: string; file: File };

function browserCanShareFile(ready: Ready | null): boolean {
  if (!ready) return false;
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  return navigator.canShare?.({ files: [ready.file] }) ?? false;
}

// Fetch the picture and put it where an <img> and a share sheet can both read it. Throws with the
// route's own sentence when the route refused, so the caller only has to catch.
async function drawPicture(url: string, filename: string): Promise<Ready> {
  const res = await fetch(url);
  if (!res.ok) {
    // Rule 137: the route's own sentence goes on screen; this one is only the fallback for a body
    // that carries nothing.
    throw new Error(await failureMessage(res, `The picture could not be drawn (${res.status}).`));
  }
  const blob = await res.blob();
  return {
    objectUrl: URL.createObjectURL(blob),
    file: new File([blob], filename, { type: blob.type || "image/png" }),
  };
}

// Every blob URL this control hands out, revoked together when the screen goes away, so none of
// them outlives it.
function useObjectUrlBin(): (objectUrl: string) => void {
  const bin = useRef<string[]>([]);
  useEffect(() => () => {
    for (const objectUrl of bin.current) URL.revokeObjectURL(objectUrl);
    bin.current = [];
  }, []);
  return useCallback((objectUrl: string) => {
    bin.current.push(objectUrl);
  }, []);
}

function secondaryButtonStyle(border: string, color: string): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "9px 14px",
    borderRadius: 10,
    background: "transparent",
    border: `1px solid ${border}`,
    color,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function DrawButton({ label, busy, busyLabel, accent, onAccent, onPress }: {
  label: string;
  busy: boolean;
  busyLabel: string;
  accent: string;
  onAccent: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
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
      <ImageIcon size={15} color={onAccent} />
      {busy ? busyLabel : label}
    </button>
  );
}

// The picture itself, on the screen that asked for it, with the three ways to keep it underneath.
// Press and hold is the one that needs no code and no permission — it is how a picture goes into
// the photo library on a phone — so it leads the note.
function PicturePanel({ ready, filename, accent, border, muted, shareNote, canShare, onShare, onSaveFile, onClose }: {
  ready: Ready;
  filename: string;
  accent: string;
  border: string;
  muted: string;
  shareNote: string | null;
  canShare: boolean;
  onShare: () => void;
  onSaveFile: () => void;
  onClose: () => void;
}) {
  return (
    <div>
      {/* A plain img, not next/image: the source is a blob: URL for a picture drawn a moment ago in
          this session, which the image pipeline can neither know about nor optimize. */}
      <img
        src={ready.objectUrl}
        // No "picture" or "image" in the alt: a screen reader already says it is one, and the
        // a11y audit (jsx-a11y/img-redundant-alt) refuses the words.
        alt={`What this screen just drew, as the file ${filename}`}
        style={{ display: "block", width: "100%", height: "auto", borderRadius: 10, border: `1px solid ${border}` }}
      />
      <div style={{ fontSize: 12, color: muted, marginTop: 10, lineHeight: 1.5 }}>
        On a phone, press and hold the picture to save it to your photos. On a computer, use Save
        the file.
      </div>
      {shareNote && (
        <div role="alert" style={{ fontSize: 12, color: "#EF4444", marginTop: 8, lineHeight: 1.5 }}>
          {shareNote}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {canShare && (
          <button type="button" onClick={onShare} style={secondaryButtonStyle(accent, accent)}>
            <Share2 size={14} />
            Share
          </button>
        )}
        <button type="button" onClick={onSaveFile} style={secondaryButtonStyle(border, muted)}>
          <Download size={14} />
          Save the file
        </button>
        <button type="button" onClick={onClose} style={secondaryButtonStyle(border, muted)}>
          <X size={14} />
          Done
        </button>
      </div>
    </div>
  );
}

export function SaveImageButton({
  url,
  filename,
  label,
  busyLabel = "Drawing the picture…",
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
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const onAccent = readableTextOn(accent);
  const trackObjectUrl = useObjectUrlBin();

  const draw = useCallback(async () => {
    setError(null);
    setShareNote(null);
    setBusy(true);
    try {
      const drawn = await drawPicture(url, filename);
      trackObjectUrl(drawn.objectUrl);
      setReady(drawn);
    } catch (caught) {
      reportError(caught, { area, op, extra: { url, filename } });
      setError(messageFrom(caught, "The picture could not be drawn."));
    } finally {
      setBusy(false);
    }
  }, [url, filename, area, op, trackObjectUrl]);

  // Its own press, so the activation Safari wants is fresh — the picture is already in hand and
  // nothing is awaited before the sheet is asked for.
  const share = useCallback(async (file: File) => {
    setShareNote(null);
    try {
      await navigator.share({ files: [file] });
    } catch (caught) {
      if (isDismissedByPerson(caught)) return;
      reportError(caught, { area, op: `${op}_share`, extra: { filename } });
      setShareNote("The share sheet would not open. Press and hold the picture to save it instead.");
    }
  }, [area, op, filename]);

  const saveFile = useCallback((objectUrl: string) => {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Not revoked here: the browser reads the URL after the click, and revoking on this line is
    // what produced WebKitBlobResource error 1 on iOS. The unmount cleanup above is the backstop.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), BLOB_LIFETIME_MS);
  }, [filename]);

  const close = useCallback(() => {
    setReady(null);
    setShareNote(null);
  }, []);

  const canShare = browserCanShareFile(ready);

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
      {!ready && (
        <DrawButton
          label={label}
          busy={busy}
          busyLabel={busyLabel}
          accent={accent}
          onAccent={onAccent}
          onPress={() => void draw()}
        />
      )}

      {error && (
        <div role="alert" style={{ fontSize: 12, color: "#EF4444", marginTop: 8, lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {ready && (
        <PicturePanel
          ready={ready}
          filename={filename}
          accent={accent}
          border={border}
          muted={muted}
          shareNote={shareNote}
          canShare={canShare}
          onShare={() => void share(ready.file)}
          onSaveFile={() => saveFile(ready.objectUrl)}
          onClose={close}
        />
      )}

      {children && !ready ? (
        <div style={{ fontSize: 11, color: muted, marginTop: 8, lineHeight: 1.5 }}>{children}</div>
      ) : null}
    </div>
  );
}
