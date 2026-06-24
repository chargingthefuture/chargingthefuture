"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Hammer, Search, Shield, Wrench, FileText,
} from "lucide-react";
import { PluginRailFooter } from "@/components/shared/plugin-rail-footer";
import { COLOR, TRADES, initials, type FoundationTab, type ProviderView } from "./foundation-ui";

const TABS: { icon: React.ElementType; key: FoundationTab; label: string }[] = [
  { icon: Wrench, key: "browse", label: "Browse" },
  { icon: Shield, key: "offer", label: "Offer skills" },
  { icon: FileText, key: "quotes", label: "Quotes" },
];

export function IconRail({ tab, onTab }: { tab: FoundationTab; onTab: (t: FoundationTab) => void }) {
  return (
    <aside style={{ width: 72, background: "#090B0F", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <Hammer size={20} style={{ color: COLOR }} />
      </div>
      {TABS.map(({ icon: Icon, key, label }) => (
        <button key={key} onClick={() => onTab(key)} aria-label={label} title={label} style={{ width: 44, height: 44, borderRadius: 12, background: tab === key ? `${COLOR}20` : "transparent", border: tab === key ? `1px solid ${COLOR}40` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: tab === key ? COLOR : "#6B7280" }}>
          <Icon size={20} />
        </button>
      ))}
      <PluginRailFooter />
    </aside>
  );
}

export function FilterSidebar({
  query, onQuery, trade, onTrade,
}: {
  query: string;
  onQuery: (v: string) => void;
  trade: string;
  onTrade: (t: string) => void;
}) {
  return (
    <aside style={{ width: 240, background: "#0D0F14", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 }}>Foundation</div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search providers…"
            style={{ width: "100%", padding: "7px 10px 7px 30px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 13, color: "#9CA3AF", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>
      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: "0 8px 16px" }}>
          {TRADES.map((t) => (
            <button key={t} onClick={() => onTrade(t)} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: trade === t ? `${COLOR}18` : "transparent", borderLeft: trade === t ? `2px solid ${COLOR}` : "2px solid transparent", border: "none", marginLeft: 2, marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: trade === t ? "#E8EAF0" : "#9CA3AF", flex: 1 }}>{t}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

export function RightRail({
  providers, quoteCount, onBrowse, onSelect,
}: {
  providers: ProviderView[];
  quoteCount: number;
  onBrowse: () => void;
  onSelect: (p: ProviderView) => void;
}) {
  return (
    <aside style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)", background: "#0D0F14", padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 12 }}>Providers</div>
      {providers.slice(0, 4).map((p) => (
        <button key={p.profileId} onClick={() => onSelect(p)} style={{ width: "100%", textAlign: "left", display: "flex", gap: 10, alignItems: "center", padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${COLOR}15`, marginBottom: 8, cursor: "pointer" }}>
          <Avatar style={{ width: 36, height: 36 }}>
            <AvatarFallback style={{ background: `${COLOR}20`, color: COLOR, fontSize: 14, fontWeight: 700 }}>{initials(p.displayName)}</AvatarFallback>
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.displayName}</div>
            {p.headline && <div style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.headline}</div>}
          </div>
        </button>
      ))}
      {providers.length === 0 && (
        <div style={{ fontSize: 12, color: "#4B5563", textAlign: "center", padding: "16px 0" }}>No providers loaded.</div>
      )}
      <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: `${COLOR}08`, border: `1px solid ${COLOR}20` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Shield size={14} style={{ color: COLOR }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: COLOR }}>Good to know</span>
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>Providers are fellow community members, not a formally vetted service — use your judgment.</div>
      </div>
      <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase", marginBottom: 10 }}>Your Activity</div>
        {[{ l: "Providers", v: String(providers.length) }, { l: "My Quotes", v: String(quoteCount) }].map(({ l, v }) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", color: "#6B7280" }}>
            <span>{l}</span>
            <span style={{ color: COLOR, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
      <button onClick={onBrowse} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        Browse All Providers
      </button>
    </aside>
  );
}
