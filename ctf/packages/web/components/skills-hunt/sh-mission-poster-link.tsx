"use client";

import { Download } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { getSkillsHuntTokens } from "./sh-shared";

// Admin-only: saves the round's active missions as one tall picture, to post where the round is
// being advertised.
//
// The missions list is taller than a phone screen, so getting a clean picture of it by hand takes
// several screenshots, a scroll between each, and a stitch afterwards that loses cards at the seams
// and leaves the app's own top bar, clock and battery in the middle of the result. One press
// replaces all of that.
//
// A plain link rather than a fetch: the route answers with the picture itself, and the same
// signed-in session that loaded this screen authorizes the request. The route sends it as an
// attachment, so the browser saves the file and this screen stays where it was.
export function SkillsHuntMissionPosterLink({ roundId }: { roundId: string }) {
  const { theme } = useTheme();
  const t = getSkillsHuntTokens(theme);
  return (
    <div
      style={{
        marginBottom: 18,
        padding: "14px 16px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${t.BORDER}`,
      }}
    >
      <a
        href={`/api/skills-hunt/admin/rounds/${roundId}/missions/image`}
        download
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 14px",
          borderRadius: 10,
          background: t.ACCENT,
          color: "#111",
          fontSize: 13,
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        <Download size={15} color="#111" />
        Save these missions as one picture
      </a>
      <div style={{ fontSize: 11, color: t.MUTED, marginTop: 8, lineHeight: 1.5 }}>
        Admins only. Draws every active mission in this round as one tall picture, named for
        today&apos;s date, so the round can be advertised without stitching screenshots together. You
        stay on this screen — on a phone, open it from your downloads to save it to your photos or
        send it to another app. The picture carries the missions themselves, not anyone&apos;s
        progress.
      </div>
    </div>
  );
}
