"use client";

import { Coins } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COLOR } from "./sc-shared";
import { INFO_MSGS } from "./service-credits.constants";

// Informational panel (the design's "chat" tab) — static explainer messages
// about how ServiceCredits work. No AI/Stream chat is wired; the real transfer
// action lives in the right-hand Send panel.
export function ServiceCreditsInfoTab() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <ScrollArea style={{ flex: 1, padding: "24px" }}>
        <div style={{ padding: "0 0 16px" }}>
          {INFO_MSGS.map((msg) => (
            <div key={msg.id} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Coins size={14} style={{ color: COLOR }} />
              </div>
              <div style={{ maxWidth: "70%" }}>
                <div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, lineHeight: 1.6, color: "#E8EAF0" }}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div style={{ padding: "8px 24px 20px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ textAlign: "center", fontSize: 12, color: "#4B5563" }}>Use the Send Credits panel on the right to transfer credits to another member.</div>
      </div>
    </div>
  );
}
