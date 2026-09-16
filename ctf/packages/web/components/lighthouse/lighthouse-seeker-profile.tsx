"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { CountrySelect } from "@/components/shared/location-select";
import { getLighthouseTokens, type Profile } from "./shared";
import { failureText } from 'lib/errors/client-failure';

// Seeker self-service setup. A member fills in their housing needs here so they can request a stay
// on a listing. Saving upserts the shared lighthouse_profiles row via POST /api/lighthouse/profile.
// The "Request to stay" action on a listing points members here when they have not saved details yet.
//
// A member can be both a host and a seeker (owner decision): a member who has listed a place can also
// fill in these details and request stays. Saving keeps their host flag intact and does not relabel
// their account, so this screen always shows the editable form.

type SeekerForm = {
  housingNeeds: string;
  desiredCountry: string;
  desiredCity: string;
  desiredMoveInDateIso: string;
  budgetMin: string;
  budgetMax: string;
  bio: string;
  phoneNumber: string;
  signalUrl: string;
  isActive: boolean;
  isWantedPublic: boolean;
};

type StringFormKey = Exclude<keyof SeekerForm, "isActive" | "isWantedPublic">;
type BooleanFormKey = "isActive" | "isWantedPublic";

const EMPTY_FORM: SeekerForm = {
  housingNeeds: "",
  desiredCountry: "",
  desiredCity: "",
  desiredMoveInDateIso: "",
  budgetMin: "",
  budgetMax: "",
  bio: "",
  phoneNumber: "",
  signalUrl: "",
  isActive: true,
  isWantedPublic: false,
};

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

function dateInputValue(iso: string | null | undefined): string {
  // The move-in field is a <input type="date">, which needs YYYY-MM-DD.
  if (!iso) return "";
  const match = /^\d{4}-\d{2}-\d{2}/.exec(iso);
  return match ? match[0] : "";
}

/** A saved text value as the form wants it: a missing one becomes an empty input, not "undefined". */
function textInputValue(value: string | null | undefined): string {
  return value ?? "";
}

/** A saved number as the form wants it: an unset budget is an empty box, not a "0". */
function numberInputValue(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "";
}

// Maps a saved profile into the editable form, normalizing missing values to empty strings.
function profileToForm(p: Profile): SeekerForm {
  return {
    housingNeeds: textInputValue(p.housingNeeds),
    desiredCountry: textInputValue(p.desiredCountry),
    desiredCity: textInputValue(p.desiredCity),
    desiredMoveInDateIso: dateInputValue(p.desiredMoveInDateIso),
    budgetMin: numberInputValue(p.budgetMin),
    budgetMax: numberInputValue(p.budgetMax),
    bio: textInputValue(p.bio),
    phoneNumber: textInputValue(p.phoneNumber),
    signalUrl: textInputValue(p.signalUrl),
    isActive: p.isActive ?? true,
    isWantedPublic: p.isWantedPublic ?? false,
  };
}

// Builds the POST body for saving a seeker profile, normalizing empty inputs to null.
function buildSeekerProfileBody(form: SeekerForm, budgetMin: number | null, budgetMax: number | null) {
  return {
    profileType: "seeker",
    housingNeeds: form.housingNeeds.trim() || null,
    desiredCountry: form.desiredCountry.trim() || null,
    desiredCity: form.desiredCity.trim() || null,
    desiredMoveInDateIso: form.desiredMoveInDateIso.trim() || null,
    budgetMin,
    budgetMax,
    bio: form.bio.trim() || null,
    phoneNumber: form.phoneNumber.trim() || null,
    signalUrl: form.signalUrl.trim() || null,
    isActive: form.isActive,
    isWantedPublic: form.isWantedPublic,
  };
}

export function LighthouseSeekerProfile() {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<SeekerForm>(EMPTY_FORM);
  const [existingType, setExistingType] = useState<"seeker" | "host" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/lighthouse/profile");
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean; profile?: Profile };
          const p = data.profile;
          if (p) {
            setExistingType(p.profileType === "host" ? "host" : "seeker");
            setForm(profileToForm(p));
          }
        }
        // A 404 (no profile yet) is expected for a first-time seeker; the empty form stands.
      } catch {
        // Best-effort; the empty form still works.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function setField(key: StringFormKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function setFlag(key: BooleanFormKey, value: boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function submit() {
    const budgetMin = toNumberOrNull(form.budgetMin);
    const budgetMax = toNumberOrNull(form.budgetMax);
    if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
      setError("The most you can pay can’t be less than the least you can pay.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/lighthouse/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify(buildSeekerProfileBody(form, budgetMin, budgetMax)),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Could not save your details. Please try again.");
        return;
      }
      setSaved(true);
    } catch (caught) {
      setError(failureText(caught, { area: 'lighthouse', op: 'submit', fallback: "Could not save your details. Please try again.", audience: 'member' }));
    } finally {
      setSubmitting(false);
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: 12, color: t.MUTED, fontWeight: 600, marginBottom: 4, display: "block" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 10px", background: t.INPUT_BG, border: `1px solid ${t.BORDER}`, borderRadius: 8, fontSize: 13, color: t.TEXT, outline: "none", boxSizing: "border-box" };

  function field(key: StringFormKey, label: string, opts?: { type?: string; placeholder?: string; textarea?: boolean }) {
    return (
      <div style={{ flex: "1 1 160px", minWidth: 140 }}>
        <label style={labelStyle}>{label}</label>
        {opts?.textarea ? (
          <textarea value={form[key]} onChange={(e) => setField(key, e.target.value)} placeholder={opts?.placeholder} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        ) : (
          <input type={opts?.type ?? "text"} value={form[key]} onChange={(e) => setField(key, e.target.value)} placeholder={opts?.placeholder} style={inputStyle} />
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "18px 16px 40px", maxWidth: 860, margin: "0 auto", width: "100%", boxSizing: "border-box", color: t.MUTED, fontSize: 14 }}>
        Loading your details…
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 16px 40px", maxWidth: 860, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>Your housing details</div>
        <div style={{ fontSize: 13, color: t.MUTED, marginTop: 4, lineHeight: 1.6 }}>
          Tell hosts what you’re looking for. You need these details saved before you can request a
          stay on a listing. A host sees them only after you request their place.
        </div>
      </div>

      <div style={{ background: t.HEADER, border: `1px solid ${t.BORDER}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: "1 1 100%" }}>{field("housingNeeds", "What you’re looking for", { textarea: true, placeholder: "Number of people, timing, accessibility, pets, anything a host should know…" })}</div>
          <div style={{ flex: "1 1 160px", minWidth: 140 }}>
            <label htmlFor="lighthouse-seeker-country" style={labelStyle}>Country you want to move to</label>
            <CountrySelect id="lighthouse-seeker-country" value={form.desiredCountry} onChange={(v) => setField("desiredCountry", v)} style={inputStyle} />
          </div>
          {field("desiredCity", "City or area you want", { placeholder: "e.g. Vancouver" })}
          {field("desiredMoveInDateIso", "Ideal move-in date", { type: "date" })}
          {field("budgetMin", "Least you can pay / month", { type: "number", placeholder: "0" })}
          {field("budgetMax", "Most you can pay / month", { type: "number", placeholder: "0" })}
          <div style={{ flex: "1 1 100%" }}>{field("bio", "About you (optional)", { textarea: true, placeholder: "A short introduction a host will read." })}</div>
          {field("phoneNumber", "Phone (optional)")}
          {field("signalUrl", "Signal link (optional)", { placeholder: "https://signal.me/#p/…" })}
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, color: t.TEXT, cursor: "pointer" }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setFlag("isActive", e.target.checked)} aria-label="Actively looking for housing" />
          I’m actively looking for housing
        </label>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.BORDER}` }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: t.TEXT, cursor: "pointer" }}>
            <input type="checkbox" checked={form.isWantedPublic} onChange={(e) => setFlag("isWantedPublic", e.target.checked)} aria-label="Show what I'm looking for on the Wanted tab" style={{ marginTop: 3 }} />
            <span>Show what I’m looking for on the <strong>Wanted</strong> tab</span>
          </label>
          <div style={{ fontSize: 12, color: t.MUTED, marginTop: 6, lineHeight: 1.6, paddingLeft: 24 }}>
            Anyone browsing LightHouse then sees what you’re looking for, the place and date, your
            budget range and your short introduction — so someone deciding whether to offer a room can
            see that people are asking. Your name, your phone number and your Signal link are never
            shown, and nobody can message you from it. Untick the box any time to take it down.
          </div>
        </div>

        {error ? <div style={{ color: "#EF4444", fontSize: 13, marginTop: 12 }}>{error}</div> : null}
        {saved ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#22C55E", fontSize: 13, marginTop: 12 }}>
            <CheckCircle2 size={15} /> Saved. You can now request a stay on any listing.
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <button type="button" onClick={() => void submit()} disabled={submitting} style={{ padding: "9px 18px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#0B0B0F", fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Saving…" : existingType === "seeker" ? "Save changes" : "Save your details"}
          </button>
        </div>
      </div>
    </div>
  );
}
