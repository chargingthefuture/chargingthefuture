"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { MAX_TAG_LENGTH, MAX_TAGS_PER_POST, SUBTLE } from "./sr-shared";
import { CurrencySelect } from "@/components/shared/currency-select";
import { CountrySelect, StateField } from "@/components/shared/location-select";
import { FormField } from "@/components/shared/form-field";
import type { Currency } from "lib/currency/types";
import { useTheme } from '@/hooks/useTheme';
import { getSocketRelayTokens, type SocketRelayTokens } from './sr-shared';

export type PostDraft = {
  title: string;
  details: string;
  tags: string[];
  // Location for this request. Defaults from the member's directory profile when creating a new
  // request, but is fully editable per request (and can be cleared). City stays coarse for privacy.
  city: string;
  state: string;
  country: string;
  isPublic: boolean;
  // How the request is settled (issue #420): the chosen value type code (default 'FREE' for mutual
  // aid). priceAmount is the entered amount as a string, used only for priced types; it is cleared for
  // amount-less types (Free, Barter) and parsed to a number on submit.
  priceCurrency: string;
  priceAmount: string;
  // Whether the chosen value type needs an amount. Kept on the draft (not local state) so it resets
  // together with the rest of the form — otherwise it would drift after a reset.
  requiresAmount: boolean;
};

type FieldA11y = { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

function TagEditor({
  tags,
  onChange,
  suggest,
  a11y,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggest: (prefix: string, exclude: string[]) => string[];
  a11y: FieldA11y;
}) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  const [input, setInput] = useState("");
  // Set when the last add trimmed an over-long tag, so the member is told their input was shortened
  // instead of it changing silently.
  const [notice, setNotice] = useState<string | null>(null);
  const full = tags.length >= MAX_TAGS_PER_POST;

  const addTag = (raw: string) => {
    // Truncate to the server's max so a long tag can't be added and then bounce off the API as an
    // invalid payload — the form stays the source of truth for what is submittable.
    const normalized = raw.trim().replace(/\s+/g, " ");
    const tag = normalized.slice(0, MAX_TAG_LENGTH);
    if (!tag || full) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    setNotice(normalized.length > MAX_TAG_LENGTH ? `Tag trimmed to ${MAX_TAG_LENGTH} characters.` : null);
    onChange([...tags, tag]);
    setInput("");
  };

  const suggestions = full ? [] : suggest(input, tags);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: tags.length > 0 ? 8 : 0 }}>
        {tags.map((tag) => (
          <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 14, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600 }}>
            {tag}
            <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => onChange(tags.filter((t) => t !== tag))} style={{ display: "inline-flex", background: "transparent", border: "none", padding: 0, color: t.ACCENT, cursor: "pointer" }}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        {...a11y}
        value={input}
        onChange={(e) => { setInput(e.target.value); if (notice) setNotice(null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(input);
          }
        }}
        onBlur={() => addTag(input)}
        placeholder={full ? `Up to ${MAX_TAGS_PER_POST} tags per post` : "Type a tag and press Enter — Food, Mail, Legal, anything"}
        disabled={full}
        style={{ width: "100%", padding: "10px 16px", background: t.INPUT_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: t.TEXT, outline: "none", boxSizing: "border-box" }}
      />
      {notice && (
        <div role="status" style={{ fontSize: 12, color: SUBTLE, marginTop: 6 }}>{notice}</div>
      )}
      {suggestions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: SUBTLE, alignSelf: "center" }}>In use:</span>
          {suggestions.map((tag) => (
            <button key={tag} type="button" onClick={() => addTag(tag)} style={{ padding: "4px 10px", borderRadius: 12, background: t.INPUT_BG, border: "1px solid rgba(255,255,255,0.1)", color: t.SUBTLE, fontSize: 12, cursor: "pointer" }}>
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The primary submit button. Split from SocketRelayPost so its submitting/editing label ternaries live
// in their own scope instead of inflating the form's complexity.
function SubmitButton({
  submitting,
  editing,
  t,
  onSubmit,
}: {
  submitting: boolean;
  editing: boolean;
  t: SocketRelayTokens;
  onSubmit: () => void;
}) {
  return (
    <button onClick={onSubmit} disabled={submitting} style={{ padding: "14px", borderRadius: 12, background: submitting ? `${t.ACCENT}66` : t.ACCENT, border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}>
      {submitting ? (editing ? "Saving…" : "Posting…") : editing ? "Save Changes" : "Post Request"}
    </button>
  );
}

export function SocketRelayPost({
  draft,
  editing,
  onChange,
  submitting,
  error,
  success,
  onSubmit,
  onCancelEdit,
  suggest,
}: {
  draft: PostDraft;
  editing: boolean;
  onChange: (patch: Partial<PostDraft>) => void;
  submitting: boolean;
  error: string | null;
  success: boolean;
  onSubmit: () => void;
  onCancelEdit: () => void;
  suggest: (prefix: string, exclude: string[]) => string[];
}) {
  const { theme } = useTheme();
  const t = getSocketRelayTokens(theme);
  const fieldStyle = { width: "100%", padding: "10px 16px", background: t.INPUT_BG, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: t.TEXT, outline: "none", boxSizing: "border-box" as const };
  // Default false: requests start as "Free" (mutual aid), which has no amount. Picking a priced type
  // (ServiceCredits, fiat, crypto) reveals the amount. Stored on the draft so it resets with the form.
  function onCurrencyChange(code: string, currency: Currency | null) {
    const needsAmount = currency?.requiresAmount ?? false;
    onChange(needsAmount ? { priceCurrency: code, requiresAmount: true } : { priceCurrency: code, priceAmount: "", requiresAmount: false });
  }
  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", minHeight: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.TITLE, marginBottom: 20 }}>{editing ? "Edit Your Request" : "Post a Request"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 620 }}>
        <FormField label="Title">
          {(a) => <input {...a} value={draft.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="A short summary of what you need or can offer" style={fieldStyle} />}
        </FormField>
        <FormField label="Details">
          {(a) => <textarea {...a} value={draft.details} onChange={(e) => onChange({ details: e.target.value })} placeholder="Be specific about what help you need or can give…" rows={3} style={{ ...fieldStyle, resize: "none" }} />}
        </FormField>
        <FormField label={`Tags (up to ${MAX_TAGS_PER_POST})`}>
          {(a) => <TagEditor tags={draft.tags} onChange={(tags) => onChange({ tags })} suggest={suggest} a11y={a} />}
        </FormField>
        {/* Location — defaults from the member's directory profile when posting a new request, fully
            editable/clearable here since a request can be for a different place. Country dropdown;
            State is a US-state dropdown for the United States and a free-text region otherwise. */}
        <FormField label="Country" optional>
          {(a) => <CountrySelect id={a.id} value={draft.country} onChange={(country) => onChange({ country })} style={fieldStyle} />}
        </FormField>
        <FormField label="State / Region" optional>
          {(a) => <StateField id={a.id} country={draft.country} value={draft.state} onChange={(state) => onChange({ state })} style={fieldStyle} />}
        </FormField>
        <FormField label="City" optional hint="City or neighborhood only — never an exact address. Privacy-protected.">
          {(a) => <input {...a} value={draft.city} onChange={(e) => onChange({ city: e.target.value })} placeholder="City or neighborhood" style={fieldStyle} />}
        </FormField>
        <FormField label="How will this be settled?" hint="Most help here is free. You can also offer ServiceCredits, money, crypto, or a barter — pick what fits.">
          {(a) => <CurrencySelect value={draft.priceCurrency} onChange={onCurrencyChange} ariaLabel="How will this be settled?" className="" id={a.id} describedBy={a["aria-describedby"]} />}
        </FormField>
        {draft.requiresAmount && (
          <FormField label="Amount">
            {(a) => (
              <input
                {...a}
                value={draft.priceAmount}
                onChange={(e) => onChange({ priceAmount: e.target.value.replace(/[^0-9.]/g, "") })}
                inputMode="decimal"
                placeholder="e.g. 20"
                style={fieldStyle}
              />
            )}
          </FormField>
        )}
        {error && <div role="alert" style={{ fontSize: 13, color: "#EF4444" }}>{error}</div>}
        {success && <div role="status" style={{ fontSize: 13, color: "#22C55E" }}>{editing ? "Saved! View it in the feed." : "Posted successfully! View it in the feed."}</div>}
        <SubmitButton submitting={submitting} editing={editing} t={t} onSubmit={onSubmit} />
        {editing && (
          <button onClick={onCancelEdit} disabled={submitting} style={{ padding: "12px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: t.SUBTLE, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Cancel Edit
          </button>
        )}
        <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6 }}>Good to know: SocketRelay connects members directly, peer-to-peer. Before transacting with anyone, take the usual precautions — meet in public, and don't send money or share personal details until you're comfortable. Connections happen after someone offers to help.</div>
      </div>
    </div>
  );
}
