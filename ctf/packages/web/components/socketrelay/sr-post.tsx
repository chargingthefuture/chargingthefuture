"use client";

import { COLOR, SUBTLE } from "./sr-shared";

export type PostDraft = {
  title: string;
  details: string;
  category: string;
  city: string;
  isPublic: boolean;
};

export function SocketRelayPost({
  draft,
  onChange,
  submitting,
  error,
  success,
  onSubmit,
}: {
  draft: PostDraft;
  onChange: (patch: Partial<PostDraft>) => void;
  submitting: boolean;
  error: string | null;
  success: boolean;
  onSubmit: () => void;
}) {
  const fieldStyle = { width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" as const };
  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 20 }}>Post a Request</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 620 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Title</div>
          <input value={draft.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="A short summary of what you need or can offer" style={fieldStyle} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Details</div>
          <textarea value={draft.details} onChange={(e) => onChange({ details: e.target.value })} placeholder="Be specific about what help you need or can give…" rows={3} style={{ ...fieldStyle, resize: "none" }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Tag</div>
          <input value={draft.category} onChange={(e) => onChange({ category: e.target.value })} placeholder="One or two words, anything — Food, Mail, Legal, Pet Care…" style={fieldStyle} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>City (privacy-protected)</div>
          <input value={draft.city} onChange={(e) => onChange({ city: e.target.value })} placeholder="City or neighborhood only — never exact address" style={fieldStyle} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9CA3AF", cursor: "pointer" }}>
          <input type="checkbox" checked={draft.isPublic} onChange={(e) => onChange({ isPublic: e.target.checked })} />
          Make this request publicly visible (otherwise members-only)
        </label>
        {error && <div style={{ fontSize: 13, color: "#EF4444" }}>{error}</div>}
        {success && <div style={{ fontSize: 13, color: "#22C55E" }}>Posted successfully! View it in the feed.</div>}
        <button onClick={onSubmit} disabled={submitting} style={{ padding: "14px", borderRadius: 12, background: submitting ? `${COLOR}66` : COLOR, border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}>
          {submitting ? "Posting…" : "Post Request"}
        </button>
        <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6 }}>Requests never include identifying information beyond what you write. Connections happen after someone offers to help.</div>
      </div>
    </div>
  );
}
