"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Hammer, FileText, Wrench, MessageSquare } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import {
  getFoundationTokens, initials, quoteStatus, formatQuoteDate,
  type ProviderView, type QuoteView,
} from "./foundation-ui";
import { ConnectNowButton, InstantCallAvailabilityBadge, canOfferConnectNow, acceptsInstantCalls } from "./foundation-connect-now";

const EMPTY_STEPS = [
  "Request an electrician, plumber, or other trade",
  "Get quotes from community providers",
  "Accept a quote and pay with ServiceCredits",
];

// How many skills a provider's browse card shows before collapsing the rest behind
// a "+N more" chip (the full list is on the profile). Keeps a many-skill provider
// from dominating the list on mobile.
const SKILL_PREVIEW_CAP = 6;

export function BrowsePanel({
  providers, viewerUserId = null, onSelect, activeSkillId = null, activeSkillName = null, onSkillFilter,
}: {
  providers: ProviderView[];
  viewerUserId?: string | null;
  onSelect: (p: ProviderView) => void;
  activeSkillId?: string | null;
  activeSkillName?: string | null;
  onSkillFilter?: (skillId: string | null, skillName?: string | null) => void;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  // Prefer the name passed from the shell (the chip the member tapped) so the banner label survives
  // even when the filter returns zero providers; fall back to whichever card still shows it.
  const bannerSkillName = activeSkillName
    ?? (activeSkillId
      ? providers.flatMap((p) => p.offeredSkills).find((s) => s.id === activeSkillId)?.name ?? null
      : null);

  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${t.ACCENT}15 0%,rgba(239,68,68,0.05) 100%)`, border: `1px solid ${t.ACCENT}20` }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>Find providers offering a skill</div>
          <div style={{ fontSize: 14, color: t.SUBTLE }}>Everyone here has opted in to be contacted — tap a skill to filter.</div>
        </div>
        {activeSkillId ? (
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: `${t.ACCENT}12`, border: `1px solid ${t.ACCENT}30` }}>
            <span style={{ fontSize: 13, color: t.TITLE }}>Offering: <strong style={{ color: t.ACCENT }}>{bannerSkillName ?? "selected skill"}</strong></span>
            <button onClick={() => onSkillFilter?.(null)} style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 7, background: "transparent", border: `1px solid ${t.ACCENT}40`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear</button>
          </div>
        ) : null}
        {providers.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Hammer size={20} style={{ color: "rgba(239,68,68,0.4)" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.SUBTLE }}>No providers offering this yet</div>
            <div style={{ fontSize: 13, color: t.FAINT }}>Try clearing the skill filter or searching differently.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {providers.map((p) => {
              // Cap the skills shown on the card so a provider with many skills doesn't
              // dominate the list — the full set lives on the profile. Keep the actively
              // filtered skill first (it's why this provider matched), and always show a
              // "+N more" affordance when some are hidden, so a member who searched for a
              // skill they don't see here knows there are more behind View Profile.
              const orderedSkills = activeSkillId
                ? [...p.offeredSkills].sort((a, b) =>
                    a.id === activeSkillId ? -1 : b.id === activeSkillId ? 1 : 0,
                  )
                : p.offeredSkills;
              const visibleSkills = orderedSkills.slice(0, SKILL_PREVIEW_CAP);
              const hiddenSkillCount = orderedSkills.length - visibleSkills.length;
              return (
                <div key={p.profileId} role="button" tabIndex={0} onClick={() => onSelect(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p); } }} style={{ width: "100%", textAlign: "left", padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}18`, cursor: "pointer", display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Header row: identity on the left, primary action (View Profile) on the right. */}
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <Avatar style={{ width: 52, height: 52, flexShrink: 0 }}>
                      <AvatarFallback style={{ background: `${t.ACCENT}20`, color: t.ACCENT, fontSize: 18, fontWeight: 800 }}>{initials(p.displayName)}</AvatarFallback>
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t.TITLE, marginBottom: 4 }}>{p.displayName}</div>
                      {p.headline && <div style={{ fontSize: 13, color: t.SUBTLE, marginBottom: 6 }}>{p.headline}</div>}
                      {p.bio && <div style={{ fontSize: 12, color: t.MUTED, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.bio}</div>}
                    </div>
                    <span style={{ padding: "7px 16px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      View Profile
                    </span>
                  </div>

                  {/* Skills use the full card width and wrap into a compact cloud, capped
                      with a "+N more" chip that opens the full profile. */}
                  {p.offeredSkills.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {visibleSkills.map((s) => {
                        const active = s.id === activeSkillId;
                        return (
                          <span
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onSkillFilter?.(active ? null : s.id, active ? null : s.name); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSkillFilter?.(active ? null : s.id, active ? null : s.name); } }}
                            style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", background: active ? t.ACCENT : `${t.ACCENT}12`, color: active ? "#1a1205" : t.ACCENT, border: `1px solid ${active ? t.ACCENT : t.ACCENT + "30"}` }}
                          >
                            {s.name}
                          </span>
                        );
                      })}
                      {hiddenSkillCount > 0 ? (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`View ${hiddenSkillCount} more ${hiddenSkillCount === 1 ? "skill" : "skills"} on ${p.displayName}'s profile`}
                          onClick={(e) => { e.stopPropagation(); onSelect(p); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSelect(p); } }}
                          style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", background: t.INPUT_BG, color: t.SUBTLE, border: "1px solid rgba(255,255,255,0.14)" }}
                        >
                          +{hiddenSkillCount} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* 1:1 call availability — one of the key signals for a member deciding who to reach. */}
                  {canOfferConnectNow(p, viewerUserId) ? (
                    <ConnectNowButton provider={p} compact />
                  ) : acceptsInstantCalls(p) ? (
                    <InstantCallAvailabilityBadge provider={p} compact />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

export function QuotesPanel({
  quotes, onBrowse, onOpenDirectLine,
}: {
  quotes: QuoteView[];
  onBrowse: () => void;
  onOpenDirectLine: (quote: QuoteView) => void;
}) {
  const { theme } = useTheme();
  const t = getFoundationTokens(theme);
  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t.TITLE, marginBottom: 4 }}>My Quote Requests</div>
        <div style={{ fontSize: 14, color: t.MUTED, marginBottom: 20 }}>Track your service requests and responses</div>
        {quotes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={28} style={{ color: t.ACCENT, opacity: 0.5 }} />
            </div>
            <div style={{ textAlign: "center", maxWidth: 360 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.TITLE, marginBottom: 8 }}>No quote requests yet</div>
              <div style={{ fontSize: 14, color: t.MUTED, lineHeight: 1.7 }}>When you request quotes from trade providers, they&apos;ll appear here so you can track status and manage your service history in one place.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 400 }}>
              {EMPTY_STEPS.map((step, i) => (
                <div key={step} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(239,68,68,0.15)" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 700, color: t.ACCENT }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: t.MUTED }}>{step}</span>
                </div>
              ))}
            </div>
            <button onClick={onBrowse} style={{ padding: "12px 24px", borderRadius: 12, background: t.ACCENT, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Wrench size={16} /> Request a Trade Service
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {quotes.map((q) => {
              const status = quoteStatus(q.lifecycleState);
              return (
                <div key={q.id} style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${t.ACCENT}20`, display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${t.ACCENT}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileText size={18} style={{ color: t.ACCENT }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.TITLE, marginBottom: 2 }}>{q.serviceType}</div>
                    <div style={{ fontSize: 12, color: t.MUTED }}>Requested {formatQuoteDate(q.createdAtIso)}</div>
                  </div>
                  <Badge style={{ background: status.bg, color: status.fg, border: `1px solid ${status.bd}`, fontSize: 11 }}>{status.label}</Badge>
                  <button
                    onClick={() => onOpenDirectLine(q)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${t.ACCENT}15`, border: `1px solid ${t.ACCENT}30`, color: t.ACCENT, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                  >
                    <MessageSquare size={14} /> Direct Line
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
