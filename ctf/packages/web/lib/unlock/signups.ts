import { createClerkClient } from '@clerk/backend';
import { queryDb } from 'lib/db/postgres';
import { getClerkSecretKey } from 'lib/auth/clerk-env';
import { failureReason } from 'lib/errors/failure';
import { listUnlockExcludedAccounts } from './excluded-accounts';
import type { UnlockReviewStatus, UnlockSignupAccount, UnlockSignupOverview } from './types';

// Who has signed up, and which of those people never gave us a Quora URL.
//
// Unlock only ever sees a member once they submit a Quora profile URL, so its review queue cannot answer
// the two questions the owner actually asks of it: how many people have joined, and how many joined and
// then stopped before verifying. The first number lives only in the auth provider (the sign-up is an
// account, not a row of ours), so this module reads the full account roster from the provider's backend
// API and joins it to the submissions table. That way the whole reading is on the Unlock admin page and
// nobody has to open the provider dashboard to get it.
//
// A large gap between sign-ups and submissions is the signal: either the Quora-URL step is doing its job
// and turning spam away, or people are arriving from somewhere other than Quora and cannot complete a
// step that assumes they came from there.

// One page of the provider's account list. 500 is the provider's maximum page size.
const PAGE_SIZE = 500;
// Stop after this many accounts so a much larger future roster cannot turn one admin page load into a
// long series of provider calls. The overview says so when it truncates.
const MAX_ACCOUNTS = 5000;

type ProviderAccount = {
  userId: string;
  name: string | null;
  username: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

type SubmissionFact = {
  reviewStatus: UnlockReviewStatus;
  submittedAt: string;
};

function toIso(epochMs: number | null | undefined): string | null {
  if (typeof epochMs !== 'number' || !Number.isFinite(epochMs)) return null;
  return new Date(epochMs).toISOString();
}

function fullName(user: { firstName: string | null; lastName: string | null }): string | null {
  const joined = [user.firstName, user.lastName].filter((part) => part && part.trim().length > 0).join(' ').trim();
  return joined.length > 0 ? joined : null;
}

function primaryEmail(user: {
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
}): string | null {
  const primary = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

// Every account the auth provider holds, newest sign-up first. Throws when the provider is not
// configured or the call fails — the caller turns that into the "why this reading is missing" message.
async function listProviderAccounts(): Promise<{ accounts: ProviderAccount[]; truncated: boolean }> {
  const secretKey = getClerkSecretKey();
  if (!secretKey) {
    throw new Error('the auth provider secret key is not set in this runtime, so the account list cannot be read');
  }

  const client = createClerkClient({ secretKey });
  const accounts: ProviderAccount[] = [];
  let offset = 0;

  for (;;) {
    const page = await client.users.getUserList({ limit: PAGE_SIZE, offset, orderBy: '-created_at' });
    for (const user of page.data) {
      accounts.push({
        userId: user.id,
        name: fullName(user),
        username: user.username,
        email: primaryEmail(user),
        createdAt: new Date(user.createdAt).toISOString(),
        lastSignInAt: toIso(user.lastSignInAt),
      });
    }
    offset += page.data.length;
    if (page.data.length < PAGE_SIZE) return { accounts, truncated: false };
    if (accounts.length >= MAX_ACCOUNTS) return { accounts, truncated: true };
  }
}

// Which of those accounts have a Quora URL on file, and what happened to it.
async function listSubmissionFacts(): Promise<Map<string, SubmissionFact>> {
  const result = await queryDb<{ user_id: string; review_status: UnlockReviewStatus; created_at: Date }>(
    `SELECT user_id, review_status, created_at FROM unlock_verification_submissions`,
  );

  const byUser = new Map<string, SubmissionFact>();
  for (const row of result.rows) {
    byUser.set(row.user_id, {
      reviewStatus: row.review_status,
      submittedAt: row.created_at.toISOString(),
    });
  }
  return byUser;
}

function emptyOverview(unavailableReason: string): UnlockSignupOverview {
  return {
    available: false,
    unavailableReason,
    truncated: false,
    totalAccounts: 0,
    excludedCount: 0,
    memberCount: 0,
    submittedCount: 0,
    notSubmittedCount: 0,
    accounts: [],
  };
}

// The sign-up reading behind the Unlock admin's top panel: total accounts, the demo/test accounts an
// admin has taken out, and the members who never submitted a Quora URL. Never throws — a provider
// failure comes back as `available: false` with the reason in plain words, so the rest of the admin page
// still renders.
export async function getUnlockSignupOverview(): Promise<UnlockSignupOverview> {
  let roster: { accounts: ProviderAccount[]; truncated: boolean };
  try {
    roster = await listProviderAccounts();
  } catch (error) {
    return emptyOverview(`The sign-up list could not be read from the auth provider — ${failureReason(error)}`);
  }

  let submissions: Map<string, SubmissionFact>;
  let excludedUserIds: Map<string, string | null>;
  try {
    const [facts, excluded] = await Promise.all([listSubmissionFacts(), listUnlockExcludedAccounts()]);
    submissions = facts;
    excludedUserIds = new Map(excluded.map((entry) => [entry.userId, entry.note]));
  } catch (error) {
    return emptyOverview(`The verification records could not be read from the database — ${failureReason(error)}`);
  }

  const accounts: UnlockSignupAccount[] = roster.accounts.map((account) => {
    const submission = submissions.get(account.userId) ?? null;
    return {
      ...account,
      excluded: excludedUserIds.has(account.userId),
      excludedNote: excludedUserIds.get(account.userId) ?? null,
      hasSubmission: submission !== null,
      reviewStatus: submission?.reviewStatus ?? null,
      submittedAt: submission?.submittedAt ?? null,
    };
  });

  const counted = accounts.filter((account) => !account.excluded);
  const submittedCount = counted.filter((account) => account.hasSubmission).length;

  return {
    available: true,
    unavailableReason: null,
    truncated: roster.truncated,
    totalAccounts: accounts.length,
    excludedCount: accounts.length - counted.length,
    memberCount: counted.length,
    submittedCount,
    notSubmittedCount: counted.length - submittedCount,
    accounts,
  };
}
