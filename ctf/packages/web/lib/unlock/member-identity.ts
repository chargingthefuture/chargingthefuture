import { resolveMemberIdentities } from 'lib/identity/resolve-usernames';
import type { UnlockSubmission } from './types';

// Put a name on each submission in the admin review queue.
//
// Reviewing a verification is a decision about a person, and a raw `user_...` id says nothing about
// who that is. Clerk is identity in v3 — it holds the first and last name every account gives at
// sign-up — so the name is read from there and nowhere else. (It used to be joined from
// `directory_profiles`, which was wrong twice over: Unlock has nothing to do with the Directory, and a
// Directory profile only ever exists after the fact — an admin attaches one, or the member builds one
// once they are already approved — so the queue showed a bare id for exactly the people waiting to be
// reviewed.)
//
// Best-effort by design: the queue must render whether or not Clerk answers, so an unresolved id keeps
// a null name and the card falls back to printing the id.
export async function withMemberIdentities(submissions: UnlockSubmission[]): Promise<UnlockSubmission[]> {
  if (submissions.length === 0) return submissions;

  const identities = await resolveMemberIdentities(submissions.map((submission) => submission.userId));
  return submissions.map((submission) => {
    const identity = identities.get(submission.userId);
    return { ...submission, memberName: identity?.name ?? null, memberUsername: identity?.username ?? null };
  });
}
