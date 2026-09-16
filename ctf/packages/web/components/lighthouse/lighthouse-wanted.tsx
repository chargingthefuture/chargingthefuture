"use client";

import { CalendarDays, MapPin, Search } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getLighthouseTokens, type LighthouseTokens, type WantedPosting } from "./shared";

// The demand side of LightHouse. A member deciding whether to offer a room otherwise sees only
// other people's listings, which says nothing about whether anyone needs one — and on this product
// the side with the most people on it is the side asking. Each card is one member's published
// housing need. Nothing here identifies who wrote it and nothing here opens a conversation: a stay
// request still runs seeker → host, from a listing.

/** "City, Country" with blank parts dropped; empty string when neither is set. */
function placeLabel(posting: WantedPosting): string {
  return [posting.desiredCity, posting.desiredCountry]
    .filter((part) => part && String(part).trim().length > 0)
    .join(", ");
}

/** A move-in date as a short readable day, or empty when none was given. */
function moveInLabel(posting: WantedPosting): string {
  if (!posting.desiredMoveInDateIso) return "";
  const parsed = new Date(posting.desiredMoveInDateIso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The budget range as plain numbers. No currency symbol: the seeker form asks for an amount and
 * never asks which currency it is in, so printing a "$" here would state something the member never
 * said. Empty string when neither end of the range was filled in.
 */
function budgetLabel(posting: WantedPosting): string {
  const min = typeof posting.budgetMin === "number" ? posting.budgetMin : null;
  const max = typeof posting.budgetMax === "number" ? posting.budgetMax : null;
  const format = (value: number) => value.toLocaleString("en-US");
  if (min !== null && max !== null) return min === max ? format(min) : `${format(min)}–${format(max)}`;
  if (min !== null) return `${format(min)} or more`;
  if (max !== null) return `up to ${format(max)}`;
  return "";
}

function MetaRow({ posting, t }: { posting: WantedPosting; t: LighthouseTokens }) {
  const place = placeLabel(posting);
  const moveIn = moveInLabel(posting);
  if (!place && !moveIn) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: t.MUTED, marginBottom: 10 }}>
      {place ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {place}</span>
      ) : null}
      {moveIn ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CalendarDays size={11} /> From {moveIn}</span>
      ) : null}
    </div>
  );
}

function WantedCard({ posting, t }: { posting: WantedPosting; t: LighthouseTokens }) {
  const needs = posting.housingNeeds?.trim() ?? "";
  const intro = posting.bio?.trim() ?? "";
  const budget = budgetLabel(posting);
  return (
    <div style={{ borderRadius: 16, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}20`, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.TITLE, marginBottom: 8, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {needs || "Looking for a place to stay"}
      </div>
      <MetaRow posting={posting} t={t} />
      {intro ? (
        <div style={{ fontSize: 12, color: t.SUBTLE, lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{intro}</div>
      ) : null}
      {budget ? (
        <div style={{ fontSize: 12, color: t.ACCENT, fontWeight: 600 }}>
          Can pay {budget} <span style={{ color: t.MUTED, fontWeight: 400 }}>a month</span>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ t }: { t: LighthouseTokens }) {
  return (
    <div style={{ textAlign: "center", color: t.SUBTLE, fontSize: 14, padding: 40, lineHeight: 1.6 }}>
      <Search size={28} strokeWidth={1.5} style={{ color: t.FAINT, marginBottom: 10 }} />
      <div>Nobody has published what they are looking for yet.</div>
      <div style={{ color: t.MUTED, fontSize: 13, marginTop: 6 }}>
        If you are looking for a place, fill in <strong>You</strong> and tick the box to show it here.
      </div>
    </div>
  );
}

export function LighthouseWanted({
  postings,
  totalCount,
  error,
  onListYourPlace,
}: {
  postings: WantedPosting[];
  totalCount: number;
  error: string | null;
  /** Jumps to the host tab. Seeing the demand is the point; offering a place is the next step. */
  onListYourPlace: () => void;
}) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20, padding: "18px 24px", borderRadius: 16, background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(234,179,8,0.05) 100%)`, border: `1px solid ${t.ACCENT}25` }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>People looking for a place</div>
        <div style={{ fontSize: 14, color: t.SUBTLE, lineHeight: 1.5 }}>
          {totalCount === 1 ? "1 member is looking" : `${totalCount} members are looking`} · each one wrote this themselves
        </div>
        <button
          type="button"
          onClick={onListYourPlace}
          style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          List your place
        </button>
      </div>
      {error ? (
        <div style={{ color: "#EF4444", fontSize: 13, marginBottom: 14 }}>{error}</div>
      ) : null}
      {postings.length === 0 && !error ? (
        <EmptyState t={t} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {postings.map((posting) => (
            <WantedCard key={posting.id} posting={posting} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
