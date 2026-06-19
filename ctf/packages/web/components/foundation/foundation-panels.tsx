"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Hammer, FileText, Wrench, Send, Plus, ArrowUpRight } from "lucide-react";
import {
  COLOR, initials, quoteStatus, formatQuoteDate,
  type ProviderView, type QuoteView,
} from "./foundation-ui";

const INFO_MSGS = [
  { id: 1, text: "Foundation connects you with trade providers from the community — electricians, plumbers, carpenters, and more. Pay with Service Credits. What do you need help with?" },
  { id: 2, text: "Search by trade or keyword, then open a provider to request a quote. Service Credits are accepted on all bookings.", action: "Browse Providers" },
];

const EMPTY_STEPS = [
  "Request an electrician, plumber, or other trade",
  "Get quotes from vetted providers",
  "Accept a quote and pay with Service Credits",
];

export function BrowsePanel({
  providers, onSelect, activeSkillId = null, activeSkillName = null, onSkillFilter,
}: {
  providers: ProviderView[];
  onSelect: (p: ProviderView) => void;
  activeSkillId?: string | null;
  activeSkillName?: string | null;
  onSkillFilter?: (skillId: string | null, skillName?: string | null) => void;
}) {
  // Prefer the name passed from the shell (the chip the member tapped) so the banner label survives
  // even when the filter returns zero providers; fall back to whichever card still shows it.
  const bannerSkillName = activeSkillName
    ?? (activeSkillId
      ? providers.flatMap((p) => p.offeredSkills).find((s) => s.id === activeSkillId)?.name ?? null
      : null);

  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ marginBottom: 20, padding: "20px 24px", borderRadius: 16, background: `linear-gradient(135deg,${COLOR}15 0%,rgba(239,68,68,0.05) 100%)`, border: `1px solid ${COLOR}20` }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>Find providers offering a skill</div>
          <div style={{ fontSize: 14, color: "#9CA3AF" }}>Everyone here has opted in to be contacted — tap a skill to filter.</div>
        </div>
        {activeSkillId ? (
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: `${COLOR}12`, border: `1px solid ${COLOR}30` }}>
            <span style={{ fontSize: 13, color: "#F9FAFB" }}>Offering: <strong style={{ color: COLOR }}>{bannerSkillName ?? "selected skill"}</strong></span>
            <button onClick={() => onSkillFilter?.(null)} style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 7, background: "transparent", border: `1px solid ${COLOR}40`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Clear</button>
          </div>
        ) : null}
        {providers.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px dashed rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Hammer size={20} style={{ color: "rgba(239,68,68,0.4)" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#9CA3AF" }}>No providers offering this yet</div>
            <div style={{ fontSize: 13, color: "#4B5563" }}>Try clearing the skill filter or searching differently.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {providers.map((p) => (
              <div key={p.profileId} role="button" tabIndex={0} onClick={() => onSelect(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p); } }} style={{ width: "100%", textAlign: "left", padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}18`, cursor: "pointer", display: "flex", gap: 16, alignItems: "flex-start" }}>
                <Avatar style={{ width: 52, height: 52, flexShrink: 0 }}>
                  <AvatarFallback style={{ background: `${COLOR}20`, color: COLOR, fontSize: 18, fontWeight: 800 }}>{initials(p.displayName)}</AvatarFallback>
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginBottom: 4 }}>{p.displayName}</div>
                  {p.headline && <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 6 }}>{p.headline}</div>}
                  {p.bio && <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 8 }}>{p.bio}</div>}
                  {p.offeredSkills.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {p.offeredSkills.map((s) => {
                        const active = s.id === activeSkillId;
                        return (
                          <span
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onSkillFilter?.(active ? null : s.id, active ? null : s.name); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSkillFilter?.(active ? null : s.id, active ? null : s.name); } }}
                            style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer", background: active ? COLOR : `${COLOR}12`, color: active ? "#1a1205" : COLOR, border: `1px solid ${active ? COLOR : COLOR + "30"}` }}
                          >
                            {s.name}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <span style={{ padding: "7px 16px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  View Profile
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

export function QuotesPanel({
  quotes, onBrowse,
}: {
  quotes: QuoteView[];
  onBrowse: () => void;
}) {
  return (
    <ScrollArea style={{ flex: 1 }}>
      <div style={{ padding: "24px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#F9FAFB", marginBottom: 4 }}>My Quote Requests</div>
        <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Track your service requests and responses</div>
        {quotes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={28} style={{ color: COLOR, opacity: 0.5 }} />
            </div>
            <div style={{ textAlign: "center", maxWidth: 360 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#F9FAFB", marginBottom: 8 }}>No quote requests yet</div>
              <div style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7 }}>When you request quotes from trade providers, they&apos;ll appear here so you can track status and manage your service history in one place.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 400 }}>
              {EMPTY_STEPS.map((step, i) => (
                <div key={step} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(239,68,68,0.15)" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${COLOR}15`, border: `1px solid ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 700, color: COLOR }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{step}</span>
                </div>
              ))}
            </div>
            <button onClick={onBrowse} style={{ padding: "12px 24px", borderRadius: 12, background: COLOR, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Wrench size={16} /> Request a Trade Service
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {quotes.map((q) => {
              const status = quoteStatus(q.lifecycleState);
              return (
                <div key={q.id} style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}20`, display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileText size={18} style={{ color: COLOR }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", marginBottom: 2 }}>{q.serviceType}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>Requested {formatQuoteDate(q.createdAtIso)}</div>
                  </div>
                  <Badge style={{ background: status.bg, color: status.fg, border: `1px solid ${status.bd}`, fontSize: 11 }}>{status.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

export function ChatPanel({
  input, onInput, onSend, onBrowse,
}: {
  input: string;
  onInput: (v: string) => void;
  onSend: () => void;
  onBrowse: () => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
        <div style={{ paddingBottom: 8 }}>
          {INFO_MSGS.map((msg) => (
            <div key={msg.id} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Hammer size={14} style={{ color: COLOR }} />
              </div>
              <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, lineHeight: 1.6, color: "#E8EAF0" }}>
                  {msg.text}
                </div>
                {msg.action && (
                  <button onClick={onBrowse} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
                    {msg.action} <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div style={{ padding: "8px 24px 20px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14 }}>
          <Plus size={18} style={{ color: "#4B5563" }} />
          <input
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
            placeholder="Describe what you need help with…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }}
          />
          <button onClick={onSend} aria-label="Send" style={{ width: 32, height: 32, borderRadius: 8, background: input.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Send size={14} style={{ color: input.trim() ? "#fff" : "#4B5563" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
