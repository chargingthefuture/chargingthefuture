"use client";

import { CheckCircle } from "lucide-react";
import { COLOR, rideTypeName, type RideType } from "./tt-shared";
import { CurrencySelect } from "@/components/shared/currency-select";
import type { Currency } from "lib/currency/types";

interface BookTabProps {
  rideTypes: RideType[];
  rideType: string;
  onRideType: (id: string) => void;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  priceCurrency: string;
  priceAmount: string;
  requiresAmount: boolean;
  onPriceCurrency: (code: string, currency: Currency | null) => void;
  onPriceAmount: (v: string) => void;
  bookingError: string | null;
  booked: boolean;
  submitting: boolean;
  onBook: () => void;
  onReset: () => void;
}

function BookedCard({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ padding: "20px 24px", borderRadius: 16, background: "#22C55E10", border: "1px solid #22C55E30" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CheckCircle size={20} style={{ color: "#22C55E" }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: "#22C55E" }}>Request submitted!</div>
      </div>
      <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6 }}>Your request is being matched with nearby drivers.</div>
      <button type="button" onClick={onReset} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 13, cursor: "pointer" }}>
        Book Another
      </button>
    </div>
  );
}

export function TrustTransportBookTab(props: BookTabProps) {
  const { rideTypes, rideType, onRideType, from, to, onFrom, onTo, priceCurrency, priceAmount, requiresAmount, onPriceCurrency, onPriceAmount, bookingError, booked, submitting, onBook, onReset } = props;
  const name = rideTypeName(rideTypes, rideType);
  // A priced value type needs a positive amount before the ride can be booked; Free/Barter don't.
  const parsedAmount = Number(priceAmount);
  const hasValidAmount = !requiresAmount || (Number.isFinite(parsedAmount) && parsedAmount > 0);
  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderRadius: 16, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Book a {name}</div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>All drivers background-checked · Trauma-informed · Service Credits accepted</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {rideTypes.map((rt) => {
            const Icon = rt.icon;
            const active = rideType === rt.id;
            return (
              <button key={rt.id} type="button" onClick={() => onRideType(rt.id)} style={{ flex: 1, padding: "16px 12px", borderRadius: 14, background: active ? `${rt.color}15` : "rgba(255,255,255,0.02)", border: `2px solid ${active ? rt.color : "rgba(255,255,255,0.06)"}`, cursor: "pointer", textAlign: "center" }}>
                <Icon size={24} style={{ color: active ? rt.color : "#6B7280", marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: active ? rt.color : "#6B7280" }}>{rt.name}</div>
                <div style={{ fontSize: 11, color: "#4B5563" }}>{rt.desc}</div>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
            <input value={from} onChange={(e) => onFrom(e.target.value)} aria-label="Pickup location" placeholder="Pickup location (privacy-protected)" style={{ width: "100%", padding: "14px 16px 14px 36px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: COLOR }} />
            <input value={to} onChange={(e) => onTo(e.target.value)} aria-label="Destination" placeholder="Where to?" style={{ width: "100%", padding: "14px 16px 14px 36px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>How will you settle this ride?</div>
            <CurrencySelect
              value={priceCurrency}
              onChange={(code, currency: Currency | null) => onPriceCurrency(code, currency)}
              ariaLabel="How will you settle this ride?"
              className=""
            />
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>Asking for a free ride is okay. You can also offer ServiceCredits, money, crypto, or a barter.</div>
          </div>
          {requiresAmount && (
            <input
              value={priceAmount}
              onChange={(e) => onPriceAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              aria-label="Amount"
              placeholder="Amount (e.g. 20)"
              style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }}
            />
          )}
        </div>

        {bookingError && <div style={{ fontSize: 13, color: "#EF4444" }}>{bookingError}</div>}

        {booked ? (
          <BookedCard onReset={onReset} />
        ) : (
          <button type="button" onClick={onBook} disabled={submitting || !hasValidAmount} style={{ padding: "16px", borderRadius: 14, background: (submitting || !hasValidAmount) ? "rgba(249,115,22,0.4)" : COLOR, border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: (submitting || !hasValidAmount) ? "not-allowed" : "pointer" }}>
            {submitting ? "Booking…" : `Book ${name}`}
          </button>
        )}
      </div>
    </div>
  );
}
