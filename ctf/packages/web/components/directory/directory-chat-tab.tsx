"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpRight, BookOpen, Plus, Send } from "lucide-react";
import { COLOR } from "./shared";

const INFO_MSGS = [
  { id: 1, text: "Directory connects you with verified providers across the Survivor Hub. Who are you looking for?" },
  { id: 2, text: "Search by name, sector, or skill. Use the filters on the left to narrow results. All interactions are privacy-first and trauma-informed.", action: "Browse Providers" },
];

export function DirectoryChatTab({
  chatInput,
  onChatInputChange,
  onBrowse,
}: {
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onBrowse: () => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {INFO_MSGS.map((msg) => (
            <div key={msg.id} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BookOpen size={14} style={{ color: COLOR }} />
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
          <Plus size={18} style={{ color: "#4B5563", flexShrink: 0 }} />
          <input
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onChatInputChange(""); }}
            placeholder="Find providers, ask questions…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#E8EAF0" }}
          />
          <button onClick={() => onChatInputChange("")} style={{ width: 32, height: 32, borderRadius: 8, background: chatInput.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <Send size={14} style={{ color: chatInput.trim() ? "#fff" : "#4B5563" }} />
          </button>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "#374151", marginTop: 8 }}>Privacy-first · Trauma-informed design</div>
      </div>
    </div>
  );
}
