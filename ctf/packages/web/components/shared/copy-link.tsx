"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Reusable "copy this link" control — the platform baseline for sharing any URL (a UX + accessibility
// requirement: visible affordance, keyboard-operable, and clear "Copied!" feedback). Copies an ABSOLUTE
// URL so the link works when pasted elsewhere: a relative path (e.g. "/apps/socket-relay") is resolved
// against the current origin. Falls back to a hidden textarea + execCommand when the async clipboard API
// is unavailable (older mobile browsers / insecure contexts), so it never silently does nothing.

function toAbsolute(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return url;
  }
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function CopyLink({
  url,
  label = "Copy link",
  className,
  iconSize = 14,
}: {
  url: string;
  label?: string;
  className?: string;
  iconSize?: number;
}) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function onCopy(event: React.MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    const absolute = toAbsolute(url);
    const ok = await writeToClipboard(absolute);
    setState(ok ? "copied" : "error");
    window.setTimeout(() => setState("idle"), 2000);
  }

  const text = state === "copied" ? "Copied!" : state === "error" ? "Press to copy" : label;
  const absoluteForTitle = typeof window !== "undefined" ? toAbsolute(url) : url;

  return (
    <button
      type="button"
      onClick={(e) => void onCopy(e)}
      className={className}
      title={absoluteForTitle}
      aria-label={state === "copied" ? "Link copied to clipboard" : label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        cursor: "pointer",
        color: "inherit",
        font: "inherit",
      }}
    >
      {state === "copied" ? <Check size={iconSize} /> : <Copy size={iconSize} />}
      <span aria-live="polite">{text}</span>
    </button>
  );
}
