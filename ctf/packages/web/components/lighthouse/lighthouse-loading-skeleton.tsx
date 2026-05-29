"use client";

// STATE: Loading — data fetch in progress. Ported from
// design/.../survivor-hub/LightHouseLoading.tsx.
import { Home } from "lucide-react";
import { BG, COLOR } from "./shared";

const surface = "#161B27";
const border = "#1E2A3A";

function Sk({ w = "100%", h = 14, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />;
}

export function LighthouseLoadingSkeleton() {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: BG, fontFamily: "'Inter',system-ui", color: "#F9FAFB", overflow: "hidden" }}>
      <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}30`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Home size={20} color={COLOR} />
        </div>
        {[1, 2, 3].map((i) => <Sk key={i} w={44} h={44} r={12} />)}
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: surface }}>
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${border}`, display: "flex", gap: 10, flexShrink: 0 }}>
          <Sk h={40} r={8} />
          <Sk w={100} h={40} r={8} /><Sk w={100} h={40} r={8} /><Sk w={90} h={40} r={8} />
          <Sk w={110} h={40} r={8} />
        </div>
        <div style={{ padding: "10px 24px", borderBottom: `1px solid ${border}`, display: "flex", gap: 12, flexShrink: 0 }}>
          {[1, 2, 3, 4].map((i) => <Sk key={i} w={110} h={22} r={11} />)}
          <div style={{ marginLeft: "auto" }}><Sk w={80} h={28} r={8} /></div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ borderRadius: 16, border: `1px solid ${border}`, display: "flex", overflow: "hidden" }}>
              <Sk w={200} h={160} r={0} />
              <div style={{ flex: 1, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Sk w={220} h={16} r={5} /><Sk w={70} h={22} r={11} />
                </div>
                <Sk w={140} h={12} r={4} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Sk w={50} h={11} r={4} /><Sk w={50} h={11} r={4} /><Sk w={70} h={11} r={4} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[80, 90, 100, 75].map((w, j) => <Sk key={j} w={w} h={22} r={11} />)}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: "auto", alignItems: "center" }}>
                  <Sk w={70} h={24} r={5} />
                  <div style={{ marginLeft: "auto" }}><Sk w={100} h={36} r={8} /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
