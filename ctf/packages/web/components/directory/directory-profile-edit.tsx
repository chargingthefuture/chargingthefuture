"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getDirectoryTokens } from "./shared";
import { useTheme } from "@/hooks/useTheme";

// The full editable shape of a directory profile. GET /api/directory/profile returns the
// caller's own profile with the taxonomy IDs (sectorId, jobTitleId, skills[].id) needed to
// round-trip the selectors. PUT /api/directory/profile is a FULL upsert: any omitted field is
// reset to null/'' by toProfileInput on the server, so this form loads every field, lets the
// member edit it, and always submits the COMPLETE set — edited and unchanged alike — so a save
// can never blank out a field the member did not touch.
type OwnProfile = {
  firstName: string;
  lastName: string | null;
  headline: string | null;
  bio: string | null;
  profileUrl: string | null;
  sectorId: string | null;
  jobTitleId: string | null;
  skills: Array<{ id: string; name: string; displayOrder: number }>;
  venmoAddress?: string | null;
  moneroAddress?: string | null;
  bitcoinAddress?: string | null;
  serviceCreditsAddress?: string | null;
};

type TaxonomyOption = { id: string; name: string };
type JobTitleOption = { id: string; name: string; sectorId: string };
type SkillOption = { id: string; name: string; jobTitleId: string };

// The form's working copy. Strings are used in the controlled inputs; on submit they are
// converted back to the null/string[] shape the upsert expects.
type FormState = {
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  profileUrl: string;
  sectorId: string;
  jobTitleId: string;
  skillIds: string[];
  venmoAddress: string;
  moneroAddress: string;
  bitcoinAddress: string;
  serviceCreditsAddress: string;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

function emptyForm(): FormState {
  return {
    firstName: "",
    lastName: "",
    headline: "",
    bio: "",
    profileUrl: "",
    sectorId: "",
    jobTitleId: "",
    skillIds: [],
    venmoAddress: "",
    moneroAddress: "",
    bitcoinAddress: "",
    serviceCreditsAddress: "",
  };
}

// Trim a free-text field; an empty string becomes null so the server stores NULL rather than ''.
function nullableTrim(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function DirectoryProfileEdit({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const t = getDirectoryTokens(theme);

  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [sectors, setSectors] = useState<TaxonomyOption[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleOption[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load the current profile plus the taxonomy option lists. Skills load unfiltered so the
  // profile's existing skill IDs always resolve to names regardless of their job title.
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoadState({ kind: "loading" });
      try {
        const [profileRes, sectorsRes, skillsRes] = await Promise.all([
          fetch("/api/directory/profile", { signal: controller.signal }),
          fetch("/api/directory/sectors", { signal: controller.signal }),
          fetch("/api/directory/skills", { signal: controller.signal }),
        ]);

        if (controller.signal.aborted) return;

        if (!profileRes.ok) {
          setLoadState({ kind: "error", message: "Could not load your profile. Please try again." });
          return;
        }

        const profileData = (await profileRes.json()) as { profile?: OwnProfile | null };
        const sectorsData = sectorsRes.ok ? ((await sectorsRes.json()) as { items?: TaxonomyOption[] }) : { items: [] };
        const skillsData = skillsRes.ok ? ((await skillsRes.json()) as { items?: SkillOption[] }) : { items: [] };

        if (controller.signal.aborted) return;

        setSectors(sectorsData.items ?? []);
        setSkills(skillsData.items ?? []);

        const p = profileData.profile ?? null;
        const sectorId = p?.sectorId ?? "";

        // Load the job titles for the profile's sector so the dropdown can show the current pick.
        if (sectorId) {
          try {
            const jtRes = await fetch(`/api/directory/job-titles?sectorId=${encodeURIComponent(sectorId)}`, {
              signal: controller.signal,
            });
            if (jtRes.ok && !controller.signal.aborted) {
              const jtData = (await jtRes.json()) as { items?: JobTitleOption[] };
              setJobTitles(jtData.items ?? []);
            }
          } catch {
            // Leave job titles empty; the current value is still preserved on save.
          }
        }

        if (controller.signal.aborted) return;

        setForm({
          firstName: p?.firstName ?? "",
          lastName: p?.lastName ?? "",
          headline: p?.headline ?? "",
          bio: p?.bio ?? "",
          profileUrl: p?.profileUrl ?? "",
          sectorId,
          jobTitleId: p?.jobTitleId ?? "",
          skillIds: (p?.skills ?? []).map((s) => s.id),
          venmoAddress: p?.venmoAddress ?? "",
          moneroAddress: p?.moneroAddress ?? "",
          bitcoinAddress: p?.bitcoinAddress ?? "",
          serviceCreditsAddress: p?.serviceCreditsAddress ?? "",
        });
        setLoadState({ kind: "ready" });
      } catch {
        if (!controller.signal.aborted) {
          setLoadState({ kind: "error", message: "Could not load your profile. Please try again." });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  // When the member changes sector, refresh the job-title options and clear a now-invalid pick.
  async function handleSectorChange(nextSectorId: string) {
    setForm((prev) => ({ ...prev, sectorId: nextSectorId, jobTitleId: "" }));
    setJobTitles([]);
    if (!nextSectorId) return;
    try {
      const res = await fetch(`/api/directory/job-titles?sectorId=${encodeURIComponent(nextSectorId)}`);
      if (res.ok) {
        const data = (await res.json()) as { items?: JobTitleOption[] };
        setJobTitles(data.items ?? []);
      }
    } catch {
      // Leave job titles empty.
    }
  }

  function toggleSkill(id: string) {
    setForm((prev) => ({
      ...prev,
      skillIds: prev.skillIds.includes(id)
        ? prev.skillIds.filter((s) => s !== id)
        : [...prev.skillIds, id],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    // Build the COMPLETE upsert payload: every field the server's toProfileInput reads, including
    // the ones not edited, so the full-upsert can never wipe an unshown value.
    const payload = {
      firstName: form.firstName.trim(),
      lastName: nullableTrim(form.lastName),
      headline: nullableTrim(form.headline),
      bio: nullableTrim(form.bio),
      profileUrl: nullableTrim(form.profileUrl),
      sectorId: form.sectorId.trim().length > 0 ? form.sectorId : null,
      jobTitleId: form.jobTitleId.trim().length > 0 ? form.jobTitleId : null,
      skillIds: form.skillIds,
      venmoAddress: nullableTrim(form.venmoAddress),
      moneroAddress: nullableTrim(form.moneroAddress),
      bitcoinAddress: nullableTrim(form.bitcoinAddress),
      serviceCreditsAddress: nullableTrim(form.serviceCreditsAddress),
    };

    try {
      const res = await fetch("/api/directory/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (res.ok && body.ok !== false) {
        onSaved();
        return;
      }
      setSaveError(body.message ?? "Could not save your profile. Please try again.");
    } catch {
      setSaveError("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const labelStyle = { fontSize: 12, fontWeight: 700, color: t.MUTED, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6, display: "block" };
  const inputStyle = { width: "100%", padding: "9px 12px", background: t.INPUT_BG, border: `1px solid ${t.BORDER_HI}`, borderRadius: 8, fontSize: 13, color: t.TEXT, outline: "none", boxSizing: "border-box" as const };
  const fieldGap = { marginBottom: 18 };
  const canSave = form.firstName.trim().length > 0 && !saving;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit your directory profile"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "32px 16px", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, background: t.HEADER, border: `1px solid ${t.BORDER_HI}`, borderRadius: 16, color: t.TEXT, boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
      >
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.TITLE }}>Edit my profile</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.04)", border: `1px solid ${t.BORDER}`, color: t.MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={18} />
          </button>
        </header>

        <div style={{ padding: 20 }}>
          {loadState.kind === "loading" && (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: t.MUTED }}>Loading your profile…</div>
          )}

          {loadState.kind === "error" && (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#EF4444", marginBottom: 14 }}>{loadState.message}</div>
              <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Close</button>
            </div>
          )}

          {loadState.kind === "ready" && (
            <>
              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-first">First name</label>
                <input id="dpe-first" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} style={inputStyle} placeholder="First name" />
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-last">Last name</label>
                <input id="dpe-last" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} style={inputStyle} placeholder="Last name" />
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-headline">Headline</label>
                <input id="dpe-headline" value={form.headline} onChange={(e) => setForm((p) => ({ ...p, headline: e.target.value }))} style={inputStyle} placeholder="A short line about what you do" />
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-bio">About</label>
                <textarea id="dpe-bio" value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} placeholder="Tell members about your work" />
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-url">Quora profile URL</label>
                <input id="dpe-url" value={form.profileUrl} onChange={(e) => setForm((p) => ({ ...p, profileUrl: e.target.value }))} style={inputStyle} placeholder="https://www.quora.com/profile/…" />
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-sector">Sector</label>
                <select id="dpe-sector" value={form.sectorId} onChange={(e) => { void handleSectorChange(e.target.value); }} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Not set</option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-jobtitle">Job title</label>
                <select id="dpe-jobtitle" value={form.jobTitleId} onChange={(e) => setForm((p) => ({ ...p, jobTitleId: e.target.value }))} disabled={!form.sectorId} style={{ ...inputStyle, cursor: form.sectorId ? "pointer" : "not-allowed", opacity: form.sectorId ? 1 : 0.6 }}>
                  <option value="">{form.sectorId ? "Not set" : "Choose a sector first"}</option>
                  {jobTitles.map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </select>
              </div>

              <div style={fieldGap}>
                <label style={labelStyle}>Specializations</label>
                {skills.length === 0 ? (
                  <div style={{ fontSize: 12, color: t.FAINT }}>No skills available to select.</div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxHeight: 180, overflowY: "auto", padding: 2 }}>
                    {skills.map((s) => {
                      const active = form.skillIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSkill(s.id)}
                          aria-pressed={active}
                          style={{
                            padding: "5px 12px", borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: "pointer",
                            background: active ? `${t.ACCENT}20` : "transparent",
                            border: `1px solid ${active ? `${t.ACCENT}50` : t.BORDER_HI}`,
                            color: active ? t.ACCENT : t.SUBTLE,
                          }}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ margin: "8px 0 14px", fontSize: 12, fontWeight: 700, color: t.MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>Payment addresses</div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-venmo">Venmo</label>
                <input id="dpe-venmo" value={form.venmoAddress} onChange={(e) => setForm((p) => ({ ...p, venmoAddress: e.target.value }))} style={inputStyle} placeholder="@your-venmo" />
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-monero">Monero</label>
                <input id="dpe-monero" value={form.moneroAddress} onChange={(e) => setForm((p) => ({ ...p, moneroAddress: e.target.value }))} style={inputStyle} placeholder="Monero address" />
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-bitcoin">Bitcoin</label>
                <input id="dpe-bitcoin" value={form.bitcoinAddress} onChange={(e) => setForm((p) => ({ ...p, bitcoinAddress: e.target.value }))} style={inputStyle} placeholder="Bitcoin address" />
              </div>

              <div style={{ marginBottom: 4 }}>
                <label style={labelStyle} htmlFor="dpe-credits">ServiceCredits</label>
                <input id="dpe-credits" value={form.serviceCreditsAddress} onChange={(e) => setForm((p) => ({ ...p, serviceCreditsAddress: e.target.value }))} style={inputStyle} placeholder="ServiceCredits address" />
              </div>

              {saveError && <div style={{ marginTop: 14, fontSize: 13, color: "#EF4444" }}>{saveError}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  style={{ padding: "10px 18px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: `1px solid ${t.BORDER_HI}`, color: t.SUBTLE, fontWeight: 600, fontSize: 13, cursor: saving ? "not-allowed" : "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSave(); }}
                  disabled={!canSave}
                  style={{ padding: "10px 22px", borderRadius: 9, background: t.ACCENT, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.5 }}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
