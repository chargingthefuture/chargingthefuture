"use client";

import { useEffect, useState } from "react";
import type { CommonsMessage } from "lib/commons/types";
import styles from "./community-shell.module.css";

// Admins only: post a message with a picture to the Commons (owner decision, 2026-09-25). The owner
// explains the product with screenshots, and Quora erases the accounts those were shared from.
//
// The picture is scaled to at most 1600 pixels on its long side and re-encoded in the browser before
// it is sent. That keeps it small, and re-drawing it drops the location and camera data a phone writes
// into a photo, so none of that reaches the database.

const MAX_SIDE = 1600;

type Scaled = { blob: Blob; width: number; height: number };

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}

async function scalePicture(file: File): Promise<Scaled> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  // A browser that cannot write WebP hands back a PNG instead; a JPEG is much smaller than that.
  const webp = await canvasToBlob(canvas, "image/webp");
  const blob = webp && webp.type === "image/webp" ? webp : await canvasToBlob(canvas, "image/jpeg");
  if (!blob) throw new Error("This browser could not prepare the picture. Try another browser.");
  return { blob, width, height };
}

async function sendPicture(file: File, alt: string, text: string): Promise<CommonsMessage> {
  const scaled = await scalePicture(file);
  const form = new FormData();
  form.set("image", scaled.blob, "picture");
  form.set("alt", alt);
  form.set("text", text);
  form.set("width", String(scaled.width));
  form.set("height", String(scaled.height));
  const response = await fetch("/api/commons/images", { method: "POST", headers: { "x-ctf-csrf": "1" }, body: form });
  const payload = (await response.json().catch(() => null)) as { message?: CommonsMessage | string } | null;
  if (!response.ok || typeof payload?.message !== "object") {
    const reason = typeof payload?.message === "string" ? payload.message : `The server answered ${response.status}.`;
    throw new Error(`The picture was not shared. ${reason}`);
  }
  return payload.message;
}

// A preview of the chosen file, released when the file changes or the panel closes.
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

function SharePanel({ onShared, onClose }: { onShared: (message: CommonsMessage) => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = usePreviewUrl(file);
  const ready = Boolean(file) && alt.trim().length > 0 && text.trim().length > 0 && !busy;

  async function share() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onShared(await sendPicture(file, alt.trim(), text.trim()));
      onClose();
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "The picture was not shared.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.imageSharePanel} aria-label="Share a picture">
      <label className={styles.imageShareLabel}>
        Picture
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>
      {previewUrl ? <img src={previewUrl} alt="" className={styles.imageSharePreview} /> : null}
      <label className={styles.imageShareLabel}>
        What it shows (read aloud to members using a screen reader)
        <textarea className={styles.imageShareField} rows={2} maxLength={500} value={alt} onChange={(event) => setAlt(event.target.value)} />
      </label>
      <label className={styles.imageShareLabel}>
        Message
        <textarea className={styles.imageShareField} rows={3} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      {error ? <p role="alert" className={styles.imageShareError}>{error}</p> : null}
      <div className={styles.chatActionRow}>
        <button type="button" className={styles.chatActionBtn} disabled={!ready} onClick={() => void share()}>
          {busy ? "Sharing…" : "Share"}
        </button>
        <button type="button" className={styles.chatActionBtn} disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </div>
    </section>
  );
}

export function CommonsImageShare({ onShared }: { onShared: (message: CommonsMessage) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className={styles.imageShareToggle}>
        <button type="button" className={styles.chatActionBtn} onClick={() => setOpen(true)}>
          Share a picture (admins)
        </button>
      </div>
    );
  }
  return <SharePanel onShared={onShared} onClose={() => setOpen(false)} />;
}
