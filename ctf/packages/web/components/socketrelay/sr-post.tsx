"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { COLOR, MAX_TAGS_PER_POST, SUBTLE } from "./sr-shared";

export type PostDraft = {
  title: string;
  details: string;
  tags: string[];
  city: string;
  isPublic: boolean;
};

function TagEditor({
  tags,
  onChange,
  suggest,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggest: (prefix: string, exclude: string[]) => string[];
}) {
  const [input, setInput] = useState("");
  const full = tags.length >= MAX_TAGS_PER_POST;

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag || full) return;
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...tags, tag]);
    setInput("");
  };

  const suggestions = full ? [] : suggest(input, tags);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: tags.length > 0 ? 8 : 0 }}>
        {tags.map((tag) => (
          <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 14, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600 }}>
            {tag}
            <X size={12} style={{ cursor: "pointer" }} onClick={() => onChange(tags.filter((t) => t !== tag))} />
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(input);
          }
        }}
        onBlur={() => addTag(input)}
        placeholder={full ? `Up to ${MAX_TAGS_PER_POST} tags per post` : "Type a tag and press Enter — Food, Mail, Legal, anything"}
        disabled={full}
        style={{ width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" }}
      />
      {suggestions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: SUBTLE, alignSelf: "center" }}>In use:</span>
          {suggestions.map((tag) => (
            <button key={tag} type="button" onClick={() => addTag(tag)} style={{ padding: "4px 10px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 12, cursor: "pointer" }}>
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SocketRelayPost({
  draft,
  editing,
  onChange,
  submitting,
  error,
  success,
  onSubmit,
  onCancelEdit,
  suggest,
}: {
  draft: PostDraft;
  editing: boolean;
  onChange: (patch: Partial<PostDraft>) => void;
  submitting: boolean;
  error: string | null;
  success: boolean;
  onSubmit: () => void;
  onCancelEdit: () => void;
  suggest: (prefix: string, exclude: string[]) => string[];
}) {
  const fieldStyle = { width: "100%", padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 14, color: "#E8EAF0", outline: "none", boxSizing: "border-box" as const };
  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#F9FAFB", marginBottom: 20 }}>{editing ? "Edit Your Request" : "Post a Request"}</div>
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
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 6 }}>Tags (up to {MAX_TAGS_PER_POST})</div>
          <TagEditor tags={draft.tags} onChange={(tags) => onChange({ tags })} suggest={suggest} />
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
        {success && <div style={{ fontSize: 13, color: "#22C55E" }}>{editing ? "Saved! View it in the feed." : "Posted successfully! View it in the feed."}</div>}
        <button onClick={onSubmit} disabled={submitting} style={{ padding: "14px", borderRadius: 12, background: submitting ? `${COLOR}66` : COLOR, border: "none", color: "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}>
          {submitting ? (editing ? "Saving…" : "Posting…") : editing ? "Save Changes" : "Post Request"}
        </button>
        {editing && (
          <button onClick={onCancelEdit} disabled={submitting} style={{ padding: "12px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#9CA3AF", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Cancel Edit
          </button>
        )}
        <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.6 }}>Requests never include identifying information beyond what you write. Connections happen after someone offers to help.</div>
      </div>
    </div>
  );
}
