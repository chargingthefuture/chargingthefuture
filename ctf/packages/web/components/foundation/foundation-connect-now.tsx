"use client";

import { useState } from "react";
import { PhoneCall, X } from "lucide-react";
import { COLOR, type ProviderView } from "./foundation-ui";
import { useInstantCall } from "./foundation-instant-call";

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

// True only when this provider is reachable for an instant call AND it should be offered to this
// viewer: they accept calls (acceptsInstantCalls) and the viewer is not the provider themselves
// (you can't ring yourself). The unlock gate is handled upstream — only an unlocked member ever
// sees the Foundation provider list.
export function canOfferConnectNow(provider: ProviderView, viewerUserId: string | null): boolean {
  if (!acceptsInstantCalls(provider)) {
    return false;
  }
  if (viewerUserId && provider.providerUserId === viewerUserId) {
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
  const rate = provider.instantCallRateCredits ?? 0;
  const rateLabel = instantCallRateLabel(rate, provider.instantCallIntervalMinutes);
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: compact ? "6px 12px" : "9px 16px",
        borderRadius: compact ? 8 : 10,
        background: `${COLOR}12`, color: COLOR,
        fontSize: compact ? 12 : 13.5, fontWeight: 600,
        border: `1px solid ${COLOR}30`, flexShrink: 0,
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
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: compact ? "7px 14px" : "10px 18px",
          borderRadius: compact ? 8 : 10,
          background: COLOR, color: "#1a1205",
          fontSize: compact ? 12 : 14, fontWeight: 700,
          border: "none", cursor: "pointer", flexShrink: 0,
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
// never run past this cap in v1. These are the selectable caps; the default is 6 (matches the server
// default FOUNDATION_INSTANT_CALL_DEFAULT_AUTHORIZED_BLOCKS) and the max matches the server hard cap.
const BLOCK_CAP_OPTIONS = [1, 2, 3, 4, 6, 8, 12, 24];
const DEFAULT_BLOCK_CAP = 6;

function ConnectNowDialog({
  provider, rateLabel, intervalMinutes, onClose,
}: {
  provider: ProviderView;
  rateLabel: string;
  intervalMinutes: number;
  onClose: () => void;
}) {
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
  const maxSpendLabel = maxSpend === 1 ? '1 ServiceCredit' : `${maxSpend} ServiceCredits`;
  const maxMinutes = intervalMinutes * authorizedBlocks;

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect now confirmation"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(8,9,13,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440,
          background: "#11131A",
          border: `1px solid ${COLOR}30`,
          borderRadius: 16,
          padding: "22px 22px 20px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          maxHeight: "calc(100dvh - 32px)", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <PhoneCall size={18} color={COLOR} />
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: "#F9FAFB" }}>Connect now</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 4, display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: 13.5, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 14 }}>
          Start a live, paid 1:1 call with <strong style={{ color: "#F9FAFB" }}>{providerName}</strong> right now.
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 12, background: `${COLOR}10`, border: `1px solid ${COLOR}28`, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 6 }}>Rate</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: COLOR }}>{rateLabel}</div>
          <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 4 }}>
            You&apos;re charged this rate for each {intervalMinutes}-minute block. The first block is charged
            when {providerName} answers. You can end the call anytime.
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="connect-now-block-cap" style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 6 }}>
            Spend limit
          </label>
          <select
            id="connect-now-block-cap"
            value={authorizedBlocks}
            onChange={(e) => setAuthorizedBlocks(Number(e.target.value))}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
              color: "#F9FAFB", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            {BLOCK_CAP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 block" : `${n} blocks`} · up to {n * intervalMinutes} min
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 6, lineHeight: 1.5 }}>
            The call will not run past this limit. You&apos;ll be charged for at most{" "}
            <strong style={{ color: "#F9FAFB" }}>{maxSpendLabel}</strong> ({authorizedBlocks === 1 ? "1 block" : `${authorizedBlocks} blocks`}, up to {maxMinutes} min).
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: "#9CA3AF", lineHeight: 1.7, marginBottom: 14 }}>
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
            style={{ marginTop: 2, width: 16, height: 16, accentColor: COLOR, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: "#D1D5DB", lineHeight: 1.5 }}>
            I understand this is a paid call and I agree to be charged {rateLabel}, up to {maxSpendLabel}.
          </span>
        </label>

        <button
          type="button"
          disabled={!consented || starting || !instantCall}
          aria-disabled={!consented || starting || !instantCall}
          onClick={() => void onStart()}
          style={{
            width: "100%",
            padding: "12px 18px",
            borderRadius: 10,
            background: consented && !starting && instantCall ? COLOR : "rgba(255,255,255,0.06)",
            color: consented && !starting && instantCall ? "#1a1205" : "#6B7280",
            fontSize: 14, fontWeight: 700,
            border: consented && !starting && instantCall ? "none" : "1px solid rgba(255,255,255,0.10)",
            cursor: consented && !starting && instantCall ? "pointer" : "not-allowed",
          }}
        >
          {starting ? "Starting…" : "Start call"}
        </button>
        <div style={{ marginTop: 10, fontSize: 12, color: "#9CA3AF", lineHeight: 1.6, textAlign: "center" }}>
          The first block is charged when the provider answers. Ringing is free, and you only pay for blocks
          you use up to your limit.
        </div>
      </div>
    </div>
  );
}
