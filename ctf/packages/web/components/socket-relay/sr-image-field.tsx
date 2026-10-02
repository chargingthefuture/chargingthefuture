"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { ShieldAlert, X } from "lucide-react";
import { scalePicture } from "lib/images/scale-picture";
import type { SocketRelayTokens, SrRequestImage } from "./sr-shared";

// The one picture a SocketRelay request can carry (owner decision, 2026-10-02: SocketRelay is a
// classifieds board, and a listing reads faster with a photo of the thing).
//
// An inappropriate picture is an automatic ban, with no exceptions. The warning sits above the file
// picker and the picker stays disabled until the member ticks that they have read it, so nobody can
// upload without seeing it first. The upload route refuses a picture sent without the tick.

export type PostImageDraft = {
  // A newly chosen picture, not yet uploaded.
  file: File | null;
  alt: string;
  acknowledged: boolean;
  // The picture already on the request being edited, if any.
  existing: SrRequestImage | null;
  // Set when the member removes the existing picture while editing.
  remove: boolean;
};

export const EMPTY_IMAGE_DRAFT: PostImageDraft = { file: null, alt: "", acknowledged: false, existing: null, remove: false };

export const IMAGE_MAX_ALT_LENGTH = 300;

// Upload (PUT) the chosen picture, or remove (DELETE) the existing one, after the request is saved.
// Throws with the server's reason so the form can say the request saved but the picture did not.
export async function saveRequestImage(requestId: string, image: PostImageDraft): Promise<void> {
  const url = `/api/socket-relay/requests/${encodeURIComponent(requestId)}/image`;
  let res: Response;
  if (image.file) {
    const scaled = await scalePicture(image.file);
    const form = new FormData();
    form.set("image", scaled.blob, "picture");
    form.set("alt", image.alt.trim());
    form.set("width", String(scaled.width));
    form.set("height", String(scaled.height));
    form.set("acknowledged", image.acknowledged ? "1" : "0");
    res = await fetch(url, { method: "PUT", headers: { "x-ctf-csrf": "1" }, body: form });
  } else if (image.remove && image.existing) {
    res = await fetch(url, { method: "DELETE", headers: { "x-ctf-csrf": "1" } });
  } else {
    return;
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `The server answered ${res.status}.`);
  }
}

// Checked before the request is saved, so a missing description stops the post instead of leaving it
// up without its picture.
export function validateImageDraft(image: PostImageDraft): string | null {
  if (!image.file) return null;
  if (!image.acknowledged) return "Tick the box to confirm you have read the picture rule.";
  if (!image.alt.trim()) return "Describe what the picture shows.";
  if (image.alt.trim().length > IMAGE_MAX_ALT_LENGTH) return `The picture description is over ${IMAGE_MAX_ALT_LENGTH} characters.`;
  return null;
}

// A preview of the chosen file, released when the file changes or the form unmounts.
function usePreviewUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function PictureRuleWarning({ id, t }: { id: string; t: SocketRelayTokens }) {
  return (
    <div id={id} role="note" style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: t.TEXT, fontSize: 13, lineHeight: 1.55 }}>
      <ShieldAlert size={18} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
      <div>
        <strong style={{ color: "#EF4444" }}>Read this before you add a picture.</strong> A picture must show what your post is about: the item, the place, or the job. Uploading an inappropriate picture to SocketRelay is an automatic ban from the app. There are no exceptions.
      </div>
    </div>
  );
}

// The newly chosen picture, or the existing one while editing, with an X that clears it.
function PicturePreview({
  image,
  previewUrl,
  onChange,
  t,
}: {
  image: PostImageDraft;
  previewUrl: string | null;
  onChange: (patch: Partial<PostImageDraft>) => void;
  t: SocketRelayTokens;
}) {
  const existing = image.remove ? null : image.existing;
  const src = previewUrl ?? existing?.url ?? null;
  if (!src) return null;
  return (
    <div style={{ position: "relative", maxWidth: 320 }}>
      <img src={src} alt={previewUrl ? "" : existing?.alt ?? ""} style={{ display: "block", width: "100%", height: "auto", borderRadius: 10, border: `1px solid ${t.BORDER_STRONG}` }} />
      <button
        type="button"
        aria-label="Remove picture"
        onClick={() => onChange(image.file ? { file: null } : { remove: true })}
        style={{ position: "absolute", top: 6, right: 6, display: "inline-flex", padding: 6, borderRadius: 999, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer" }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function SocketRelayImageField({
  image,
  onChange,
  t,
  fieldStyle,
}: {
  image: PostImageDraft;
  onChange: (patch: Partial<PostImageDraft>) => void;
  t: SocketRelayTokens;
  fieldStyle: CSSProperties;
}) {
  const ids = useId();
  const warningId = `${ids}-warning`;
  const previewUrl = usePreviewUrl(image.file);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.TEXT }}>
        Picture <span style={{ fontWeight: 400, color: t.MUTED }}>(optional)</span>
      </div>
      <PictureRuleWarning id={warningId} t={t} />
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: t.TEXT, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={image.acknowledged}
          onChange={(e) => onChange(e.target.checked ? { acknowledged: true } : { acknowledged: false, file: null })}
          aria-describedby={warningId}
          style={{ marginTop: 2 }}
        />
        I understand that an inappropriate picture is an automatic ban, with no exceptions.
      </label>
      <input
        // Remounted when the chosen file is cleared, so the picker does not keep showing its name.
        key={image.file ? "chosen" : "empty"}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Choose a picture"
        aria-describedby={warningId}
        disabled={!image.acknowledged}
        onChange={(e) => onChange({ file: e.target.files?.[0] ?? null, remove: false })}
        style={{ fontSize: 13, color: image.acknowledged ? t.TEXT : t.MUTED }}
      />
      <PicturePreview image={image} previewUrl={previewUrl} onChange={onChange} t={t} />
      {image.file && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: t.TEXT }}>
          What the picture shows (read aloud to members using a screen reader)
          <input value={image.alt} maxLength={IMAGE_MAX_ALT_LENGTH} onChange={(e) => onChange({ alt: e.target.value })} placeholder="e.g. A wooden desk chair with a blue cushion" style={fieldStyle} />
        </label>
      )}
    </div>
  );
}
