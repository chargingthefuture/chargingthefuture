"use client";

import { useEffect, useState } from "react";
import type { SkillsHuntFeatureRewardCard } from "lib/skills-hunt/types";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntAdminTokens, type SkillsHuntAdminTokens } from "./sha-shared";

const fieldStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({
  width: "100%", padding: "9px 12px", borderRadius: 8, background: t.INPUT_BG,
  border: "1px solid rgba(255,255,255,0.12)", color: t.TEXT, fontSize: 13, outline: "none", boxSizing: "border-box",
});
const labelStyle = (t: SkillsHuntAdminTokens): React.CSSProperties => ({ display: "block", fontSize: 12, fontWeight: 600, color: t.SUBTLE, marginBottom: 5 });

// Load the current card. A 404 means "not configured yet" → null (start empty);
// any other non-OK response throws so the caller can surface the message.
async function fetchRewardCard(): Promise<SkillsHuntFeatureRewardCard | null> {
  const res = await fetch("/api/skills-hunt/feature-reward-card");
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Unable to load reward card.");
  }
  const data = (await res.json()) as { card: SkillsHuntFeatureRewardCard | null };
  return data.card ?? null;
}

export function SkillsHuntAdminRewardCard() {
  const { theme } = useTheme();
  const t = getSkillsHuntAdminTokens(theme);
  const field = fieldStyle(t);
  const label = labelStyle(t);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const card = await fetchRewardCard();
        if (!canceled && card) {
          setTitle(card.title);
          setDescription(card.description);
          setCtaLabel(card.ctaLabel);
          setCtaUrl(card.ctaUrl);
          setIsActive(card.isActive);
        }
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : "Unable to load reward card.");
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, []);

  async function save() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/skills-hunt/admin/feature-reward-card", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ title, description, ctaLabel, ctaUrl, isActive }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Unable to save reward card.");
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save reward card.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ color: t.MUTED, fontSize: 13 }}>Loading reward card…</div>;
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontSize: 12, color: t.MUTED, marginBottom: 14 }}>
        This is the SkillsHunt reward card pinned on the Directory page. Edits here change what every member sees there.
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={label} htmlFor="shrc-title">Title</label>
          <input id="shrc-title" style={field} value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} />
        </div>
        <div>
          <label style={label} htmlFor="shrc-desc">Description</label>
          <textarea id="shrc-desc" style={{ ...field, minHeight: 72, resize: "vertical" }} value={description} onChange={(e) => { setDescription(e.target.value); setSaved(false); }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div>
            <label style={label} htmlFor="shrc-cta-label">Button label</label>
            <input id="shrc-cta-label" style={field} value={ctaLabel} onChange={(e) => { setCtaLabel(e.target.value); setSaved(false); }} />
          </div>
          <div>
            <label style={label} htmlFor="shrc-cta-url">Button link</label>
            <input id="shrc-cta-url" style={field} value={ctaUrl} onChange={(e) => { setCtaUrl(e.target.value); setSaved(false); }} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: t.TEXT, cursor: "pointer" }}>
          <input type="checkbox" checked={isActive} onChange={(e) => { setIsActive(e.target.checked); setSaved(false); }} />
          Show this card on the Directory page
        </label>
        {error && <div style={{ color: "#EF4444", fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={() => void save()} disabled={saving}
            style={{ padding: "9px 18px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save card"}
          </button>
          {saved && <span style={{ fontSize: 13, color: "#22C55E", fontWeight: 600 }}>Saved</span>}
        </div>
      </div>
    </div>
  );
}
