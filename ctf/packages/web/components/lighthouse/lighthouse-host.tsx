"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { TrustWidgetCard } from "@/components/trust/TrustWidgetCard";
import type { TrustUserExtension } from "@/lib/trust/types";
import { CurrencySelect } from "@/components/shared/currency-select";
import type { Currency } from "@/lib/currency/types";
import { SERVICE_CREDITS_LABEL } from "@/lib/currency/types";
import { sortPreferred } from "@/lib/currency/format";
import { formatRent, getLighthouseTokens, type CurrencyMap, type Property } from "./shared";

// Member self-service hosting. A member lists their own place here; there is NO separate "host
// profile" form — the host identity shown on a listing is composed from data we already have
// (username, Quora link, and the shared Trust widget). Creating a listing transparently provisions
// the host row server-side (see createProperty).

type PropertyForm = {
  title: string;
  description: string;
  propertyType: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  bedrooms: string;
  bathrooms: string;
  monthlyRent: string;
  rentCurrency: string;
  acceptedCurrencies: string[];
  availableFromIso: string;
  amenities: string;
  houseRules: string;
  airbnbProfileUrl: string;
};

// Keys of PropertyForm whose value is a plain string (everything except the multi-select
// acceptedCurrencies). The shared <input>/<textarea> field helper only ever edits these.
type StringFormKey = Exclude<keyof PropertyForm, "acceptedCurrencies">;

const EMPTY_FORM: PropertyForm = {
  title: "", description: "", propertyType: "", addressLine: "", city: "", state: "", country: "",
  zipCode: "", bedrooms: "", bathrooms: "", monthlyRent: "", rentCurrency: "USD", acceptedCurrencies: [],
  availableFromIso: "", amenities: "", houseRules: "", airbnbProfileUrl: "",
};

function toNumberOrNull(value: string): number | null {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function toListOrNull(value: string): string[] | null {
  const list = value.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : null;
}

// Full listing record as returned by GET /api/lighthouse/properties/[propertyId]
// (mirrors LighthouseProperty in lib/lighthouse/types.ts). Used to prefill the
// edit form from the listing's complete current data — the update endpoint does a
// full replace, so every column must be sent back.
type FullProperty = {
  title?: string | null;
  description?: string | null;
  propertyType?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  monthlyRent?: number | null;
  rentCurrency?: string | null;
  acceptedCurrencies?: string[] | null;
  availableFromIso?: string | null;
  amenities?: string[] | null;
  houseRules?: string[] | null;
  airbnbProfileUrl?: string | null;
};

function numToString(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function listToString(value: string[] | null | undefined): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

function dateInputValue(iso: string | null | undefined): string {
  // The "Available from" field is a <input type="date">, which needs YYYY-MM-DD.
  if (!iso) return "";
  const match = /^\d{4}-\d{2}-\d{2}/.exec(iso);
  return match ? match[0] : "";
}

function fullPropertyToForm(p: FullProperty): PropertyForm {
  return {
    title: p.title ?? "",
    description: p.description ?? "",
    propertyType: p.propertyType ?? "",
    addressLine: p.addressLine ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    country: p.country ?? "",
    zipCode: p.zipCode ?? "",
    bedrooms: numToString(p.bedrooms),
    bathrooms: numToString(p.bathrooms),
    monthlyRent: numToString(p.monthlyRent),
    rentCurrency: p.rentCurrency ?? "USD",
    acceptedCurrencies: Array.isArray(p.acceptedCurrencies) ? p.acceptedCurrencies : [],
    availableFromIso: dateInputValue(p.availableFromIso),
    amenities: listToString(p.amenities),
    houseRules: listToString(p.houseRules),
    airbnbProfileUrl: p.airbnbProfileUrl ?? "",
  };
}

export function LighthouseHost({
  username,
  editPropertyId,
  onEditHandled,
}: {
  username: string | null;
  editPropertyId?: string | null;
  onEditHandled?: () => void;
}) {
  const { theme } = useTheme();
  const t = getLighthouseTokens(theme);

  const [myProperties, setMyProperties] = useState<Property[]>([]);
  const [quoraUrl, setQuoraUrl] = useState<string | null>(null);
  const [trust, setTrust] = useState<TrustUserExtension | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const formRef = useRef<HTMLDivElement | null>(null);

  async function loadMine() {
    try {
      const res = await fetch("/api/lighthouse/my-properties");
      if (res.ok) {
        const data = await res.json() as { items?: Property[]; host?: { quoraProfileUrl?: string | null } };
        setMyProperties(data.items ?? []);
        setQuoraUrl(data.host?.quoraProfileUrl ?? null);
      }
    } catch {
      // Best-effort; the create form still works without the list.
    }
  }

  useEffect(() => {
    void loadMine();
    void (async () => {
      try {
        const res = await fetch("/api/currencies", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json() as { currencies?: Currency[] };
          setCurrencies(Array.isArray(data.currencies) ? data.currencies : []);
        }
      } catch {
        // The accepted-currencies checklist is supplementary; ignore failures.
      }
    })();
    void (async () => {
      try {
        const res = await fetch("/api/trust/user/self");
        if (res.ok) {
          const data = await res.json() as TrustUserExtension & { allowed?: boolean };
          if (typeof data.trustStatus === "string") setTrust(data);
        }
      } catch {
        // Trust widget is supplementary; ignore failures.
      }
    })();
  }, []);

  function setField(key: StringFormKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAcceptedCurrency(code: string) {
    setForm((prev) => ({
      ...prev,
      acceptedCurrencies: prev.acceptedCurrencies.includes(code)
        ? prev.acceptedCurrencies.filter((c) => c !== code)
        : [...prev.acceptedCurrencies, code],
    }));
  }

  async function beginEdit(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/lighthouse/properties/${id}`);
      const data = await res.json().catch(() => ({})) as { ok?: boolean; property?: FullProperty; message?: string };
      if (!res.ok || !data.ok || !data.property) {
        setError(data.message ?? "Could not load the listing to edit. Please try again.");
        return;
      }
      setForm(fullPropertyToForm(data.property));
      setEditingId(id);
      setShowForm(true);
      requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setError("Could not load the listing to edit. Please try again.");
    }
  }

  useEffect(() => {
    if (!editPropertyId) return;
    void beginEdit(editPropertyId);
    onEditHandled?.();
  }, [editPropertyId]);

  async function submit() {
    if (!form.title.trim() || !form.description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const body = JSON.stringify({
      title: form.title.trim(),
      description: form.description.trim(),
      propertyType: form.propertyType.trim() || null,
      addressLine: form.addressLine.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      country: form.country.trim() || null,
      zipCode: form.zipCode.trim() || null,
      bedrooms: toNumberOrNull(form.bedrooms),
      bathrooms: toNumberOrNull(form.bathrooms),
      monthlyRent: toNumberOrNull(form.monthlyRent),
      rentCurrency: form.rentCurrency || null,
      acceptedCurrencies: form.acceptedCurrencies,
      availableFromIso: form.availableFromIso.trim() || null,
      amenities: toListOrNull(form.amenities),
      houseRules: toListOrNull(form.houseRules),
      airbnbProfileUrl: form.airbnbProfileUrl.trim() || null,
    });
    const failureMessage = editingId
      ? "Could not save the changes. Please try again."
      : "Could not create the listing. Please try again.";
    try {
      const res = await fetch(
        editingId ? `/api/lighthouse/properties/${editingId}` : "/api/lighthouse/properties",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
          body,
        },
      );
      const resBody = await res.json().catch(() => ({})) as { ok?: boolean; message?: string };
      if (!res.ok || !resBody.ok) {
        setError(resBody.message ?? failureMessage);
        return;
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      await loadMine();
    } catch {
      setError(failureMessage);
    } finally {
      setSubmitting(false);
    }
  }

  const currencyMap: CurrencyMap = useMemo(() => {
    const map: CurrencyMap = {};
    for (const currency of currencies) map[currency.code] = currency;
    return map;
  }, [currencies]);

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

  return (
    <div style={{ padding: "18px 16px 40px", maxWidth: 860, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* Host identity — composed from existing data, nothing to re-enter. */}
      <div style={{ background: t.HEADER, border: `1px solid ${t.BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: t.MUTED, marginBottom: 6 }}>You are listing as</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>{username ? `@${username}` : "Your account"}</span>
          {quoraUrl ? (
            <a href={quoraUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: t.ACCENT, textDecoration: "none" }}>
              Quora profile <ExternalLink size={12} />
            </a>
          ) : null}
        </div>
        <div style={{ fontSize: 12, color: t.MUTED, marginTop: 6 }}>Seekers see your name, your Quora profile, and your Trust signals — you do not create a separate host profile.</div>
        {trust ? <div style={{ marginTop: 12 }}><TrustWidgetCard trust={trust} /></div> : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.TITLE }}>Your listings ({myProperties.length})</div>
        <button type="button" onClick={() => { setShowForm((v) => !v); setEditingId(null); setForm(EMPTY_FORM); setError(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: `${t.ACCENT}1A`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={16} /> {showForm ? "Close" : "List your place"}
        </button>
      </div>

      {showForm ? (
        <div ref={formRef} style={{ background: t.HEADER, border: `1px solid ${t.BORDER}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 12 }}>{editingId ? "Edit listing" : "List your place"}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {field("title", "Title *", { placeholder: "Quiet 1-bed near transit" })}
            {field("propertyType", "Type", { placeholder: "Apartment, room, house…" })}
            <div style={{ flex: "1 1 100%" }}>{field("description", "Description *", { textarea: true, placeholder: "Describe the place, the neighborhood, who it suits…" })}</div>
            {field("addressLine", "Address")}
            {field("city", "City")}
            {field("state", "State / region")}
            {field("country", "Country")}
            {field("zipCode", "Postal code")}
            {field("bedrooms", "Bedrooms", { type: "number" })}
            {field("bathrooms", "Bathrooms", { type: "number" })}
            {field("monthlyRent", "Monthly rent", { type: "number", placeholder: "0 for Service Credits / free" })}
            <div style={{ flex: "1 1 160px", minWidth: 140 }}>
              <label style={labelStyle}>Rent currency</label>
              <CurrencySelect
                value={form.rentCurrency}
                currencies={currencies.length > 0 ? currencies : undefined}
                onChange={(code) => setField("rentCurrency", code)}
                ariaLabel="Rent currency"
                className="lighthouse-rent-currency-select"
              />
            </div>
            {field("availableFromIso", "Available from", { type: "date" })}
            {field("amenities", "Amenities (comma separated)")}
            {field("houseRules", "House rules (comma separated)")}
            {field("airbnbProfileUrl", "Listing URL (optional)")}
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Accepted currencies</label>
            <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 8 }}>
              Choose every currency this listing accepts. Checking {SERVICE_CREDITS_LABEL} means your
              listing accepts {SERVICE_CREDITS_LABEL} — this is separate from the rent currency above.
            </div>
            {currencies.length === 0 ? (
              <div style={{ fontSize: 12, color: t.MUTED }}>Loading currencies…</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {sortPreferred(currencies).map((currency) => {
                  const checked = form.acceptedCurrencies.includes(currency.code);
                  const optionLabel = currency.isServiceCredits
                    ? SERVICE_CREDITS_LABEL
                    : (currency.symbol ? `${currency.label} (${currency.symbol})` : currency.label);
                  return (
                    <label key={currency.code} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: t.TEXT, cursor: "pointer", background: checked ? `${t.ACCENT}14` : "transparent", border: `1px solid ${checked ? t.ACCENT + "40" : t.BORDER}`, borderRadius: 8, padding: "6px 10px" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAcceptedCurrency(currency.code)}
                        aria-label={`Accept ${optionLabel}`}
                      />
                      {optionLabel}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          {error ? <div style={{ color: "#EF4444", fontSize: 13, marginTop: 10 }}>{error}</div> : null}
          <div style={{ marginTop: 14 }}>
            <button type="button" onClick={() => void submit()} disabled={submitting} style={{ padding: "9px 18px", borderRadius: 10, background: t.ACCENT, border: "none", color: "#0B0B0F", fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1 }}>
              {editingId
                ? (submitting ? "Saving…" : "Save changes")
                : (submitting ? "Publishing…" : "Publish listing")}
            </button>
          </div>
        </div>
      ) : null}

      {myProperties.length === 0 ? (
        <div style={{ color: t.MUTED, fontSize: 14, padding: "24px 0", textAlign: "center" }}>You have no listings yet. Tap “List your place” to add one.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {myProperties.map((p) => (
            <div key={p.id} style={{ background: t.HEADER, border: `1px solid ${t.BORDER}`, borderRadius: 12, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>{p.title}</div>
                <div style={{ fontSize: 13, color: t.MUTED, marginTop: 2 }}>
                  {[p.city, p.state].filter(Boolean).join(", ") || "Location not set"}
                  {(() => {
                    const rent = formatRent(p, currencyMap);
                    if (rent === null) return " · Service Credits / free";
                    return rent === "Free" ? " · Free" : ` · ${rent}/mo`;
                  })()}
                </div>
              </div>
              <button type="button" onClick={() => void beginEdit(p.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, background: `${t.ACCENT}1A`, border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                <Pencil size={14} /> Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
