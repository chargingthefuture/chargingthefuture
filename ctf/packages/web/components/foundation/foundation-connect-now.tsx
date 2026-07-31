"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { PhoneCall, X } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getFoundationTokens, type ProviderView } from "./foundation-ui";
import { useInstantCall } from "./foundation-instant-call";
import {
  FOUNDATION_INSTANT_CALL_DEFAULT_AUTHORIZED_BLOCKS,
  FOUNDATION_INSTANT_CALL_MAX_AUTHORIZED_BLOCKS,
} from "@/lib/foundation/constants";

// Whole ServiceCredits per block of N minutes, e.g. "5 ServiceCredits / 10 min". ServiceCredits is
// one joined word per the brand lexicon. The amount is only rendered when the provider has a valid
// rate set; the caller already gates on instantCallEnabled + a numeric rate.
export function instantCallRateLabel(rateCredits: number, intervalMinutes: number): string {
  const credits = rateCredits === 1 ? "1 ServiceCredit" : `${rateCredits} ServiceCredits`;
  return `${credits} / ${intervalMinutes} min`;
}

// True when this provider is reachable for an instant call at all: they opted in and set a valid
// whole-credit rate (>= 1). This is viewer-independent — it's used to surface a passive "accepts
// 1:1 calls" badge to everyone, including the provider themselves (so they can confirm their own
// setting is live). The actionable "Connect now" button uses canOfferConnectNow instead.
export function acceptsInstantCalls(provider: ProviderView): boolean {
  if (!provider.instantCallEnabled) {
    return false;
  }
  const rate = provider.instantCallRateCredits;
  if (rate === null || !Number.isFinite(rate) || rate < 1) {
    return false;
  }
  return true;
}

// True when the signed-in viewer is the same member who owns this provider profile. Both ids come from
// the same source: the providers/search route returns viewerUserId = the signed-in user id, and
// provider.providerUserId is the directory profile's claimed_by_user_id. That is the exact comparison the
// server uses to reject a self-connection (see createConnectionThread). You can't request a quote from, or
// ring, yourself — so callers use this to disable those actions on your own profile instead of letting the
// request fail server-side with a generic error.
export function isOwnProfile(provider: ProviderView, viewerUserId: string | null): boolean {
  return Boolean(viewerUserId) && provider.providerUserId === viewerUserId;
}

// True only when this provider is reachable for an instant call AND it should be offered to this
// viewer: they accept calls (acceptsInstantCalls) and the viewer is not the provider themselves
// (you can't ring yourself). The unlock gate is handled upstream — only an unlocked member ever
// sees the Foundation provider list.
export function canOfferConnectNow(provider: ProviderView, viewerUserId: string | null): boolean {
  if (!acceptsInstantCalls(provider)) {
    return false;
  }
  if (isOwnProfile(provider, viewerUserId)) {
    return false;
  }
  return true;
}

// A passive, non-interactive pill that states the provider accepts live 1:1 calls and at what rate.
// Shown wherever "Connect now" can't be offered to this viewer but the provider still accepts calls —
// most importantly on the provider's own profile, so they can see their setting is live. Caller gates
// on acceptsInstantCalls before rendering this.
export function InstantCallAvailabilityBadge({
  provider, compact = false,
}: {
  provider: ProviderView;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const rate = provider.instantCallRateCredits ?? 0;
  const rateLabel = instantCallRateLabel(rate, provider.instantCallIntervalMinutes);
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: compact ? "6px 12px" : "9px 16px",
        borderRadius: compact ? 8 : 10,
        background: `${t.ACCENT}12`, color: t.ACCENT,
        fontSize: compact ? 12 : 13.5, fontWeight: 600,
        border: `1px solid ${t.ACCENT}30`, flexShrink: 0,
        // Wrap and cap at the container width so the badge never forces horizontal overflow on a
        // narrow screen (the label + rate can be wider than a phone-width column).
        flexWrap: "wrap", maxWidth: "100%",
      }}
    >
      <PhoneCall size={compact ? 14 : 16} />
      <span>Accepts live 1:1 calls</span>
      <span style={{ fontWeight: 600, opacity: 0.85 }}>· {rateLabel}</span>
    </span>
  );
}

// The "Connect now" entry point: a button that shows the rate and block length, and on click opens a
// consent dialog previewing the cost and a plain-language disclaimer. On confirm it places a live audio
// ring through the instant-call controller (issue #808 task 3). Billing is task 4 — the consent copy is
// honest that no charge happens yet in this version. The button only renders when canOfferConnectNow is
// true (checked by the caller).
export function ConnectNowButton({
  provider, compact = false,
}: {
  provider: ProviderView;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const [open, setOpen] = useState(false);

  // canOfferConnectNow guarantees a numeric rate >= 1 before this renders, but narrow defensively so
  // the label never shows a null.
  const rate = provider.instantCallRateCredits ?? 0;
  const interval = provider.instantCallIntervalMinutes;
  const rateLabel = instantCallRateLabel(rate, interval);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => { e.stopPropagation(); }}
        aria-label={`Connect now — ${rateLabel}`}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: compact ? "7px 14px" : "10px 18px",
          borderRadius: compact ? 8 : 10,
          background: t.ACCENT, color: "#1a1205",
          fontSize: compact ? 12 : 14, fontWeight: 700,
          border: "none", cursor: "pointer", flexShrink: 0,
          // Wrap and cap at the container width so the button never forces horizontal overflow on a
          // narrow screen (the label + rate can be wider than a phone-width column).
          flexWrap: "wrap", maxWidth: "100%",
        }}
      >
        <PhoneCall size={compact ? 14 : 16} />
        <span>Connect now</span>
        <span style={{ fontWeight: 600, opacity: 0.85 }}>· {rateLabel}</span>
      </button>

      {open ? (
        <ConnectNowDialog
          provider={provider}
          rateLabel={rateLabel}
          intervalMinutes={interval}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

// The buyer pre-authorizes a maximum number of blocks at confirm time (issue #808 task 4). The call can
// never run past this cap in v1.
//
// The default and the ceiling are IMPORTED from the server constants rather than repeated here. They
// matched before, so nothing was broken — but a comment saying "the max matches the server hard cap" is
// only true until someone changes one side, and then the picker offers a value `normalizeAuthorizedBlocks`
// throws `invalid_authorized_blocks` on, which the buyer sees as an opaque failure after they have already
// consented to spend. Deriving the list means the two cannot drift.
const BLOCK_CAP_OPTIONS = [1, 2, 3, 4, 6, 8, 12, FOUNDATION_INSTANT_CALL_MAX_AUTHORIZED_BLOCKS].filter(
  (n, i, all) => n <= FOUNDATION_INSTANT_CALL_MAX_AUTHORIZED_BLOCKS && all.indexOf(n) === i,
);
const DEFAULT_BLOCK_CAP = FOUNDATION_INSTANT_CALL_DEFAULT_AUTHORIZED_BLOCKS;

type FoundationTokens = ReturnType<typeof getFoundationTokens>;
type InstantCallController = ReturnType<typeof useInstantCall>;

// "1 ServiceCredit" vs "N ServiceCredits" — ServiceCredits is one joined word per the brand lexicon.
function serviceCreditsLabel(count: number): string {
  if (count === 1) {
    return "1 ServiceCredit";
  }
  return `${count} ServiceCredits`;
}

// "1 block" vs "N blocks".
function blocksLabel(count: number): string {
  if (count === 1) {
    return "1 block";
  }
  return `${count} blocks`;
}

// The "Start call" button is only actionable once the buyer has consented, no ring is already being
// placed, and the instant-call controller is mounted. Kept as one derivation so the button's disabled
// state and styling can't drift apart.
function canStartCall(consented: boolean, starting: boolean, instantCall: InstantCallController): boolean {
  if (!consented) {
    return false;
  }
  if (starting) {
    return false;
  }
  if (!instantCall) {
    return false;
  }
  return true;
}

// Styling for the "Start call" button, switched on whether the button is actionable.
function startCallButtonStyle(t: FoundationTokens, canStart: boolean): CSSProperties {
  return {
    width: "100%",
    padding: "12px 18px",
    borderRadius: 10,
    background: canStart ? t.ACCENT : t.BORDER,
    color: canStart ? "#1a1205" : t.MUTED,
    fontSize: 14,
    fontWeight: 700,
    border: canStart ? "none" : `1px solid ${t.BORDER_HI}`,
    cursor: canStart ? "pointer" : "not-allowed",
  };
}

function ConnectNowDialog({
  provider, rateLabel, intervalMinutes, onClose,
}: {
  provider: ProviderView;
  rateLabel: string;
  intervalMinutes: number;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  const providerName = provider.displayName;
  const rate = provider.instantCallRateCredits ?? 0;
  const [consented, setConsented] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorizedBlocks, setAuthorizedBlocks] = useState(DEFAULT_BLOCK_CAP);
  const instantCall = useInstantCall();

  // The most the caller can be charged on this call: rate per block times the authorized cap. Shown so the
  // buyer sees the worst-case total before they agree.
  const maxSpend = rate * authorizedBlocks;
  const maxSpendLabel = serviceCreditsLabel(maxSpend);
  const maxMinutes = intervalMinutes * authorizedBlocks;
  const canStart = canStartCall(consented, starting, instantCall);

  // Place the ring through the controller, then close the consent dialog so the controller's call overlay
  // (ringing -> in-call) takes over. The controller owns the lifecycle from here. A failed ring (e.g. not
  // enough ServiceCredits) keeps the dialog open and shows the reason.
  const onStart = async () => {
    if (!consented || starting || !instantCall) {
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const result = await instantCall.startCall(provider, authorizedBlocks);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    } finally {
      setStarting(false);
    }
  };

  // Close on Escape so keyboard users have the same "dismiss" the backdrop click gives mouse users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a mouse convenience; keyboard users close via Escape (handler above) or the visible close button.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect now confirmation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(8,9,13,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 440,
          background: "#11131A",
          border: `1px solid ${t.ACCENT}30`,
          borderRadius: 16,
          padding: "22px 22px 20px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          maxHeight: "calc(100dvh - 32px)", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <PhoneCall size={18} color={t.ACCENT} />
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: t.TITLE }}>Connect now</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: t.SUBTLE, cursor: "pointer", padding: 4, display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: 13.5, color: t.SUBTLE, lineHeight: 1.6, marginBottom: 14 }}>
          Start a live, paid 1:1 call with <strong style={{ color: t.TITLE }}>{providerName}</strong> right now.
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 12, background: `${t.ACCENT}10`, border: `1px solid ${t.ACCENT}28`, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 6 }}>Rate</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: t.ACCENT }}>{rateLabel}</div>
          <div style={{ fontSize: 12.5, color: t.SUBTLE, marginTop: 4 }}>
            You&apos;re charged this rate for each {intervalMinutes}-minute block. The first block is charged
            when {providerName} answers. You can end the call anytime.
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="connect-now-block-cap" style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: t.MUTED, textTransform: "uppercase", marginBottom: 6 }}>
            Spend limit
          </label>
          <select
            id="connect-now-block-cap"
            value={authorizedBlocks}
            onChange={(e) => setAuthorizedBlocks(Number(e.target.value))}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              background: t.INPUT_BG, border: "1px solid rgba(255,255,255,0.12)",
              color: t.TITLE, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            {BLOCK_CAP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {blocksLabel(n)} · up to {n * intervalMinutes} min
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12.5, color: t.SUBTLE, marginTop: 6, lineHeight: 1.5 }}>
            The call will not run past this limit. You&apos;ll be charged for at most{" "}
            <strong style={{ color: t.TITLE }}>{maxSpendLabel}</strong> ({blocksLabel(authorizedBlocks)}, up to {maxMinutes} min).
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: t.SUBTLE, lineHeight: 1.7, marginBottom: 14 }}>
          This starts a live 1:1 call. You&apos;ll be charged the provider&apos;s rate per block until you
          end it or reach your spend limit. Only start a call you mean to pay for.
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: "#F87171", lineHeight: 1.5, marginBottom: 12 }}>{error}</div>
        ) : null}

        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: t.ACCENT, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: "#D1D5DB", lineHeight: 1.5 }}>
            I understand this is a paid call and I agree to be charged {rateLabel}, up to {maxSpendLabel}.
          </span>
        </label>

        <button
          type="button"
          disabled={!canStart}
          aria-disabled={!canStart}
          onClick={() => void onStart()}
          style={startCallButtonStyle(t, canStart)}
        >
          {starting ? "Starting…" : "Start call"}
        </button>
        <div style={{ marginTop: 10, fontSize: 12, color: t.SUBTLE, lineHeight: 1.6, textAlign: "center" }}>
          The first block is charged when the provider answers. Ringing is free, and you only pay for blocks
          you use up to your limit.
        </div>
      </div>
    </div>
  );
}
