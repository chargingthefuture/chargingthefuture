import { describe, expect, it } from 'vitest';
import { describeSubmissionInputProblem } from './repository';
import type { SkillsHuntSubmissionInput } from './types';

// A nomination the Scout tab would let you press Submit on: a name, one skill, a country, and a
// Quora profile URL. All four carry the required marker on the form, and the form's readiness check
// waits for all four.
const READY_TO_SUBMIT: SkillsHuntSubmissionInput = {
  roundId: '11111111-1111-4111-8111-111111111111',
  fullName: 'Amara Williams',
  bio: '',
  quoraProfileUrl: 'https://www.quora.com/profile/Amara-Williams',
  skills: ['Cleaning techniques and schedules'],
  proposedSkills: [],
  country: 'United States',
  state: 'Georgia',
  city: 'Atlanta',
};

describe('describeSubmissionInputProblem', () => {
  it('accepts a nomination that carries a Quora profile URL', () => {
    expect(describeSubmissionInputProblem(READY_TO_SUBMIT)).toBeNull();
  });

  // The Quora URL is required (owner decision, 2026-09-13). Before it was checked here, a blank
  // field passed this table and was refused a step later by `createSubmission`, which reads
  // "Invalid Quora profile URL." and does not say the field was simply left empty.
  it('names the Quora rule when the URL is missing', () => {
    const problem = describeSubmissionInputProblem({ ...READY_TO_SUBMIT, quoraProfileUrl: '' });
    expect(problem).toContain('Quora profile URL is required');
  });

  // A link that is not a Quora profile fails the same rule, so the scout reads one sentence for
  // both mistakes rather than a different one depending on how the field was wrong.
  it('names the Quora rule when the URL is not a Quora profile link', () => {
    const problem = describeSubmissionInputProblem({ ...READY_TO_SUBMIT, quoraProfileUrl: 'https://example.com/someone' });
    expect(problem).toContain('Quora profile URL is required');
  });

  it('names the skills rule when no skill is picked', () => {
    const problem = describeSubmissionInputProblem({ ...READY_TO_SUBMIT, skills: [] });
    expect(problem).toContain('at least one skill');
  });

  it('names the country rule when country is missing', () => {
    const problem = describeSubmissionInputProblem({ ...READY_TO_SUBMIT, country: '' });
    expect(problem).toContain('Country is required');
  });

  it('names the full-name rule when the name is too short', () => {
    const problem = describeSubmissionInputProblem({ ...READY_TO_SUBMIT, fullName: 'A' });
    expect(problem).toContain('Full name');
  });

  // Every refusal has to be usable on its own: a scout reading it should know what to change.
  it('never answers with a bare invalid-payload sentence', () => {
    const problem = describeSubmissionInputProblem({ ...READY_TO_SUBMIT, skills: [] });
    expect(problem).not.toBe('Invalid submission payload.');
  });
});
