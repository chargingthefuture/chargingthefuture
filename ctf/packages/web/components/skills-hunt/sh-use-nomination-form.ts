"use client";

import { useEffect, useState } from "react";
import { MAX_SKILLS, type SkillsHuntRound } from "./sh-shared";
import { isRoundOpenForNominations } from "lib/skills-hunt/round-window";
import { nameFromQuoraProfileUrl } from "lib/skills-hunt/name-from-quora-url";
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

// How long after the last keystroke in the Quora field the form asks whether that person can be
// nominated. A paste settles at once; typing a link by hand asks once at the end, not per letter.
const QUORA_CHECK_DELAY_MS = 400;

// Asks the server, as soon as a Quora link is in the field, whether this person is already nominated
// or asked to be removed, so the scout finds out before filling in the rest of the form. Returns the
// sentence to show under the field, or null. Submit still runs the same check as the real guard, so a
// failed or slow check here only means the scout hears it at submit, as before.
function useQuoraNominationCheck(quora: string): string | null {
  const [blocked, setBlocked] = useState<{ url: string; message: string } | null>(null);
  useEffect(() => {
    const url = quora.trim();
    if (!url) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/skills-hunt/nomination-check?quoraProfileUrl=${encodeURIComponent(url)}`, { signal: controller.signal })
        .then((res) => (res.ok ? (res.json() as Promise<{ state?: string; message?: string }>) : null))
        .then((body) => {
          const refused = body && (body.state === "already_nominated" || body.state === "taken_down") && body.message;
          setBlocked(refused ? { url, message: body.message! } : null);
        })
        .catch(() => { /* aborted or offline: submit runs the same check */ });
    }, QUORA_CHECK_DELAY_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [quora]);
  // Only the answer for the link now in the field counts; an edited link waits for its own answer.
  return blocked && blocked.url === quora.trim() ? blocked.message : null;
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
  // The last name filled in from a Quora link. A pasted link fills Full Name while the field is
  // empty or still holds that guess, so pasting a corrected link updates it, and a name the scout
  // typed themselves is never overwritten.
  const [guessedName, setGuessedName] = useState("");
  const [country, setCountry] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [city, setCity] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [proposedSkills, setProposed] = useState<string[]>([]);
  const [jobTitleId, setJobTitleId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const quoraBlocked = useQuoraNominationCheck(quora);

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

  // Pick (or clear) the nominee's job title. The id is saved with the nomination and becomes the job
  // title on the Directory profile an accepted nomination creates. Picking one also fills in its
  // taxonomy skills (deduped, and only up to the cap), so a scout who knows someone is, say, a
  // Pharmacist does not have to remember every skill; the skills stay listed one by one and the scout
  // can trim them. Clearing the job title leaves the skills as they are.
  function selectJobTitle(nextJobTitleId: string | null, skillNames: string[]) {
    setJobTitleId(nextJobTitleId);
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
    if (!isNominationReady(activeRound, fullName, allSkillCount, country, quora) || quoraBlocked) return;
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
          jobTitleId,
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

  function changeQuora(value: string) {
    setQuora(value);
    const guess = nameFromQuoraProfileUrl(value);
    if (guess && (fullName.trim() === "" || fullName === guessedName)) {
      setFullName(guess);
      setGuessedName(guess);
    }
  }

  function resetForm() {
    setFullName(""); setBio(""); setQuora(""); setGuessedName("");
    setCountry(""); setStateRegion(""); setCity("");
    setSkills([]); setProposed([]); setFreeText(""); setJobTitleId(null);
    setSubmitted(false); setSubmitError(null);
  }

  const form: ScoutFormModel = {
    fullName, bio, quora, country, state: stateRegion, city, skills, proposedSkills, jobTitleId, freeText, openCategory,
    quoraBlocked, submitting, submitError, allSkillCount, canAddMore,
    onFullName: setFullName, onBio: setBio, onQuora: changeQuora,
    onCountry: setCountry, onState: setStateRegion, onCity: setCity,
    onToggleSkill: toggleSkill,
    onSelectJobTitle: selectJobTitle,
    onRemoveProposed: (s) => setProposed((prev) => prev.filter((x) => x !== s)),
    onOpenCategory: setOpenCategory, onFreeText: setFreeText, onAddProposed: addProposed,
    onSubmit: () => void handleSubmit(),
  };

  return { form, submitted, resetForm };
}
