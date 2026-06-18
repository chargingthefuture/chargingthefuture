"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BG, COLOR, initials, type Member } from "./shared";

export function DirectoryProfileDetail({
  member,
  onBack,
  isAdmin = false,
  currentUserId,
  onAttach,
}: {
  member: Member;
  onBack: () => void;
  isAdmin?: boolean;
  currentUserId?: string;
  onAttach?: (profileId: string, targetUserId: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const p = member;
  const [attachInput, setAttachInput] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachSuccess, setAttachSuccess] = useState(false);
  const showAttach = isAdmin && p.claimedByUserId == null && typeof onAttach === "function";

  async function handleAttach() {
    const target = attachInput.trim();
    if (!target || !onAttach) return;
    setAttaching(true);
    setAttachError(null);
    setAttachSuccess(false);
    const result = await onAttach(p.id, target);
    if (result.ok) {
      setAttachSuccess(true);
    } else {
      setAttachError(result.error ?? "Could not attach this profile. Please try again.");
    }
    setAttaching(false);
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: "#E8EAF0", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 56, borderBottom: `1px solid ${COLOR}25`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
        <button onClick={onBack} style={{ color: COLOR, background: "none", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
          ← Back
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#F9FAFB" }}>📇 Provider Profile</div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
            <Avatar style={{ width: 80, height: 80 }}>
              <AvatarFallback style={{ background: `${COLOR}30`, color: COLOR, fontSize: 28, fontWeight: 800 }}>{initials(p.name)}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 15, color: "#9CA3AF", marginBottom: 8 }}>{p.jobTitle}</div>
              <Badge style={{ background: `${COLOR}15`, color: COLOR, border: `1px solid ${COLOR}30`, fontSize: 12 }}>{p.sector}</Badge>
            </div>
          </div>
          <div style={{ maxWidth: 640 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Specializations</div>
            {p.skills.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
                {p.skills.map((s) => (
                  <Badge key={s} style={{ background: `${COLOR}15`, color: COLOR, border: `1px solid ${COLOR}30`, fontSize: 13, padding: "5px 12px" }}>{s}</Badge>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#4B5563", marginBottom: 24 }}>No skills listed yet.</div>
            )}
            {showAttach && (
              <div style={{ marginTop: 16, padding: "20px", borderRadius: 16, background: `${COLOR}0A`, border: `1px solid ${COLOR}30` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLOR, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Attach to account</div>
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6, marginBottom: 12 }}>This profile is unclaimed. Attach it to a user account by their Clerk user ID.</div>
                <input
                  value={attachInput}
                  onChange={(e) => { setAttachInput(e.target.value); setAttachError(null); }}
                  placeholder="Clerk user ID"
                  disabled={attaching}
                  style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${COLOR}30`, borderRadius: 8, fontSize: 13, color: "#E8EAF0", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handleAttach}
                    disabled={attaching || attachInput.trim().length === 0}
                    style={{ padding: "9px 18px", borderRadius: 8, background: COLOR, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: attaching || attachInput.trim().length === 0 ? "not-allowed" : "pointer", opacity: attaching || attachInput.trim().length === 0 ? 0.5 : 1 }}
                  >
                    {attaching ? "Attaching…" : "Attach"}
                  </button>
                  {currentUserId && (
                    <button
                      type="button"
                      onClick={() => { setAttachInput(currentUserId); setAttachError(null); }}
                      disabled={attaching}
                      style={{ padding: "9px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${COLOR}35`, color: COLOR, fontWeight: 600, fontSize: 12, cursor: attaching ? "not-allowed" : "pointer" }}
                    >
                      Use my account
                    </button>
                  )}
                </div>
                {attachSuccess && (
                  <div style={{ marginTop: 10, fontSize: 12, color: COLOR }}>Attached.</div>
                )}
                {attachError && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#EF4444" }}>{attachError}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
