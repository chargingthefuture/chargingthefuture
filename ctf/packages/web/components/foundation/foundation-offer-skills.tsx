"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ShieldCheck } from "lucide-react";
import { COLOR } from "./foundation-ui";

type OfferableSkill = { id: string; name: string; offered: boolean };

// Where a member opts in to be contacted to offer specific skills. The list is their own Directory
// skills; toggling one saves the new offered set immediately. This is the willingness signal that
// puts them in Foundation's provider search — Directory says "I have this skill", Foundation says
// "and I'll answer if you reach out about it".
export function OfferSkillsPanel() {
  const [skills, setSkills] = useState<OfferableSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/foundation/provider/skills", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load your skills.");
      const data = (await res.json()) as { skills?: OfferableSkill[] };
      setSkills(data.skills ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your skills.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async (skill: OfferableSkill) => {
    if (savingId) return;
    setSavingId(skill.id);
    setError(null);
    const next = skills.map((s) => (s.id === skill.id ? { ...s, offered: !s.offered } : s));
    const offeredIds = next.filter((s) => s.offered).map((s) => s.id);
    // Optimistic; revert on failure.
    setSkills(next);
    try {
      const res = await fetch("/api/foundation/provider/skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ skillIds: offeredIds }),
      });
      if (!res.ok) throw new Error("Could not save. Please try again.");
    } catch (caught) {
      setSkills(skills);
      setError(caught instanceof Error ? caught.message : "Could not save. Please try again.");
    } finally {
      setSavingId(null);
    }
  }, [savingId, skills]);

  const offeredCount = skills.filter((s) => s.offered).length;

  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(239,68,68,0.05) 100%)`, border: `1px solid ${COLOR}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <ShieldCheck size={18} color={COLOR} />
            <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB" }}>Offer your skills</div>
          </div>
          <div style={{ fontSize: 14, color: "#9CA3AF" }}>
            Turn on the skills you&apos;re willing to be contacted about. Only these put you in Foundation&apos;s provider search — survivors only reach out to people who said yes.
          </div>
        </div>

        {error ? (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fecaca", fontSize: 13 }}>{error}</div>
        ) : null}

        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#6B7280", fontSize: 14 }}>Loading your skills…</div>
        ) : skills.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No skills on your Directory profile yet</div>
            <div style={{ fontSize: 13, color: "#4B5563" }}>Add skills to your Directory profile first — then you can offer them here.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>{offeredCount} of {skills.length} offered</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {skills.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={savingId === s.id}
                  onClick={() => void toggle(s)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 16px", borderRadius: 12, cursor: savingId === s.id ? "default" : "pointer", background: s.offered ? `${COLOR}12` : "rgba(255,255,255,0.02)", border: `1px solid ${s.offered ? COLOR + "40" : "rgba(255,255,255,0.08)"}`, opacity: savingId === s.id ? 0.6 : 1 }}
                >
                  <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: s.offered ? COLOR : "transparent", border: `1px solid ${s.offered ? COLOR : "rgba(255,255,255,0.2)"}` }}>
                    {s.offered ? <Check size={14} color="#1a1205" /> : null}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#F9FAFB" }}>{s.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: s.offered ? COLOR : "#6B7280" }}>{s.offered ? "Offering" : "Off"}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
