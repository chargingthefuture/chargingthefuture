"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import { getDirectoryTokens, type DirectoryTokens } from "./shared";
import { DirectorySkillsPicker } from "./directory-skills-picker";
import { CountrySelect, StateField } from "@/components/shared/location-select";
import { useTheme } from "@/hooks/useTheme";
import { DIRECTORY_MAX_PROPOSED_SKILL_LENGTH, DIRECTORY_MAX_PROPOSED_SKILLS } from "@/lib/directory/constants";
import { failureText } from 'lib/errors/client-failure';

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

// One sector's group of job titles, used to build the job-title dropdown's <optgroup> list.
type JobTitleGroup = { sectorId: string; sectorName: string; titles: JobTitleOption[] };

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

// What loadProfileData resolves to. `ok` is false only when the profile fetch itself failed; the
// taxonomy lists still round-trip (empty on their own failures) so the form can degrade gracefully.
type LoadedProfileData = {
  ok: boolean;
  sectors: TaxonomyOption[];
  jobTitles: JobTitleOption[];
  skills: SkillOption[];
  profile: OwnProfile | null;
};

const LOAD_ERROR_MESSAGE = "Could not load your profile. Please try again.";

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

// A taxonomy ID field submits its value only when non-empty; otherwise null (the selector is unset).
function nullableId(value: string): string | null {
  return value.trim().length > 0 ? value : null;
}

// Coalesce a nullable string to '' for a controlled input, keeping the mapping helper branch-free.
function orEmpty(value: string | null | undefined): string {
  return value ?? "";
}

// Read a taxonomy list response ({ items: T[] }), falling back to [] when the request failed or the
// body omitted items — matches the original per-list "ok ? json : { items: [] }" behavior.
async function parseItems<T>(res: Response): Promise<T[]> {
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: T[] };
  return data.items ?? [];
}

// Map a loaded profile (or null, for a member with no profile yet) into the form's working copy.
function profileToForm(p: OwnProfile | null): FormState {
  if (!p) return emptyForm();
  return {
    firstName: p.firstName,
    lastName: orEmpty(p.lastName),
    headline: orEmpty(p.headline),
    bio: orEmpty(p.bio),
    profileUrl: orEmpty(p.profileUrl),
    sectorId: orEmpty(p.sectorId),
    jobTitleId: orEmpty(p.jobTitleId),
    skillIds: (p.skills ?? []).map((s) => s.id),
    proposedSkills: p.proposedSkills ?? [],
    venmoAddress: orEmpty(p.venmoAddress),
    moneroAddress: orEmpty(p.moneroAddress),
    bitcoinAddress: orEmpty(p.bitcoinAddress),
    serviceCreditsAddress: orEmpty(p.serviceCreditsAddress),
    city: orEmpty(p.city),
    state: orEmpty(p.state),
    country: orEmpty(p.country),
  };
}

// Fetch the current profile plus the full taxonomy option lists in one shot. Sectors, job titles,
// and skills all load unfiltered so the skills picker can group every skill by sector (the
// accordion) and by profession (the prefill shortcut), and so the profile's existing skill IDs
// always resolve to names regardless of their job title. Returns null when the load was aborted.
async function loadProfileData(signal: AbortSignal): Promise<LoadedProfileData | null> {
  const [profileRes, sectorsRes, jobTitlesRes, skillsRes] = await Promise.all([
    fetch("/api/directory/profile", { signal }),
    fetch("/api/directory/sectors", { signal }),
    fetch("/api/directory/job-titles", { signal }),
    fetch("/api/directory/skills", { signal }),
  ]);

  if (signal.aborted) return null;

  if (!profileRes.ok) {
    return { ok: false, sectors: [], jobTitles: [], skills: [], profile: null };
  }

  const profileData = (await profileRes.json()) as { profile?: OwnProfile | null };
  const sectors = await parseItems<TaxonomyOption>(sectorsRes);
  const jobTitles = await parseItems<JobTitleOption>(jobTitlesRes);
  const skills = await parseItems<SkillOption>(skillsRes);

  return { ok: true, sectors, jobTitles, skills, profile: profileData.profile ?? null };
}

// Build the COMPLETE upsert payload: every field the server's toProfileInput reads, including the
// ones not edited, so the full-upsert can never wipe an unshown value.
function buildProfilePayload(form: FormState) {
  return {
    firstName: form.firstName.trim(),
    lastName: nullableTrim(form.lastName),
    headline: nullableTrim(form.headline),
    bio: nullableTrim(form.bio),
    profileUrl: nullableTrim(form.profileUrl),
    sectorId: nullableId(form.sectorId),
    jobTitleId: nullableId(form.jobTitleId),
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
}

// Every job title, grouped by its sector, so the job-title dropdown lists them all (via <optgroup>)
// without the member having to pick a sector first — the two selectors are independent.
function groupJobTitlesBySector(
  sectors: TaxonomyOption[],
  jobTitles: JobTitleOption[],
): JobTitleGroup[] {
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
}

// At least one skill is required — a taxonomy skill or a free-text proposed one.
function hasAnySkill(form: FormState): boolean {
  return form.skillIds.length > 0 || form.proposedSkills.length > 0;
}

// First name, country, and at least one skill are required (city/state/sector/job title stay
// optional). All three gate Save so a member cannot save an incomplete profile.
function canSaveProfile(form: FormState, saving: boolean): boolean {
  return form.firstName.trim().length > 0 && form.country.trim().length > 0 && hasAnySkill(form) && !saving;
}

// The reused label/input/gap style objects, derived from the theme tokens.
function getEditStyles(t: DirectoryTokens) {
  const labelStyle = { fontSize: 12, fontWeight: 700, color: t.MUTED, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6, display: "block" };
  const inputStyle = { width: "100%", padding: "9px 12px", background: t.INPUT_BG, border: `1px solid ${t.BORDER_HI}`, borderRadius: 8, fontSize: 13, color: t.TEXT, outline: "none", boxSizing: "border-box" as const };
  const fieldGap = { marginBottom: 18 };
  return { labelStyle, inputStyle, fieldGap };
}

type EditStyles = ReturnType<typeof getEditStyles>;

function LoadingView({ t }: { t: DirectoryTokens }) {
  return (
    <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: t.MUTED }}>Loading your profile…</div>
  );
}

function ErrorView({ t, message, onClose }: { t: DirectoryTokens; message: string; onClose: () => void }) {
  return (
    <div style={{ padding: "24px 0", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "#EF4444", marginBottom: 14 }}>{message}</div>
      <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, background: t.ACCENT, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Close</button>
    </div>
  );
}

// The four optional cryptocurrency / payment address inputs. Grouped so the main form body stays
// short; no conditionals of its own.
function PaymentAddressFields({
  t,
  form,
  setForm,
  styles,
}: {
  t: DirectoryTokens;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  styles: EditStyles;
}) {
  const { labelStyle, inputStyle, fieldGap } = styles;
  return (
    <>
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
    </>
  );
}

// The save-error notice plus the Cancel / Save footer buttons.
function ProfileFormFooter({
  t,
  saving,
  canSave,
  hadProfile,
  saveError,
  onClose,
  onSave,
}: {
  t: DirectoryTokens;
  saving: boolean;
  canSave: boolean;
  hadProfile: boolean;
  saveError: string | null;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <>
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
          onClick={onSave}
          disabled={!canSave}
          style={{ padding: "10px 22px", borderRadius: 9, background: t.ACCENT, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.5 }}
        >
          {saving ? "Saving…" : hadProfile ? "Save changes" : "Create profile"}
        </button>
      </div>
    </>
  );
}

// The editable form body, shown once the profile and taxonomy lists have loaded.
function ProfileFormFields({
  t,
  form,
  setForm,
  sectors,
  jobTitles,
  skills,
  jobTitlesBySector,
  proposedInput,
  setProposedInput,
  saveNotice,
  saveError,
  saving,
  hadProfile,
  onClose,
  onSave,
  onSectorChange,
  onJobTitleChange,
  onToggleSkill,
  onAddProposed,
  onRemoveProposed,
}: {
  t: DirectoryTokens;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  sectors: TaxonomyOption[];
  jobTitles: JobTitleOption[];
  skills: SkillOption[];
  jobTitlesBySector: JobTitleGroup[];
  proposedInput: string;
  setProposedInput: Dispatch<SetStateAction<string>>;
  saveNotice: string | null;
  saveError: string | null;
  saving: boolean;
  hadProfile: boolean;
  onClose: () => void;
  onSave: () => void;
  onSectorChange: (nextSectorId: string) => void;
  onJobTitleChange: (nextJobTitleId: string) => void;
  onToggleSkill: (id: string) => void;
  onAddProposed: () => void;
  onRemoveProposed: (label: string) => void;
}) {
  const { labelStyle, inputStyle, fieldGap } = getEditStyles(t);
  const styles: EditStyles = { labelStyle, inputStyle, fieldGap };
  const hasSkill = hasAnySkill(form);
  const canSave = canSaveProfile(form, saving);

  return (
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
        <select id="dpe-sector" value={form.sectorId} onChange={(e) => onSectorChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
          <option value="">Not set</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div style={fieldGap}>
        <label style={labelStyle} htmlFor="dpe-jobtitle">Job title <span style={{ color: t.SUBTLE, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
        <select id="dpe-jobtitle" value={form.jobTitleId} onChange={(e) => onJobTitleChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
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
          onToggleSkill={onToggleSkill}
          onProposedInputChange={setProposedInput}
          onAddProposed={onAddProposed}
          onRemoveProposed={onRemoveProposed}
        />
        {!hasSkill && (
          <div style={{ fontSize: 12, color: t.ACCENT, marginTop: 8, lineHeight: 1.5 }}>Choose at least one skill to save your profile.</div>
        )}
      </div>

      <PaymentAddressFields t={t} form={form} setForm={setForm} styles={styles} />

      <ProfileFormFooter
        t={t}
        saving={saving}
        canSave={canSave}
        hadProfile={hadProfile}
        saveError={saveError}
        onClose={onClose}
        onSave={onSave}
      />
    </>
  );
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

  // Load the current profile plus the full taxonomy option lists (see loadProfileData) on mount.
  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoadState({ kind: "loading" });
      try {
        const data = await loadProfileData(controller.signal);
        if (!data || controller.signal.aborted) return;
        if (!data.ok) {
          setLoadState({ kind: "error", message: LOAD_ERROR_MESSAGE });
          return;
        }
        setSectors(data.sectors);
        setJobTitles(data.jobTitles);
        setSkills(data.skills);
        setHadProfile(Boolean(data.profile));
        setForm(profileToForm(data.profile));
        setLoadState({ kind: "ready" });
      } catch {
        if (!controller.signal.aborted) {
          setLoadState({ kind: "error", message: LOAD_ERROR_MESSAGE });
        }
      }
    }

    void run();
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

    const payload = buildProfilePayload(form);

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
    } catch (caught) {
      setSaveError(failureText(caught, { area: 'directory', op: 'save', fallback: "Could not save your profile. Please try again.", audience: 'member' }));
    } finally {
      setSaving(false);
    }
  }

  const jobTitlesBySector = useMemo(
    () => groupJobTitlesBySector(sectors, jobTitles),
    [sectors, jobTitles],
  );

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
          {loadState.kind === "loading" && <LoadingView t={t} />}

          {loadState.kind === "error" && (
            <ErrorView t={t} message={loadState.message} onClose={onClose} />
          )}

          {loadState.kind === "ready" && (
            <ProfileFormFields
              t={t}
              form={form}
              setForm={setForm}
              sectors={sectors}
              jobTitles={jobTitles}
              skills={skills}
              jobTitlesBySector={jobTitlesBySector}
              proposedInput={proposedInput}
              setProposedInput={setProposedInput}
              saveNotice={saveNotice}
              saveError={saveError}
              saving={saving}
              hadProfile={hadProfile}
              onClose={onClose}
              onSave={() => { void handleSave(); }}
              onSectorChange={handleSectorChange}
              onJobTitleChange={handleJobTitleChange}
              onToggleSkill={toggleSkill}
              onAddProposed={addProposedSkill}
              onRemoveProposed={removeProposedSkill}
            />
          )}
        </div>
      </div>
    </div>
  );
}
