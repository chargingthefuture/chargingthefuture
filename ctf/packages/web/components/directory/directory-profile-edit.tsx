"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getDirectoryTokens } from "./shared";
import { DirectorySkillsPicker } from "./directory-skills-picker";
import { CountrySelect, StateField } from "@/components/shared/location-select";
import { useTheme } from "@/hooks/useTheme";
import { DIRECTORY_MAX_PROPOSED_SKILL_LENGTH, DIRECTORY_MAX_PROPOSED_SKILLS } from "@/lib/directory/constants";

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
  // Free-text "skill not listed" labels the member added themselves; round-tripped so they can be
  // edited or removed. Absent on profiles created before this field existed (defaults to []).
  proposedSkills?: string[];
  venmoAddress?: string | null;
  moneroAddress?: string | null;
  bitcoinAddress?: string | null;
  serviceCreditsAddress?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
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
  proposedSkills: string[];
  venmoAddress: string;
  moneroAddress: string;
  bitcoinAddress: string;
  serviceCreditsAddress: string;
  city: string;
  state: string;
  country: string;
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
    proposedSkills: [],
    venmoAddress: "",
    moneroAddress: "",
    bitcoinAddress: "",
    serviceCreditsAddress: "",
    city: "",
    state: "",
    country: "",
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
  // A non-error notice shown when the Quora URL couldn't be emptied and the previous one was kept.
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  // Whether the caller already had a profile when the form loaded. Drives create-vs-edit wording; the
  // PUT upsert behaves the same either way.
  const [hadProfile, setHadProfile] = useState(false);
  // Draft text for the "skill not listed" box, before it is committed to form.proposedSkills.
  const [proposedInput, setProposedInput] = useState("");

  // Load the current profile plus the full taxonomy option lists in one shot. Sectors, job titles,
  // and skills all load unfiltered so the skills picker can group every skill by sector (the
  // accordion) and by profession (the prefill shortcut), and so the profile's existing skill IDs
  // always resolve to names regardless of their job title.
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoadState({ kind: "loading" });
      try {
        const [profileRes, sectorsRes, jobTitlesRes, skillsRes] = await Promise.all([
          fetch("/api/directory/profile", { signal: controller.signal }),
          fetch("/api/directory/sectors", { signal: controller.signal }),
          fetch("/api/directory/job-titles", { signal: controller.signal }),
          fetch("/api/directory/skills", { signal: controller.signal }),
        ]);

        if (controller.signal.aborted) return;

        if (!profileRes.ok) {
          setLoadState({ kind: "error", message: "Could not load your profile. Please try again." });
          return;
        }

        const profileData = (await profileRes.json()) as { profile?: OwnProfile | null };
        const sectorsData = sectorsRes.ok ? ((await sectorsRes.json()) as { items?: TaxonomyOption[] }) : { items: [] };
        const jobTitlesData = jobTitlesRes.ok ? ((await jobTitlesRes.json()) as { items?: JobTitleOption[] }) : { items: [] };
        const skillsData = skillsRes.ok ? ((await skillsRes.json()) as { items?: SkillOption[] }) : { items: [] };

        if (controller.signal.aborted) return;

        setSectors(sectorsData.items ?? []);
        setJobTitles(jobTitlesData.items ?? []);
        setSkills(skillsData.items ?? []);

        const p = profileData.profile ?? null;
        setHadProfile(Boolean(p));
        const sectorId = p?.sectorId ?? "";

        setForm({
          firstName: p?.firstName ?? "",
          lastName: p?.lastName ?? "",
          headline: p?.headline ?? "",
          bio: p?.bio ?? "",
          profileUrl: p?.profileUrl ?? "",
          sectorId,
          jobTitleId: p?.jobTitleId ?? "",
          skillIds: (p?.skills ?? []).map((s) => s.id),
          proposedSkills: p?.proposedSkills ?? [],
          venmoAddress: p?.venmoAddress ?? "",
          moneroAddress: p?.moneroAddress ?? "",
          bitcoinAddress: p?.bitcoinAddress ?? "",
          serviceCreditsAddress: p?.serviceCreditsAddress ?? "",
          city: p?.city ?? "",
          state: p?.state ?? "",
          country: p?.country ?? "",
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

  // Sector and job title are independent, optional selectors (a member can pick a sector, a job
  // title, either, or neither). Changing the sector clears a job title that belongs to a different
  // sector so the two never contradict each other; picking a job title under the same sector is
  // preserved.
  function handleSectorChange(nextSectorId: string) {
    setForm((prev) => {
      const jt = jobTitles.find((j) => j.id === prev.jobTitleId);
      const keepJobTitle = jt && jt.sectorId === nextSectorId;
      return { ...prev, sectorId: nextSectorId, jobTitleId: keepJobTitle ? prev.jobTitleId : "" };
    });
  }

  // Job titles map to a sector, so choosing a job title fills in its sector — the member never has
  // to choose a sector first. Clearing the job title leaves the sector as-is.
  function handleJobTitleChange(nextJobTitleId: string) {
    setForm((prev) => {
      if (!nextJobTitleId) return { ...prev, jobTitleId: "" };
      const jt = jobTitles.find((j) => j.id === nextJobTitleId);
      return { ...prev, jobTitleId: nextJobTitleId, sectorId: jt ? jt.sectorId : prev.sectorId };
    });
  }

  function toggleSkill(id: string) {
    setForm((prev) => ({
      ...prev,
      skillIds: prev.skillIds.includes(id)
        ? prev.skillIds.filter((s) => s !== id)
        : [...prev.skillIds, id],
    }));
  }

  // Prefill shortcut: add every skill of a chosen profession, skipping any already selected.
  function addOccupationSkills(ids: string[]) {
    setForm((prev) => {
      const merged = [...prev.skillIds];
      for (const id of ids) {
        if (!merged.includes(id)) merged.push(id);
      }
      return { ...prev, skillIds: merged };
    });
  }

  // Commit the "skill not listed" draft as a free-text proposed skill. Skips blanks, anything past
  // the count cap, and labels that duplicate an existing entry or an already-selected taxonomy skill.
  function addProposedSkill() {
    const label = proposedInput.trim().replace(/\s+/g, " ").slice(0, DIRECTORY_MAX_PROPOSED_SKILL_LENGTH);
    if (label.length === 0) return;
    const lower = label.toLowerCase();
    setForm((prev) => {
      if (prev.proposedSkills.length >= DIRECTORY_MAX_PROPOSED_SKILLS) return prev;
      if (prev.proposedSkills.some((s) => s.toLowerCase() === lower)) return prev;
      if (skills.some((s) => prev.skillIds.includes(s.id) && s.name.toLowerCase() === lower)) return prev;
      return { ...prev, proposedSkills: [...prev.proposedSkills, label] };
    });
    setProposedInput("");
  }

  function removeProposedSkill(label: string) {
    setForm((prev) => ({ ...prev, proposedSkills: prev.proposedSkills.filter((s) => s !== label) }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);

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
      proposedSkills: form.proposedSkills,
      venmoAddress: nullableTrim(form.venmoAddress),
      moneroAddress: nullableTrim(form.moneroAddress),
      bitcoinAddress: nullableTrim(form.bitcoinAddress),
      serviceCreditsAddress: nullableTrim(form.serviceCreditsAddress),
      city: nullableTrim(form.city),
      state: nullableTrim(form.state),
      country: nullableTrim(form.country),
    };

    try {
      const res = await fetch("/api/directory/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        quoraUrlKept?: boolean;
        profile?: { profileUrl?: string | null };
      };
      if (res.ok && body.ok !== false) {
        if (body.quoraUrlKept) {
          // The submitted Quora URL was empty/invalid, so the previous one was kept (it can't be
          // removed). Sync the field to the kept URL and keep the editor open so the member can enter a
          // valid new Quora link if they meant to change it — the rest of their edits already saved.
          if (typeof body.profile?.profileUrl === "string") {
            const keptUrl = body.profile.profileUrl;
            setForm((p) => ({ ...p, profileUrl: keptUrl }));
          }
          setSaveNotice("Your Quora profile URL can’t be removed — your previous link was kept. To change it, enter a new valid Quora profile URL and save again.");
          return;
        }
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
  // At least one skill is required — a taxonomy skill or a free-text proposed one.
  const hasSkill = form.skillIds.length > 0 || form.proposedSkills.length > 0;
  // First name, country, and at least one skill are required (city/state/sector/job title stay
  // optional). All three gate Save so a member cannot save an incomplete profile.
  const canSave = form.firstName.trim().length > 0 && form.country.trim().length > 0 && hasSkill && !saving;

  // Every job title, grouped by its sector, so the job-title dropdown lists them all (via <optgroup>)
  // without the member having to pick a sector first — the two selectors are independent.
  const jobTitlesBySector = useMemo(() => {
    const sectorNameById = new Map(sectors.map((s) => [s.id, s.name] as const));
    const bySector = new Map<string, JobTitleOption[]>();
    for (const j of jobTitles) {
      const arr = bySector.get(j.sectorId) ?? [];
      arr.push(j);
      bySector.set(j.sectorId, arr);
    }
    return [...bySector.entries()]
      .map(([sectorId, list]) => ({
        sectorId,
        sectorName: sectorNameById.get(sectorId) ?? "Other",
        titles: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.sectorName.localeCompare(b.sectorName));
  }, [sectors, jobTitles]);

  // Close on Escape so keyboard users have the same "dismiss" the backdrop click gives mouse users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a mouse convenience; keyboard users close via Escape (handler above) or the visible close button.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit your directory profile"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "32px 16px", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div
        style={{ width: "100%", maxWidth: 560, background: t.HEADER, border: `1px solid ${t.BORDER_HI}`, borderRadius: 16, color: t.TEXT, boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}
      >
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${t.BORDER}` }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.TITLE }}>{hadProfile ? "Edit my profile" : "Create my profile"}</div>
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
                <label style={labelStyle} htmlFor="dpe-url">Quora profile URL <span style={{ color: t.ACCENT }}>(required)</span></label>
                <input id="dpe-url" value={form.profileUrl} onChange={(e) => setForm((p) => ({ ...p, profileUrl: e.target.value }))} style={inputStyle} placeholder="https://www.quora.com/profile/…" />
                <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 6, lineHeight: 1.5 }}>
                  Your Quora profile is the community&rsquo;s social proof, so it can&rsquo;t be removed. If your Quora
                  account changed, just paste your new profile link here — the previous one is kept until you replace
                  it with a valid Quora URL.
                </div>
                {saveNotice ? (
                  <div style={{ fontSize: 12, color: t.ACCENT, marginTop: 6, lineHeight: 1.5 }}>{saveNotice}</div>
                ) : null}
              </div>

              {/* Location — shared Country/State controls (lib/geo/locations.ts) so the data stays
                  clean: Country is a dropdown, State is a US-state dropdown for the United States
                  and a free-text region box for every other country. */}
              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-country">Country <span style={{ color: t.ACCENT }}>(required)</span></label>
                <CountrySelect
                  id="dpe-country"
                  value={form.country}
                  onChange={(country) => setForm((p) => ({ ...p, country }))}
                  style={{ ...inputStyle, cursor: "pointer" }}
                />
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-state">State / Region</label>
                <StateField
                  id="dpe-state"
                  country={form.country}
                  value={form.state}
                  onChange={(state) => setForm((p) => ({ ...p, state }))}
                  style={inputStyle}
                />
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-city">City</label>
                <input id="dpe-city" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} style={inputStyle} placeholder="City" />
              </div>

              {/* Sector and job title are optional and independent — pick a sector, a job title,
                  either, or neither. Job titles are mapped to sectors, so choosing a job title fills
                  in its sector automatically; there is no "choose a sector first" requirement. */}
              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-sector">Sector <span style={{ color: t.SUBTLE, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                <select id="dpe-sector" value={form.sectorId} onChange={(e) => handleSectorChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Not set</option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={fieldGap}>
                <label style={labelStyle} htmlFor="dpe-jobtitle">Job title <span style={{ color: t.SUBTLE, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                <select id="dpe-jobtitle" value={form.jobTitleId} onChange={(e) => handleJobTitleChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Not set</option>
                  {jobTitlesBySector.map((group) => (
                    <optgroup key={group.sectorId} label={group.sectorName}>
                      {group.titles.map((j) => (
                        <option key={j.id} value={j.id}>{j.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: t.SUBTLE, marginTop: 6, lineHeight: 1.5 }}>Choosing a job title fills in its sector for you. Both are optional.</div>
              </div>

              <div style={fieldGap}>
                <DirectorySkillsPicker
                  tokens={t}
                  sectors={sectors}
                  jobTitles={jobTitles}
                  skills={skills}
                  loading={false}
                  selectedSkillIds={form.skillIds}
                  proposedSkills={form.proposedSkills}
                  proposedInput={proposedInput}
                  onToggleSkill={toggleSkill}
                  onAddOccupationSkills={addOccupationSkills}
                  onProposedInputChange={setProposedInput}
                  onAddProposed={addProposedSkill}
                  onRemoveProposed={removeProposedSkill}
                />
                {!hasSkill && (
                  <div style={{ fontSize: 12, color: t.ACCENT, marginTop: 8, lineHeight: 1.5 }}>Choose at least one skill to save your profile.</div>
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
                  {saving ? "Saving…" : hadProfile ? "Save changes" : "Create profile"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
