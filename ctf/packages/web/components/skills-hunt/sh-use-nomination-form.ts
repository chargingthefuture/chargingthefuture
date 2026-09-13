"use client";

import { useState } from "react";
import { MAX_SKILLS, type SkillsHuntRound } from "./sh-shared";
import { isRoundOpenForNominations } from "lib/skills-hunt/round-window";
import type { ScoutFormModel } from "./sh-scout-tab";

// A nomination is ready to submit once the round is open, the full name is plausible, there is at
// least one skill, there is a country, and there is a Quora profile URL (the server enforces the
// same set).
//
// "Open" means the status is active and today falls inside the round's dates. Checking only the
// status was the bug: a round keeps its active status after its end date passes, so the form went
// on accepting nominations that the server then refused one by one.
//
// The Quora URL is required and has been since the field was added — the label carries the required
// marker and the server refuses a blank one by name. This gate left it out, so Submit lit up on an
// empty field and the refusal arrived from the server instead of the form. Only emptiness is checked
// here: a malformed URL keeps the button live and comes back with the server's own sentence naming
// the field, rather than disabling Submit part-way through typing a link.
function isNominationReady(
  activeRound: SkillsHuntRound | null,
  fullName: string,
  allSkillCount: number,
  country: string,
  quora: string,
): boolean {
  return (
    isRoundOpenForNominations(activeRound) &&
    fullName.trim().length >= 2 &&
    allSkillCount > 0 &&
    country.trim().length > 0 &&
    quora.trim().length > 0
  );
}

function nominationErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Failed to submit nomination.";
}

// Owns the nomination-form state, the submit/reset handlers, and assembly of the
// ScoutFormModel passed to the Scout tab. Kept out of the shell to honor rule-116.
export function useNominationForm(activeRound: SkillsHuntRound | null): {
  form: ScoutFormModel;
  submitted: boolean;
  resetForm: () => void;
} {
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [quora, setQuora] = useState("");
  const [country, setCountry] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [city, setCity] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [proposedSkills, setProposed] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const allSkillCount = skills.length + proposedSkills.length;
  const canAddMore = allSkillCount < MAX_SKILLS;

  function toggleSkill(s: string) {
    setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function addProposed() {
    const tokens = freeText.split(/[,\n]+/).map((t) => t.trim()).filter(
      (t) => t && t.length <= 40 && !skills.includes(t) && !proposedSkills.includes(t),
    );
    if (tokens.length && allSkillCount + tokens.length <= MAX_SKILLS) {
      setProposed((prev) => [...prev, ...tokens]);
    }
    setFreeText("");
  }

  // Bulk-add the skills of a chosen profession (occupation). A convenience so a scout who knows
  // someone is, say, a Pharmacist does not have to remember every skill: picking the profession
  // fills its taxonomy skills into the existing skills field (deduped, and only up to the cap),
  // which the scout can then trim. Nothing new is stored — the skills remain the source of truth.
  function addOccupationSkills(skillNames: string[]) {
    setSkills((prev) => {
      const next = [...prev];
      for (const name of skillNames) {
        if (next.length + proposedSkills.length >= MAX_SKILLS) break;
        if (!next.includes(name)) next.push(name);
      }
      return next;
    });
  }

  async function handleSubmit() {
    // Country and the Quora profile URL are both required (the server enforces both); full name and
    // at least one skill as before.
    if (!isNominationReady(activeRound, fullName, allSkillCount, country, quora)) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/skills-hunt/rounds/${activeRound!.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          bio: bio.trim(),
          quoraProfileUrl: quora.trim(),
          skills,
          proposedSkills,
          country: country.trim(),
          state: stateRegion.trim() ? stateRegion.trim() : null,
          city: city.trim() ? city.trim() : null,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string; reference?: string };
        // A failure the server could not name carries a short reference that is also written into
        // the error report, so a screenshot of this banner can be tied to the log line behind it.
        const text = err.message ?? "Failed to submit nomination.";
        throw new Error(err.reference ? `${text} (reference ${err.reference})` : text);
      }
      setSubmitted(true);
    } catch (e) {
      setSubmitError(nominationErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFullName(""); setBio(""); setQuora("");
    setCountry(""); setStateRegion(""); setCity("");
    setSkills([]); setProposed([]); setFreeText("");
    setSubmitted(false); setSubmitError(null);
  }

  const form: ScoutFormModel = {
    fullName, bio, quora, country, state: stateRegion, city, skills, proposedSkills, freeText, openCategory,
    submitting, submitError, allSkillCount, canAddMore,
    onFullName: setFullName, onBio: setBio, onQuora: setQuora,
    onCountry: setCountry, onState: setStateRegion, onCity: setCity,
    onToggleSkill: toggleSkill,
    onAddOccupationSkills: addOccupationSkills,
    onRemoveProposed: (s) => setProposed((prev) => prev.filter((x) => x !== s)),
    onOpenCategory: setOpenCategory, onFreeText: setFreeText, onAddProposed: addProposed,
    onSubmit: () => void handleSubmit(),
  };

  return { form, submitted, resetForm };
}
