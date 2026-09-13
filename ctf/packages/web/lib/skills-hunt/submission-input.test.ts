import { describe, expect, it } from 'vitest';
import { describeSubmissionInputProblem } from './repository';
import type { SkillsHuntSubmissionInput } from './types';

// A nomination the Scout tab would let you press Submit on: a name, one skill, a country. The
// Quora URL field carries no required marker there and the form's own readiness check ignores it.
const READY_TO_SUBMIT: SkillsHuntSubmissionInput = {
  roundId: '11111111-1111-4111-8111-111111111111',
  fullName: 'Amara Williams',
  bio: '',
  quoraProfileUrl: '',
  skills: ['Cleaning techniques and schedules'],
  proposedSkills: [],
  country: 'United States',
  state: 'Georgia',
  city: 'Atlanta',
};

describe('describeSubmissionInputProblem', () => {
  // The regression this file exists for. The server used to require at least one character in the
  // Quora URL, so a nomination the form had accepted was refused after the fact — and the refusal
  // read "Invalid submission payload.", which named neither the field nor the rule.
  it('accepts a nomination with no Quora URL, as the Scout tab promises', () => {
    expect(describeSubmissionInputProblem(READY_TO_SUBMIT)).toBeNull();
  });

  it('accepts a nomination that does carry a Quora URL', () => {
    expect(
      describeSubmissionInputProblem({
        ...READY_TO_SUBMIT,
        quoraProfileUrl: 'https://www.quora.com/profile/Example-1',
      }),
    ).toBeNull();
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
