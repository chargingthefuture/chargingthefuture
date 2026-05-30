"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpRight, Heart, Plus, Send } from "lucide-react";
import { COLOR, FAINT, TEXT } from "./gp-shared";

const INFO_MSGS = [
  { id: 1, text: "GentlePulse offers trauma-informed guided meditation and breathwork. Sessions are designed by certified trauma therapists. What do you need right now?" },
  { id: 2, text: "Explore breathing exercises, body scans, and sleep sessions — all designed to support survivors. Start with something short like a 5-minute breathing exercise.", action: "Browse Sessions" },
];

export function GentlePulseChat({
  chatInput,
  onChatInput,
  onBrowse,
}: {
  chatInput: string;
  onChatInput: (value: string) => void;
  onBrowse: () => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <ScrollArea style={{ flex: 1, padding: "16px 24px" }}>
        <div style={{ paddingBottom: 8 }}>
          {INFO_MSGS.map((msg) => (
            <div key={msg.id} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Heart size={14} style={{ color: COLOR }} />
              </div>
              <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.04)", border: `1px solid ${COLOR}15`, fontSize: 14, lineHeight: 1.6, color: TEXT }}>
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
      <div style={{ padding: "8px 24px 20px", flexShrink: 0, borderTop: `1px solid ${COLOR}10` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(20,184,166,0.04)", border: `1px solid ${COLOR}20`, borderRadius: 14 }}>
          <Plus size={18} style={{ color: FAINT }} />
          <input
            value={chatInput}
            onChange={(e) => onChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onChatInput(""); }}
            placeholder="How can GentlePulse help you right now?"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: TEXT }}
          />
          <button onClick={() => onChatInput("")} style={{ width: 32, height: 32, borderRadius: 8, background: chatInput.trim() ? COLOR : "rgba(255,255,255,0.06)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Send size={14} style={{ color: chatInput.trim() ? "#0A0F0E" : FAINT }} />
          </button>
        </div>
      </div>
    </div>
  );
}
