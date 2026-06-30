"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Share2, Copy, Check, ExternalLink } from "lucide-react";

// THE shared way to share any URL across the web app (the v2 "useLink" pattern). A trigger button opens
// a small popup that (1) shows the full, absolute link, (2) lets you open it in a new tab, and (3)
// copies it with clear feedback. Every "share"/"copy link" affordance in the app must use this — never a
// bare copy button or a raw window.open. See .claude/rules/130-link-sharing-and-copy-url-rules.mdc.
//
// Accessibility: the trigger has aria-haspopup/aria-expanded; the popup is a labelled dialog; opening it
// moves focus to the (selectable) URL field; Escape and an outside click close it and return focus to the
// trigger; copy feedback is announced via aria-live.

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
    // fall through to the legacy path (older mobile browsers / insecure contexts)
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

export function ShareLink({
  url,
  label = "Share",
  title = "Share this link",
  className,
  iconSize = 14,
}: {
  /** Absolute or app-relative URL. Relative is resolved against the current origin before sharing. */
  url: string;
  /** Visible text on the trigger button. */
  label?: string;
  /** Heading shown inside the popup. */
  title?: string;
  className?: string;
  iconSize?: number;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // The popup opens above the trigger by default, but flips below when the trigger sits near the top
  // of the viewport — otherwise the popup is clipped behind the header (the "modal doesn't fit" bug).
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const dialogId = useId();

  const absolute = toAbsolute(url);

  useEffect(() => {
    if (!open) return;
    // Decide which way to open: if there isn't room for the popup above the trigger, open below.
    // ~190px covers the popup (title + URL field + two rows + padding).
    const POPUP_HEIGHT = 190;
    const triggerTop = triggerRef.current?.getBoundingClientRect().top ?? POPUP_HEIGHT + 1;
    setPlacement(triggerTop < POPUP_HEIGHT + 16 ? "bottom" : "top");
    // Focus the URL field so a keyboard/AT user lands on the link itself.
    urlRef.current?.focus();
    urlRef.current?.select();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  async function onCopy() {
    const ok = await writeToClipboard(absolute);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function onOpenNewTab() {
    window.open(absolute, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "8px 10px",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: "var(--ctf-text, #E8EAF0)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  };

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", padding: 0, margin: 0, cursor: "pointer", color: "inherit", font: "inherit" }}
      >
        <Share2 size={iconSize} />
        <span>{label}</span>
      </button>

      {open ? (
        <div
          id={dialogId}
          role="dialog"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            ...(placement === "top"
              ? { bottom: "calc(100% + 8px)" }
              : { top: "calc(100% + 8px)" }),
            left: 0,
            zIndex: 50,
            width: 280,
            maxWidth: "80vw",
            padding: 12,
            background: "var(--ctf-panel, #161B27)",
            border: "1px solid var(--ctf-border, #1E2A3A)",
            borderRadius: 12,
            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ctf-text-secondary, #9CA3AF)" }}>{title}</div>
          <input
            ref={urlRef}
            readOnly
            value={absolute}
            aria-label="Link URL"
            onFocus={(e) => e.currentTarget.select()}
            style={{ width: "100%", padding: "8px 10px", background: "var(--ctf-surface, rgba(255,255,255,0.04))", border: "1px solid var(--ctf-border, rgba(255,255,255,0.08))", borderRadius: 8, fontSize: 12, color: "var(--ctf-text, #E8EAF0)", outline: "none", boxSizing: "border-box" }}
          />
          <button type="button" onClick={() => void onCopy()} style={itemStyle}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span aria-live="polite">{copied ? "Copied!" : "Copy link"}</span>
          </button>
          <button type="button" onClick={onOpenNewTab} style={itemStyle}>
            <ExternalLink size={15} />
            <span>Open in new tab</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
