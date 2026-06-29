"use client";

// Dedicated Directory admin surface. Layout and palette derive from
// design/.../survivor-hub/DirectoryAdmin.tsx (desktop) and
// MobileDirectoryAdmin.tsx (phone). Owner decision 2026-06-06: Directory has
// BOTH the inline "Attach to account" control on the profile detail AND this
// dedicated admin page; they coexist.
//
// Real data only (rule 126). Every control here is backed by a live endpoint:
//   - list:   GET  /api/directory/admin/profiles
//   - edit:   PUT  /api/directory/admin/profiles/[id]
//   - assign: PUT  /api/directory/admin/profiles/[id]/assign   ({ userId })
//   - delete: DELETE /api/directory/admin/profiles/[id]        (unclaimed only)
//
// Mockup controls intentionally omitted (no backing endpoint / field):
//   - "Mark as verified" toggle — there is no `verified` column on
//     directory_profiles, so the verify state cannot be persisted.
//   - "Assign Handle" input — `unclaimedHandle` is system-assigned and is not
//     part of the admin update contract (DirectoryProfileInput), so it is shown
//     read-only rather than edited.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Shield,
  Bell,
  CheckCircle,
  Edit2,
  Trash2,
  Users,
  X,
  Save,
  UserCheck,
  ChevronLeft,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";

const COLOR = "#93C5FD";
const COMMUNITY = "#A855F7";
const BG = "#0F1117";
const BORDER = "#1E2A3A";
const TEXT = "#F9FAFB";
const SUBTLE = "#6B7280";

type ProfileSource = "admin" | "self" | "community-generated";

// Shape returned by GET /api/directory/admin/profiles `items`.
export interface AdminDirectoryProfile {
  id: string;
  claimedByUserId: string | null;
  firstName: string;
  lastName: string | null;
  headline: string | null;
  bio: string | null;
  profileUrl: string | null;
  sectorId: string | null;
  sectorName: string | null;
  jobTitleId: string | null;
  jobTitleName: string | null;
  skills: Array<{ id: string; name: string; displayOrder: number }>;
  isActive: boolean;
  source: ProfileSource;
  invitedByUsername: string | null;
  unclaimedHandle: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  // Payment addresses are part of the GET /api/directory/admin/profiles response
  // shape (mirroring the mobile DirectoryListItem). They are member-owned and are
  // not editable from the admin shell, so they are preserved untouched on save.
  venmoAddress?: string | null;
  moneroAddress?: string | null;
  bitcoinAddress?: string | null;
  serviceCreditsAddress?: string | null;
}

type FilterKey = "All" | "Claimed" | "Unclaimed";
const FILTERS: FilterKey[] = ["All", "Claimed", "Unclaimed"];

type EditForm = {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  profileUrl: string;
};

function fullName(p: { firstName: string; lastName: string | null }): string {
  return [p.firstName, p.lastName].filter((s) => s && s.trim().length > 0).join(" ").trim();
}

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function sourceBadge(p: AdminDirectoryProfile): { label: string; color: string } {
  if (p.source === "community-generated") return { label: "Community-generated", color: COMMUNITY };
  if (p.source === "admin") return { label: "Admin-claimed", color: COLOR };
  return { label: "Self", color: "#22C55E" };
}

function handleText(p: AdminDirectoryProfile): string {
  if (p.unclaimedHandle) return `@${p.unclaimedHandle}`;
  if (p.claimedByUserId) return "Claimed";
  return "—";
}

function toForm(p: AdminDirectoryProfile): EditForm {
  return {
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    headline: p.headline ?? "",
    bio: p.bio ?? "",
    profileUrl: p.profileUrl ?? "",
  };
}

export function DirectoryAdminShell({ currentUserId }: { currentUserId: string }) {
  const isMobile = useIsMobile();
  const [profiles, setProfiles] = useState<AdminDirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("All");
  const [query, setQuery] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>({ firstName: "", lastName: "", headline: "", bio: "", profileUrl: "" });
  const [assignInput, setAssignInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerNotice, setDrawerNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/directory/admin/profiles?pageSize=100&includeInactive=true");
      if (!res.ok) {
        setError("Could not load profiles.");
        return;
      }
      const data = (await res.json()) as { items?: AdminDirectoryProfile[] };
      setProfiles(data.items ?? []);
    } catch {
      setError("Could not load profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (filter === "Unclaimed" && p.claimedByUserId != null) return false;
      if (filter === "Claimed" && p.claimedByUserId == null) return false;
      if (q.length > 0) {
        const hay = `${fullName(p)} ${p.headline ?? ""} ${p.jobTitleName ?? ""} ${p.unclaimedHandle ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [profiles, filter, query]);

  const unclaimedCount = useMemo(() => profiles.filter((p) => p.claimedByUserId == null).length, [profiles]);
  const editing = editId ? profiles.find((p) => p.id === editId) ?? null : null;

  const startEdit = useCallback((p: AdminDirectoryProfile) => {
    setEditId(p.id);
    setForm(toForm(p));
    setAssignInput("");
    setDrawerError(null);
    setDrawerNotice(null);
  }, []);

  const closeDrawer = useCallback(() => {
    setEditId(null);
    setDrawerError(null);
    setDrawerNotice(null);
    setAssignInput("");
  }, []);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setDrawerError(null);
    setDrawerNotice(null);
    try {
      const res = await fetch(`/api/directory/admin/profiles/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          headline: form.headline.trim() || null,
          bio: form.bio.trim() || null,
          profileUrl: form.profileUrl.trim() || null,
          // Preserve existing taxonomy selections so an edit of the text fields
          // does not wipe the profile's sector/job-title/skills.
          sectorId: editing.sectorId,
          jobTitleId: editing.jobTitleId,
          skillIds: editing.skills.map((s) => s.id),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; profile?: AdminDirectoryProfile; message?: string };
      if (res.ok && body.ok && body.profile) {
        const updated = body.profile;
        setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        closeDrawer();
        return;
      }
      setDrawerError(body.message ?? "Could not save this profile.");
    } catch {
      setDrawerError("Could not save this profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!editing) return;
    const target = assignInput.trim();
    if (target.length === 0) return;
    setSaving(true);
    setDrawerError(null);
    setDrawerNotice(null);
    try {
      const res = await fetch(`/api/directory/admin/profiles/${editing.id}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ userId: target }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; profile?: AdminDirectoryProfile; message?: string };
      if (res.ok && body.ok && body.profile) {
        const updated = body.profile;
        setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setDrawerNotice("Profile attached to that account.");
        setAssignInput("");
        return;
      }
      setDrawerError(body.message ?? "Could not attach this profile.");
    } catch {
      setDrawerError("Could not attach this profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: AdminDirectoryProfile) {
    if (p.claimedByUserId != null) return;
    const name = fullName(p) || "this profile";
    if (!window.confirm(`Delete ${name}? This permanently removes the unclaimed profile and cannot be undone.`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/directory/admin/profiles/${p.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
      });
      if (res.ok) {
        setProfiles((prev) => prev.filter((x) => x.id !== p.id));
        if (editId === p.id) closeDrawer();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (editId === p.id) setDrawerError(body.message ?? "Could not delete this profile.");
    } catch {
      if (editId === p.id) setDrawerError("Could not delete this profile.");
    } finally {
      setSaving(false);
    }
  }

  // ── Shared edit drawer body ───────────────────────────────────────────────
  const fields: { label: string; key: keyof EditForm; placeholder: string }[] = [
    { label: "First name", key: "firstName", placeholder: "First name" },
    { label: "Last name", key: "lastName", placeholder: "Last name" },
    { label: "Headline", key: "headline", placeholder: "Role or specialty" },
    { label: "Bio", key: "bio", placeholder: "Short description" },
    { label: "Profile URL", key: "profileUrl", placeholder: "https://…" },
  ];

  function renderDrawerBody(p: AdminDirectoryProfile) {
    const isUnclaimed = p.claimedByUserId == null;
    return (
      <>
        {p.source === "community-generated" && (
          <div style={{ padding: "9px 12px", borderRadius: 8, background: `${COMMUNITY}10`, border: `1px solid ${COMMUNITY}25`, fontSize: 12, color: COMMUNITY, lineHeight: 1.5 }}>
            Community-generated record · <span style={{ fontFamily: "monospace" }}>{p.unclaimedHandle ? `@${p.unclaimedHandle}` : "no handle"}</span>
          </div>
        )}

        {fields.map(({ label, key, placeholder }) => (
          <div key={key}>
            <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</div>
            <input
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              disabled={saving}
              style={{ width: "100%", padding: "8px 11px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        ))}

        {/* Skills are read-only here — editing the taxonomy needs the picker UI. */}
        {p.skills.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Skills</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {p.skills.map((s) => (
                <span key={s.id} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 6, background: `${COLOR}12`, color: COLOR, border: `1px solid ${COLOR}25` }}>{s.name}</span>
              ))}
            </div>
          </div>
        )}

        {/* Assign / attach an unclaimed profile to a user account. */}
        {isUnclaimed && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Attach to account</div>
            <div style={{ fontSize: 12, color: SUBTLE, lineHeight: 1.5, marginBottom: 8 }}>This profile is unclaimed. Attach it to a user account by their Clerk user ID.</div>
            <input
              value={assignInput}
              onChange={(e) => { setAssignInput(e.target.value); setDrawerError(null); }}
              placeholder="Clerk user ID"
              disabled={saving}
              style={{ width: "100%", padding: "8px 11px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => void handleAssign()}
                disabled={saving || assignInput.trim().length === 0}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving || assignInput.trim().length === 0 ? "not-allowed" : "pointer", opacity: saving || assignInput.trim().length === 0 ? 0.5 : 1 }}
              >
                <UserCheck size={13} /> Attach
              </button>
              <button
                type="button"
                onClick={() => { setAssignInput(currentUserId); setDrawerError(null); }}
                disabled={saving}
                style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
              >
                Use my account
              </button>
            </div>
          </div>
        )}

        {drawerNotice && <div style={{ fontSize: 12, color: COLOR }}>{drawerNotice}</div>}
        {drawerError && <div style={{ fontSize: 12, color: "#EF4444" }}>{drawerError}</div>}
      </>
    );
  }

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    if (editing) {
      const p = editing;
      return (
        <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, display: "flex", flexDirection: "column" }}>
          <div style={{ position: "sticky", top: 0, zIndex: 20, padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, background: "#0D0F14", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Edit2 size={15} color={COLOR} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Profile</div>
              <div style={{ fontSize: 11, color: SUBTLE }}>{p.claimedByUserId == null ? "Unclaimed" : "Claimed"} · {sourceBadge(p).label}</div>
            </div>
            <button onClick={closeDrawer} aria-label="Close" style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={14} color={SUBTLE} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            {renderDrawerBody(p)}
          </div>
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8 }}>
            <button onClick={() => void handleSave()} disabled={saving} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 13, borderRadius: 11, background: COLOR, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
              <Save size={14} /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={closeDrawer} style={{ padding: "13px 16px", borderRadius: 11, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: SUBTLE, fontSize: 14, cursor: "pointer" }}>
              Discard
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, display: "flex", flexDirection: "column" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, padding: "12px 16px 10px", borderBottom: `1px solid ${BORDER}`, background: "#0D0F14" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Link href="/apps/directory" aria-label="Back to Directory" style={{ width: 38, height: 38, borderRadius: 10, background: `${COLOR}14`, border: `1px solid ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", color: COLOR, textDecoration: "none", flexShrink: 0 }}>
              <ChevronLeft size={20} />
            </Link>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={16} color={COLOR} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Directory Admin</div>
              <div style={{ fontSize: 11, color: SUBTLE }}>{profiles.length} profiles · {unclaimedCount} unclaimed</div>
            </div>
            <Bell size={18} color={SUBTLE} />
            <MobileTopActions />
          </div>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: SUBTLE }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search profiles…" style={{ width: "100%", padding: "8px 10px 8px 30px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ flex: 1, padding: 7, borderRadius: 8, background: filter === f ? `${COLOR}18` : "rgba(255,255,255,0.04)", border: `1px solid ${filter === f ? COLOR + "40" : BORDER}`, color: filter === f ? COLOR : SUBTLE, fontSize: 12, fontWeight: filter === f ? 700 : 400, cursor: "pointer" }}>{f}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 20px" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: SUBTLE, fontSize: 13 }}>Loading profiles…</div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: "center", color: "#EF4444", fontSize: 13 }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: SUBTLE, fontSize: 13 }}>No profiles match this view.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((p) => {
                const b = sourceBadge(p);
                return (
                  <div key={p.id} style={{ padding: 13, borderRadius: 13, background: "#161B27", border: `1px solid ${BORDER}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLOR}20`, border: `1px solid ${COLOR}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: COLOR, flexShrink: 0 }}>{initials(fullName(p))}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{fullName(p) || "Unnamed"}</div>
                        <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 4 }}>{p.headline ?? p.jobTitleName ?? ""}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5, background: `${b.color}18`, color: b.color, border: `1px solid ${b.color}25` }}>{b.label}</span>
                          <span style={{ fontSize: 10, color: p.claimedByUserId ? "#22C55E" : SUBTLE, display: "flex", alignItems: "center", gap: 3 }}>
                            <CheckCircle size={10} /> {p.claimedByUserId ? "Claimed" : "Unclaimed"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: p.unclaimedHandle ? COMMUNITY : SUBTLE, marginBottom: 10 }}>{handleText(p)}</div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={() => startEdit(p)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 8, borderRadius: 9, background: `${COLOR}12`, border: `1px solid ${COLOR}30`, color: COLOR, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        <Edit2 size={12} /> Edit profile
                      </button>
                      {p.claimedByUserId == null && (
                        <button onClick={() => void handleDelete(p)} disabled={saving} aria-label="Delete profile" style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Desktop layout ───────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100dvh", background: BG, fontFamily: "'Inter', system-ui, sans-serif", color: TEXT, overflow: "hidden" }}>
      {/* Icon rail */}
      <aside style={{ width: 72, background: "#090B0F", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 16, gap: 8, flexShrink: 0 }}>
        <Link href="/apps/directory" aria-label="Back to Directory" style={{ width: 40, height: 40, borderRadius: 12, background: `${COLOR}25`, border: `1px solid ${COLOR}50`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: COLOR }}>
          <BookOpen size={20} />
        </Link>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${COLOR}20`, border: `1px solid ${COLOR}40`, display: "flex", alignItems: "center", justifyContent: "center", color: COLOR }}>
          <Users size={20} />
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${COLOR}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: COLOR }}>A</div>
      </aside>

      {/* Left sidebar */}
      <aside style={{ width: 240, background: "#0D0F14", borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 16px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: SUBTLE, textTransform: "uppercase", marginBottom: 4 }}>📇 Directory Admin</div>
          <div style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.5 }}>Claim, edit, and attach provider records</div>
        </div>
        <div style={{ padding: "0 12px", flex: 1 }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, marginBottom: 2, cursor: "pointer", background: filter === f ? `${COLOR}15` : "transparent", borderLeft: filter === f ? `2px solid ${COLOR}` : "2px solid transparent", color: filter === f ? TEXT : SUBTLE, fontSize: 13, border: "none", textAlign: "left" }}>
              {f}
              {f === "Unclaimed" && unclaimedCount > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, background: `${COMMUNITY}20`, color: COMMUNITY, border: `1px solid ${COMMUNITY}30`, borderRadius: 4, padding: "1px 5px" }}>{unclaimedCount}</span>
              )}
            </button>
          ))}
          <div style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4B5563", textTransform: "uppercase" }}>Stats</div>
          {[
            { l: "Total profiles", v: String(profiles.length), c: COLOR },
            { l: "Unclaimed", v: String(unclaimedCount), c: COMMUNITY },
            { l: "Claimed", v: String(profiles.length - unclaimedCount), c: "#22C55E" },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ padding: "5px 2px", fontSize: 12, color: SUBTLE }}>
              {l}: <span style={{ color: c, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 56, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, background: "#0D0F14", flexShrink: 0 }}>
          <Shield size={18} color={COLOR} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Directory — Admin</div>
            <div style={{ fontSize: 12, color: SUBTLE }}>Profile management · Showing {filtered.length} of {profiles.length}</div>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: SUBTLE, pointerEvents: "none" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search profiles…" style={{ padding: "6px 10px 6px 30px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: TEXT, outline: "none", width: 200 }} />
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.9fr 1.2fr auto", gap: 12, padding: "9px 24px", borderBottom: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.01)", flexShrink: 0 }}>
          {["Provider", "Source", "Status", "Handle", "Actions"].map((h) => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: SUBTLE, fontSize: 14 }}>Loading profiles…</div>
          ) : error ? (
            <div style={{ padding: 48, textAlign: "center", color: "#EF4444", fontSize: 14 }}>{error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: SUBTLE, fontSize: 14 }}>No profiles match this view.</div>
          ) : (
            filtered.map((p) => {
              const b = sourceBadge(p);
              const isEditing = editId === p.id;
              return (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.9fr 1.2fr auto", gap: 12, padding: "13px 24px", borderBottom: `1px solid ${BORDER}`, background: isEditing ? `${COLOR}05` : "transparent", alignItems: "center", borderLeft: isEditing ? `3px solid ${COLOR}` : "3px solid transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: COLOR, flexShrink: 0 }}>{initials(fullName(p))}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{fullName(p) || "Unnamed"}</div>
                      <div style={{ fontSize: 11, color: SUBTLE }}>{p.headline ?? p.jobTitleName ?? ""}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${b.color}18`, color: b.color, border: `1px solid ${b.color}30`, width: "fit-content" }}>{b.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: p.claimedByUserId ? "#22C55E" : SUBTLE }}>
                    <CheckCircle size={13} /> {p.claimedByUserId ? "Claimed" : "Unclaimed"}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: p.unclaimedHandle ? COMMUNITY : SUBTLE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{handleText(p)}</div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => (isEditing ? closeDrawer() : startEdit(p))} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, background: isEditing ? `${COLOR}20` : "rgba(255,255,255,0.04)", border: `1px solid ${isEditing ? COLOR + "50" : BORDER}`, color: isEditing ? COLOR : SUBTLE, fontSize: 12, cursor: "pointer" }}>
                      {isEditing ? <><X size={11} /> Close</> : <><Edit2 size={11} /> Edit</>}
                    </button>
                    {p.claimedByUserId == null && (
                      <button onClick={() => void handleDelete(p)} disabled={saving} aria-label="Delete profile" style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit drawer */}
      {editing && (
        <aside style={{ width: 340, borderLeft: `1px solid ${BORDER}`, background: "#0D0F14", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
            <Edit2 size={14} color={COLOR} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Edit Profile</div>
              <div style={{ fontSize: 11, color: SUBTLE }}>{editing.claimedByUserId == null ? "Unclaimed" : "Claimed"} · {sourceBadge(editing).label}</div>
            </div>
            <button onClick={closeDrawer} aria-label="Close" style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: SUBTLE }}>
              <X size={12} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            {renderDrawerBody(editing)}
          </div>
          <div style={{ padding: "13px 18px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8 }}>
            <button onClick={() => void handleSave()} disabled={saving} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, borderRadius: 9, background: COLOR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
              <Save size={13} /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={closeDrawer} style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: SUBTLE, fontSize: 13, cursor: "pointer" }}>
              Discard
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
