"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Share2, Copy, Check, ExternalLink } from "lucide-react";

// THE shared way to share any URL across the web app (the v2 "useLink" pattern). A trigger button opens
// a small popup that (1) shows the full, absolute link, (2) lets you open it in a new tab, and (3)
// copies it with clear feedback. Every "share"/"copy link" affordance in the app must use this — never a
// bare copy button or a raw window.open. See .claude/rules/130-link-sharing-and-copy-url-rules.mdc.
//
// Accessibility: the trigger has aria-haspopup/aria-expanded; the popup is a labeled dialog; opening it
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
    // Legacy best-effort fallback for old / insecure-context browsers that lack the async Clipboard
    // API. Note (iOS Safari): programmatic el.select() + execCommand('copy') can report success while
    // copying nothing without a direct user gesture on the element, and execCommand is deprecated. The
    // popover always shows the selectable URL field, so a member can copy by hand; the caller also
    // surfaces a "Copy failed" state when this returns false so a silent no-op is not mistaken for a
    // successful copy.
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

// Decide which way the popup opens from the trigger. Vertically: open below when there isn't room
// above (~190px covers title + URL field + two rows + padding), otherwise above. Horizontally:
// right-align when growing rightward would cross the viewport's right edge (which forces the page into
// horizontal scroll on a phone), otherwise grow rightward from the left edge. Kept module-scope so the
// several ?./??/?: it needs stay out of the effect's complexity count.
function computePopupPosition(rect: DOMRect | undefined): {
  placement: "top" | "bottom";
  align: "left" | "right";
} {
  const POPUP_HEIGHT = 190;
  const POPUP_WIDTH = 280;
  const triggerTop = rect?.top ?? POPUP_HEIGHT + 1;
  const triggerLeft = rect?.left ?? 0;
  return {
    placement: triggerTop < POPUP_HEIGHT + 16 ? "bottom" : "top",
    align: triggerLeft + POPUP_WIDTH > window.innerWidth - 16 ? "right" : "left",
  };
}

// The share popover: the selectable URL field plus the "Copy link" and "Open in new tab" actions.
// Kept module-scope so its placement/copy-state ternaries stay out of the ShareLink complexity count.
function ShareLinkPopup({
  dialogId,
  title,
  placement,
  align,
  absolute,
  copied,
  copyFailed,
  urlRef,
  onCopy,
  onOpenNewTab,
}: {
  dialogId: string;
  title: string;
  placement: "top" | "bottom";
  align: "left" | "right";
  absolute: string;
  copied: boolean;
  copyFailed: boolean;
  urlRef: React.RefObject<HTMLInputElement | null>;
  onCopy: () => void;
  onOpenNewTab: () => void;
}) {
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
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- stopPropagation only prevents the outside-click-close from firing on the popover's own content; it is event management, not a user action. The popover's controls are focusable buttons.
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
        ...(align === "right" ? { right: 0 } : { left: 0 }),
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
      <button type="button" onClick={onCopy} style={itemStyle}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
        <span aria-live="polite">{copied ? "Copied!" : copyFailed ? "Copy failed — copy the link above" : "Copy link"}</span>
      </button>
      <button type="button" onClick={onOpenNewTab} style={itemStyle}>
        <ExternalLink size={15} />
        <span>Open in new tab</span>
      </button>
    </div>
  );
}

export function ShareLink({
  url,
  label = "Share",
  title = "Share this link",
  className,
  iconSize = 14,
  children,
  triggerStyle,
}: {
  /** Absolute or app-relative URL. Relative is resolved against the current origin before sharing. */
  url: string;
  /** Visible text on the trigger button. */
  label?: string;
  /** Heading shown inside the popup. */
  title?: string;
  className?: string;
  iconSize?: number;
  /** Custom trigger content. When set, it replaces the default share icon + label entirely (e.g. a
   * full-width link-out card); the popup behavior is unchanged. */
  children?: React.ReactNode;
  /** Styles for the trigger button — mainly for custom (children) triggers. */
  triggerStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // True briefly when a copy attempt returned false (old browser / iOS gesture limit), so the member
  // is told to copy the shown URL by hand instead of assuming it worked.
  const [copyFailed, setCopyFailed] = useState(false);
  // The popup opens above the trigger by default, but flips below when the trigger sits near the top
  // of the viewport — otherwise the popup is clipped behind the header (the "modal doesn't fit" bug).
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  // Same idea horizontally: the popup grows rightward from the trigger's left edge by default, but a
  // trigger near the right edge of the viewport (the usual header position) would push it off-screen
  // and force the whole page into horizontal scroll — so it flips to grow leftward instead.
  const [align, setAlign] = useState<"left" | "right">("left");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const dialogId = useId();

  const absolute = toAbsolute(url);

  useEffect(() => {
    if (!open) return;
    // Decide which way the popup opens (see computePopupPosition) so it isn't clipped by the header
    // or pushed off the right edge into horizontal scroll.
    const rect = triggerRef.current?.getBoundingClientRect();
    const position = computePopupPosition(rect);
    setPlacement(position.placement);
    setAlign(position.align);
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
    setCopyFailed(!ok);
    window.setTimeout(() => {
      setCopied(false);
      setCopyFailed(false);
    }, 2000);
  }

  function onOpenNewTab() {
    window.open(absolute, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ position: "relative", display: children ? "block" : "inline-flex" }}>
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
        style={
          children
            ? { background: "transparent", border: "none", padding: 0, margin: 0, cursor: "pointer", color: "inherit", font: "inherit", width: "100%", textAlign: "left", ...triggerStyle }
            : { display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", padding: 0, margin: 0, cursor: "pointer", color: "inherit", font: "inherit", ...triggerStyle }
        }
      >
        {children ?? (
          <>
            <Share2 size={iconSize} />
            <span>{label}</span>
          </>
        )}
      </button>

      {open ? (
        <ShareLinkPopup
          dialogId={dialogId}
          title={title}
          placement={placement}
          align={align}
          absolute={absolute}
          copied={copied}
          copyFailed={copyFailed}
          urlRef={urlRef}
          onCopy={() => void onCopy()}
          onOpenNewTab={onOpenNewTab}
        />
      ) : null}
    </div>
  );
}
