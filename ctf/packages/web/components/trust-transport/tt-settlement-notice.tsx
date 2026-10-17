"use client";

// The line on a finished trip whose credits did not move (owner decision, 2026-10-17; issue #2866).
// Shown to both members: the driver is the one who was not paid, and the rider should know nothing was
// taken. The failure is already recorded in the admin audit trail, which is where an admin settles it.
export function SettlementFailedNotice({ show }: { show: boolean | undefined }) {
  if (!show) return null;
  return (
    <div
      role="status"
      style={{ marginTop: 10, marginBottom: 12, padding: "10px 12px", borderRadius: 9, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#F59E0B", fontSize: 12, fontWeight: 600 }}
    >
      The credits for this trip did not move. An admin has been told.
    </div>
  );
}
