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

// True only when this provider is reachable for an instant call AND it should be offered to this
// viewer: the provider opted in, set a valid whole-credit rate (>= 1), and the viewer is not the
// provider themselves (you can't ring yourself). The unlock gate is handled upstream — only an
// unlocked member ever sees the Foundation provider list.
export function canOfferConnectNow(provider: ProviderView, viewerUserId: string | null): boolean {
  if (!provider.instantCallEnabled) {
    return false;
  }
  const rate = provider.instantCallRateCredits;
  if (rate === null || !Number.isFinite(rate) || rate < 1) {
    return false;
  }
  if (viewerUserId && provider.providerUserId === viewerUserId) {
    return false;
  }
  return true;
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

function ConnectNowDialog({
  provider, rateLabel, intervalMinutes, onClose,
}: {
  provider: ProviderView;
  rateLabel: string;
  intervalMinutes: number;
  onClose: () => void;
}) {
  const providerName = provider.displayName;
  const [consented, setConsented] = useState(false);
  const [starting, setStarting] = useState(false);
  const instantCall = useInstantCall();

  // Place the ring through the controller, then close the consent dialog so the controller's call overlay
  // (ringing -> in-call) takes over. The controller owns the lifecycle from here.
  const onStart = async () => {
    if (!consented || starting || !instantCall) {
      return;
    }
    setStarting(true);
    try {
      await instantCall.startCall(provider);
      onClose();
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
            You&apos;re charged this rate for each {intervalMinutes}-minute block. You can end the call anytime.
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: "#9CA3AF", lineHeight: 1.7, marginBottom: 14 }}>
          This starts a live 1:1 call. You&apos;ll be charged the provider&apos;s rate per block until you
          end it. Only start a call you mean to pay for.
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: COLOR, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: "#D1D5DB", lineHeight: 1.5 }}>
            I understand this is a paid call and I agree to be charged {rateLabel}.
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
          This places a live audio call. No charge happens in this version — per-block billing arrives in a
          later update.
        </div>
      </div>
    </div>
  );
}
