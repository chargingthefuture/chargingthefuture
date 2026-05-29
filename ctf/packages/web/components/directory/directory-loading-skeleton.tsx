"use client";

// STATE: Loading — data fetch in progress. Ported from
// design/.../survivor-hub/DirectoryLoading.tsx.
import { BookOpen } from "lucide-react";
import { BG, COLOR } from "./shared";

const surface = "#161B27";
const border = "#1E2A3A";

function Sk({ w = "100%", h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />;
}

export function DirectoryLoadingSkeleton() {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: BG, fontFamily: "'Inter',system-ui", color: "#F9FAFB", overflow: "hidden" }}>
      {/* Sidebar */}
      <aside style={{ width: 320, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <BookOpen size={16} color={COLOR} /><Sk w={90} h={16} r={6} />
          </div>
          <Sk h={36} r={8} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {[60, 80, 55, 70, 65, 75, 50].map((w, i) => <Sk key={i} w={w} h={24} r={12} />)}
          </div>
        </div>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${border}`, display: "flex", gap: 6 }}>
          <Sk w={90} h={32} r={8} /><Sk w={90} h={32} r={8} />
        </div>
        <div style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[{ from: "hub", w: 200 }, { from: "me", w: 160 }, { from: "hub", w: 220 }].map(({ from, w }, i) => (
            <div key={i} style={{ display: "flex", justifyContent: from === "me" ? "flex-end" : "flex-start" }}>
              <Sk w={w} h={44} r={10} />
            </div>
          ))}
        </div>
        <div style={{ padding: "12px", borderTop: `1px solid ${border}` }}>
          <div style={{ display: "flex", gap: 8 }}><Sk h={40} r={8} /><Sk w={40} h={40} r={8} /></div>
        </div>
      </aside>

      {/* Main — profile list */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: surface }}>
        <div style={{ height: 56, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 12, flexShrink: 0 }}>
          <Sk w={120} h={16} r={6} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}><Sk w={100} h={32} r={8} /><Sk w={80} h={32} r={8} /></div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ borderRadius: 14, border: `1px solid ${border}`, padding: "16px 20px", display: "flex", gap: 16 }}>
              <Sk w={56} h={56} r={28} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Sk w={130} h={15} r={5} /><Sk w={70} h={20} r={10} />
                </div>
                <Sk w={160} h={12} r={4} />
                <div style={{ display: "flex", gap: 6 }}>
                  {[55, 45, 65].map((w, j) => <Sk key={j} w={w} h={22} r={11} />)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <Sk w={50} h={14} r={5} /><Sk w={80} h={32} r={8} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
