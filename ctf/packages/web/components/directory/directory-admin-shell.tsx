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
import { PluginUserShellButton } from '@/components/shared/plugin-user-shell-button';
import { BackChevronButton } from "@/lib/nav/back-history";
import {
  Search,
  Shield,
  Bell,
  CheckCircle,
  Edit2,
  Trash2,
  X,
  Save,
  UserCheck,
  Ban,
  ShieldOff,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { MobileTopActions } from "@/components/shared/mobile-top-actions";
import { getDirectoryTokens } from "./shared";
import { DirectorySkillsPicker } from "./directory-skills-picker";
import { CountrySelect, StateField } from "@/components/shared/location-select";

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
  // Member location (shared location standard — plain names).
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

type FilterKey = "All" | "Claimed" | "Unclaimed";
const FILTERS: FilterKey[] = ["All", "Claimed", "Unclaimed"];

type EditForm = {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  profileUrl: string;
  skillIds: string[];
  city: string;
  state: string;
  country: string;
};

type TaxonomyOption = { id: string; name: string };
type JobTitleOption = { id: string; name: string; sectorId: string };
type SkillOption = { id: string; name: string; jobTitleId: string };

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
    skillIds: (p.skills ?? []).map((s) => s.id),
    city: p.city ?? "",
    state: p.state ?? "",
    country: p.country ?? "",
  };
}

export function DirectoryAdminShell({ currentUserId }: { currentUserId: string }) {
  const { theme } = useTheme();
  const pickerTokens = getDirectoryTokens(theme);
  const [profiles, setProfiles] = useState<AdminDirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("All");
  const [query, setQuery] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>({ firstName: "", lastName: "", headline: "", bio: "", profileUrl: "", skillIds: [], city: "", state: "", country: "" });
  const [assignInput, setAssignInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerNotice, setDrawerNotice] = useState<string | null>(null);
  // Full taxonomy option lists backing the skills picker in the edit drawer (same lists the member
  // self-edit form loads; the picker groups them by sector/profession client-side).
  const [sectors, setSectors] = useState<TaxonomyOption[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleOption[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);

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

  // Load the taxonomy once for the skills picker. A failed fetch leaves the lists empty; the picker
  // shows its unavailable note and existing picks are preserved on save.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [sectorsRes, jobTitlesRes, skillsRes] = await Promise.all([
          fetch("/api/directory/sectors"),
          fetch("/api/directory/job-titles"),
          fetch("/api/directory/skills"),
        ]);
        if (!active) return;
        const sectorsData = sectorsRes.ok ? ((await sectorsRes.json()) as { items?: TaxonomyOption[] }) : { items: [] };
        const jobTitlesData = jobTitlesRes.ok ? ((await jobTitlesRes.json()) as { items?: JobTitleOption[] }) : { items: [] };
        const skillsData = skillsRes.ok ? ((await skillsRes.json()) as { items?: SkillOption[] }) : { items: [] };
        if (!active) return;
        setSectors(sectorsData.items ?? []);
        setJobTitles(jobTitlesData.items ?? []);
        setSkills(skillsData.items ?? []);
      } catch {
        // Leave the lists empty.
      } finally {
        if (active) setTaxonomyLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
    // First name and country are required (city/state stay optional); the server rejects a blank
    // country too, so guard here for a clear message instead of a generic "invalid payload".
    if (form.firstName.trim().length === 0) {
      setDrawerError("First name is required.");
      return;
    }
    if (form.country.trim().length === 0) {
      setDrawerError("Country is required.");
      return;
    }
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
          // Preserve the sector/job-title classification so an edit here does not
          // wipe it; skills are editable through the picker in this drawer.
          sectorId: editing.sectorId,
          jobTitleId: editing.jobTitleId,
          skillIds: form.skillIds,
          // Location is editable here; an emptied field clears the stored value.
          city: form.city.trim(),
          state: form.state.trim(),
          country: form.country.trim(),
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

  // Take down a community-generated profile at the person's request. Unlike delete (for
  // duplicates/accidents), this also blocks the profile's Quora URL from being listed again until an
  // admin lifts the block. A reason is required and recorded in the audit trail.
  async function handleTakedown(p: AdminDirectoryProfile) {
    if (p.claimedByUserId != null || p.source !== "community-generated") return;
    const name = fullName(p) || "this profile";
    const reason = window.prompt(
      `Remove ${name} at the person's request?\n\nThis deletes the profile AND blocks its Quora URL from being listed in the directory again until an admin lifts the block. This is different from a regular delete (duplicate/accidental), which does not block re-adding.\n\nEnter a reason (recorded in the audit trail):`,
    );
    if (reason === null) return;
    if (reason.trim().length === 0) {
      window.alert("A reason is required to take down a profile.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/directory/admin/profiles/${p.id}/takedown`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        setProfiles((prev) => prev.filter((x) => x.id !== p.id));
        if (editId === p.id) closeDrawer();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      window.alert(body.message ?? "Could not take down this profile.");
    } catch {
      window.alert("Could not take down this profile.");
    } finally {
      setSaving(false);
    }
  }

  // ── Shared edit drawer body ───────────────────────────────────────────────
  const fields: { label: string; key: Exclude<keyof EditForm, "skillIds">; placeholder: string }[] = [
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

        {/* Location — shared Country/State controls (lib/geo/locations.ts), same standard as the
            member self-edit form: Country dropdown; US-state dropdown or free-text region. */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Country <span style={{ color: COLOR }}>(required)</span></div>
          <CountrySelect
            value={form.country}
            onChange={(country) => setForm((f) => ({ ...f, country }))}
            style={{ width: "100%", padding: "8px 11px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
          />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>State / Region</div>
          <StateField
            country={form.country}
            value={form.state}
            onChange={(state) => setForm((f) => ({ ...f, state }))}
            style={{ width: "100%", padding: "8px 11px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: SUBTLE, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>City</div>
          <input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="City"
            disabled={saving}
            style={{ width: "100%", padding: "8px 11px", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Skills use the same structured picker as the member self-edit form and SkillsHunt.
            Free-text proposed skills are member-owned, so the picker's proposed section is omitted
            (the admin update contract has no proposedSkills). */}
        <DirectorySkillsPicker
          tokens={pickerTokens}
          sectors={sectors}
          jobTitles={jobTitles}
          skills={skills}
          loading={taxonomyLoading}
          selectedSkillIds={form.skillIds}
          onToggleSkill={(id) =>
            setForm((f) => ({
              ...f,
              skillIds: f.skillIds.includes(id) ? f.skillIds.filter((s) => s !== id) : [...f.skillIds, id],
            }))
          }
          onAddOccupationSkills={(ids) =>
            setForm((f) => {
              const merged = [...f.skillIds];
              for (const id of ids) {
                if (!merged.includes(id)) merged.push(id);
              }
              return { ...f, skillIds: merged };
            })
          }
        />

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
            <BackChevronButton accent={COLOR} />
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${COLOR}20`, border: `1px solid ${COLOR}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={16} color={COLOR} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Directory Admin</div>
              <div style={{ fontSize: 11, color: SUBTLE }}>{profiles.length} profiles · {unclaimedCount} unclaimed</div>
            </div>
            <PluginUserShellButton href="/apps/directory" accent={COLOR} />
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
                      {p.claimedByUserId == null && p.source === "community-generated" && (
                        <button onClick={() => void handleTakedown(p)} disabled={saving} aria-label="Remove at person's request" title="Remove at the person's request (blocks the Quora URL from being re-added)" style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Ban size={13} />
                        </button>
                      )}
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
          <SuppressionPanel />
        </div>
      </div>
    );
}

// One row of the Quora-URL suppression list (GET /api/directory/admin/suppressed-urls).
interface SuppressedUrlItem {
  id: string;
  normalizedUrl: string;
  originalUrl: string;
  reason: string;
  removedProfileId: string | null;
  createdByUserId: string;
  createdAtIso: string;
  isOverridden: boolean;
  overriddenByUserId: string | null;
  overriddenAtIso: string | null;
  overrideReason: string | null;
}

// Collapsible admin panel listing Quora URLs taken down at the person's request. Active blocks show
// an "Allow again" (override) action that lifts the block with a reason; lifted entries stay visible
// (muted) as a record. Loads its list lazily on first expand.
function SuppressionPanel() {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<SuppressedUrlItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/directory/admin/suppressed-urls");
      if (!res.ok) {
        setErr("Could not load the takedown list.");
        return;
      }
      const data = (await res.json()) as { items?: SuppressedUrlItem[] };
      setItems(data.items ?? []);
    } catch {
      setErr("Could not load the takedown list.");
    } finally {
      setLoading(false);
    }
  }, []);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && items === null) void loadList();
  }

  async function override(item: SuppressedUrlItem) {
    const reason = window.prompt(
      `Allow "${item.originalUrl}" to be listed in the directory again?\n\nThis lifts the block set when the profile was taken down. Enter a reason (recorded in the audit trail):`,
    );
    if (reason === null) return;
    if (reason.trim().length === 0) {
      window.alert("A reason is required to lift a suppression.");
      return;
    }
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/directory/admin/suppressed-urls/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        void loadList();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      window.alert(body.message ?? "Could not lift the suppression.");
    } catch {
      window.alert("Could not lift the suppression.");
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = items?.filter((i) => !i.isOverridden).length ?? 0;

  return (
    <div style={{ margin: "16px", borderRadius: 12, border: `1px solid ${BORDER}`, background: "#0D0F14" }}>
      <button
        onClick={toggle}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "transparent", border: "none", color: TEXT, cursor: "pointer", textAlign: "left" }}
      >
        <ShieldOff size={15} color="#F59E0B" />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Taken-down Quora URLs</span>
        {items !== null && activeCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "1px 6px" }}>{activeCount} blocked</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: SUBTLE }}>{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.5, marginBottom: 10 }}>
            A URL here was removed at the person&rsquo;s request and cannot be listed in the directory again
            (auto-generated from a SkillsHunt accept, or added by an admin) until you lift the block.
          </div>
          {loading ? (
            <div style={{ padding: 16, textAlign: "center", color: SUBTLE, fontSize: 12 }}>Loading…</div>
          ) : err ? (
            <div style={{ padding: 16, textAlign: "center", color: "#EF4444", fontSize: 12 }}>{err}</div>
          ) : (items?.length ?? 0) === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: SUBTLE, fontSize: 12 }}>No taken-down URLs.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(items ?? []).map((item) => (
                <div key={item.id} style={{ padding: 10, borderRadius: 9, background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, opacity: item.isOverridden ? 0.6 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontFamily: "monospace", color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.originalUrl}</span>
                    {item.isOverridden ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#22C55E", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 4, padding: "1px 6px" }}>Lifted</span>
                    ) : (
                      <button
                        onClick={() => void override(item)}
                        disabled={busyId === item.id}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: COLOR, fontSize: 11, fontWeight: 600, cursor: busyId === item.id ? "not-allowed" : "pointer", flexShrink: 0 }}
                      >
                        <RotateCcw size={11} /> Allow again
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: SUBTLE }}>Reason: {item.reason || "—"}</div>
                  {item.isOverridden && item.overrideReason && (
                    <div style={{ fontSize: 11, color: SUBTLE, marginTop: 2 }}>Lifted: {item.overrideReason}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
