"use client";

import { useState } from "react";
import { MAX_SKILLS, type SkillsHuntRound } from "./sh-shared";
import type { ScoutFormModel } from "./sh-scout-tab";

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

  async function handleSubmit() {
    if (!activeRound || fullName.trim().length < 2 || allSkillCount === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/skills-hunt/rounds/${activeRound.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ctf-csrf": "1" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          bio: bio.trim(),
          quoraProfileUrl: quora.trim(),
          skills,
          proposedSkills,
          claimedProfessions: [],
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? "Failed to submit nomination.");
      }
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit nomination.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFullName(""); setBio(""); setQuora("");
    setSkills([]); setProposed([]); setFreeText("");
    setSubmitted(false); setSubmitError(null);
  }

  const form: ScoutFormModel = {
    fullName, bio, quora, skills, proposedSkills, freeText, openCategory,
    submitting, submitError, allSkillCount, canAddMore,
    onFullName: setFullName, onBio: setBio, onQuora: setQuora,
    onToggleSkill: toggleSkill,
    onRemoveProposed: (s) => setProposed((prev) => prev.filter((x) => x !== s)),
    onOpenCategory: setOpenCategory, onFreeText: setFreeText, onAddProposed: addProposed,
    onSubmit: () => void handleSubmit(),
  };

  return { form, submitted, resetForm };
}
