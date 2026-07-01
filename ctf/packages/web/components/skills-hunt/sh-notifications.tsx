"use client";

import { COLOR, type SkillsHuntNotification } from "./sh-shared";

export function SkillsHuntNotifications({
  notifications,
  onClose,
  onMarkRead,
}: {
  notifications: SkillsHuntNotification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
}) {
  return (
    <div style={{ position: "absolute", left: 80, top: 60, width: 360, maxHeight: 480, overflowY: "auto", background: "#0D0F14", border: `1px solid ${COLOR}40`, borderRadius: 14, zIndex: 50, boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#F9FAFB" }}>Status</span>
        <button type="button" aria-label="Close status" onClick={onClose} style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      {notifications.length === 0 ? (
        <div style={{ padding: 24, fontSize: 13, color: "#6B7280", textAlign: "center" }}>No status updates yet.</div>
      ) : (
        <div>
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.isRead && onMarkRead(n.id)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: n.isRead ? "transparent" : `${COLOR}08`,
                border: "none", borderLeft: n.isRead ? "2px solid transparent" : `2px solid ${COLOR}`,
                cursor: n.isRead ? "default" : "pointer",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 700, color: "#F9FAFB", marginBottom: 2 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.4 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>{new Date(n.createdAtIso).toLocaleString()}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
