"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";
import { useExternalLink } from "@/components/hooks/useExternalLink";
import { getDirectoryTokens, initials, type Member } from "./shared";

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
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);
  // Outbound links go through the shared confirmation (you are about to leave for an external site,
  // with a copy-URL option) — required for accessibility and trauma-informed practice, so nobody is
  // sent off-app to Quora without a clear, dismissible heads-up.
  const { openExternal, ExternalLinkDialog } = useExternalLink();
  const [attachInput, setAttachInput] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachSuccess, setAttachSuccess] = useState(false);
  const showAttach = isAdmin && p.claimedByUserId == null && typeof onAttach === "function";
  const profileUrl = p.profileUrl?.trim() ? p.profileUrl.trim() : null;
  const headline = p.headline?.trim() ? p.headline.trim() : null;
  const bio = p.bio?.trim() ? p.bio.trim() : null;
  // A profile nominated through Skills Hunt is community-generated; show that and who
  // nominated it instead of a generic headline.
  const isCommunityGenerated = p.source === "community-generated";
  const pendingSkills = p.pendingSkills ?? [];

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

  const sectionLabel = { fontSize: 12, fontWeight: 700, color: t.MUTED, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 12 };

  return (
    <div style={{ width: "100%", height: "100dvh", overflow: "hidden", background: t.BG, fontFamily: "'Inter', system-ui, sans-serif", color: t.TEXT, display: "flex", flexDirection: "column" }}>
      {/* Header — matches the shell: a styled back button, not bare text. */}
      <header style={{ height: 56, borderBottom: `1px solid ${t.BORDER}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, background: t.HEADER, flexShrink: 0 }}>
        <button onClick={onBack} aria-label="Back to directory" title="Back to directory" style={{ width: 38, height: 38, borderRadius: 10, background: `${t.ACCENT}14`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", color: t.ACCENT, cursor: "pointer", flexShrink: 0 }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE }}>Provider profile</div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 64px" }}>
          {/* Identity */}
          <div style={{ display: "flex", gap: 18, marginBottom: 24, alignItems: "center" }}>
            <Avatar style={{ width: 72, height: 72, flexShrink: 0 }}>
              <AvatarFallback style={{ background: `${t.ACCENT}30`, color: t.ACCENT, fontSize: 26, fontWeight: 800 }}>{initials(p.name)}</AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: t.TITLE, marginBottom: headline || isCommunityGenerated ? 4 : 8 }}>{p.name}</div>
              {isCommunityGenerated ? (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT }}>Community-generated profile</div>
                  {p.invitedByUsername && (
                    <div style={{ fontSize: 13, color: t.SUBTLE, marginTop: 2, lineHeight: 1.4 }}>Nominated by @{p.invitedByUsername}</div>
                  )}
                </div>
              ) : (
                headline && <div style={{ fontSize: 15, color: t.SUBTLE, marginBottom: 8, lineHeight: 1.4 }}>{headline}</div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {p.sector && <Badge style={{ background: `${t.ACCENT}15`, color: t.ACCENT, border: `1px solid ${t.ACCENT}30`, fontSize: 12 }}>{p.sector}</Badge>}
                {p.jobTitle && <Badge style={{ background: "transparent", color: t.MUTED, border: `1px solid ${t.BORDER}`, fontSize: 12 }}>{p.jobTitle}</Badge>}
              </div>
            </div>
          </div>

          {/* Quora profile — every directory profile is sourced from Quora, so this is the social
              proof and the way to learn more before bartering, trading, or exchanging credits. */}
          <button
            type="button"
            onClick={() => { if (profileUrl) openExternal(profileUrl); }}
            disabled={!profileUrl}
            aria-label={profileUrl ? "View Quora profile — opens a confirmation before leaving for the external site" : "Quora profile not linked yet"}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12,
              background: profileUrl ? `${t.ACCENT}12` : "rgba(255,255,255,0.02)",
              border: `1px solid ${profileUrl ? `${t.ACCENT}35` : t.BORDER}`,
              color: t.TEXT, marginBottom: 24, width: "100%", textAlign: "left",
              cursor: profileUrl ? "pointer" : "default", opacity: profileUrl ? 1 : 0.6,
            }}
          >
            <ExternalLink size={18} style={{ color: t.ACCENT, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: profileUrl ? t.ACCENT : t.MUTED }}>
                {profileUrl ? "View Quora profile" : "Quora profile not linked yet"}
              </div>
              <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5 }}>
                {profileUrl ? "Their Quora profile is the social proof — read more before you reach out." : "This profile has no Quora link on file."}
              </div>
            </div>
          </button>
          <ExternalLinkDialog />

          {/* About */}
          {bio && (
            <section style={{ marginBottom: 24 }}>
              <div style={sectionLabel}>About</div>
              <p style={{ fontSize: 14, color: t.SUBTLE, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{bio}</p>
            </section>
          )}

          {/* Specializations. Real taxonomy skills render as accent chips. A profile
              nominated through Skills Hunt may also have free-text skills that are not yet
              in the taxonomy (still a proposal in skills_hunt_proposed_skill_promotions);
              those render as muted "pending review" chips so the section is never empty
              just because a nominated skill has not been promoted yet. */}
          <section style={{ marginBottom: 24 }}>
            <div style={sectionLabel}>Specializations</div>
            {p.skills.length > 0 || pendingSkills.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {p.skills.map((s) => (
                  <Badge key={s} style={{ background: `${t.ACCENT}15`, color: t.ACCENT, border: `1px solid ${t.ACCENT}30`, fontSize: 13, padding: "5px 12px" }}>{s}</Badge>
                ))}
                {pendingSkills.map((s) => (
                  <Badge
                    key={`pending-${s}`}
                    title="Nominated through Skills Hunt; not yet in the skills taxonomy."
                    style={{ background: "rgba(255,255,255,0.04)", color: t.MUTED, border: `1px dashed ${t.BORDER}`, fontSize: 13, padding: "5px 12px", fontWeight: 500 }}
                  >
                    {s} <span style={{ color: t.FAINT, fontWeight: 400 }}>· pending review</span>
                  </Badge>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: t.FAINT }}>No skills listed yet.</div>
            )}
          </section>

          {/* How to connect — directory is read-only, so reaching out happens through the Quora
              profile and the rest of the app. This tells the viewer what they can do next. */}
          <section style={{ padding: "16px 18px", borderRadius: 12, background: `${t.ACCENT}0A`, border: `1px solid ${t.ACCENT}25` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Sparkles size={14} style={{ color: t.ACCENT }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT }}>Want to work together?</div>
            </div>
            <div style={{ fontSize: 13, color: t.SUBTLE, lineHeight: 1.6 }}>
              The directory shows who is in the community and what they do. Want a service or good from
              this person? Look for them in{" "}
              <Link href="/apps/foundation" style={{ color: t.ACCENT, fontWeight: 600, textDecoration: "none" }}>Foundation</Link>,
              where members offer and exchange help — or browse{" "}
              <Link href="/apps/foundation" style={{ color: t.ACCENT, fontWeight: 600, textDecoration: "none" }}>Foundation</Link>{" "}
              to find someone else who can.
            </div>
          </section>

          {showAttach && (
            <div style={{ marginTop: 24, padding: "20px", borderRadius: 16, background: `${t.ACCENT}0A`, border: `1px solid ${t.ACCENT}30` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ACCENT, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Attach to account</div>
              <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.6, marginBottom: 12 }}>This profile is unclaimed. Attach it to a user account by their Clerk user ID.</div>
              <input
                value={attachInput}
                onChange={(e) => { setAttachInput(e.target.value); setAttachError(null); }}
                placeholder="Clerk user ID"
                disabled={attaching}
                style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${t.ACCENT}30`, borderRadius: 8, fontSize: 13, color: t.TEXT, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleAttach}
                  disabled={attaching || attachInput.trim().length === 0}
                  style={{ padding: "9px 18px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: attaching || attachInput.trim().length === 0 ? "not-allowed" : "pointer", opacity: attaching || attachInput.trim().length === 0 ? 0.5 : 1 }}
                >
                  {attaching ? "Attaching…" : "Attach"}
                </button>
                {currentUserId && (
                  <button
                    type="button"
                    onClick={() => { setAttachInput(currentUserId); setAttachError(null); }}
                    disabled={attaching}
                    style={{ padding: "9px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${t.ACCENT}35`, color: t.ACCENT, fontWeight: 600, fontSize: 12, cursor: attaching ? "not-allowed" : "pointer" }}
                  >
                    Use my account
                  </button>
                )}
              </div>
              {attachSuccess && <div style={{ marginTop: 10, fontSize: 12, color: t.ACCENT }}>Attached.</div>}
              {attachError && <div style={{ marginTop: 10, fontSize: 12, color: "#EF4444" }}>{attachError}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
