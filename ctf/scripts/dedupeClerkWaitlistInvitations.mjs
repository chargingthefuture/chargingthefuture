#!/usr/bin/env node

// One-shot cleanup for the messy Clerk "Invitations" list built up from waitlist sign-ups:
// most rows are duplicates of the same address re-invited over time, and nearly all of them
// have expired. This collapses each email address down to a single live invitation and sends
// a fresh invite (Clerk's own invitation email) to every address that does not already have
// one pending and is not already a member.
//
// Clerk has no endpoint to delete an invitation record — the list an admin sees in the
// dashboard is a permanent history, not a mutable table. "Dedupe" here means: revoke every
// extra *pending* duplicate for an address (only pending invitations can be revoked) and make
// sure exactly one live invitation exists going forward. The old expired/accepted/revoked rows
// stay visible in Clerk's history; that is expected, not a bug in this script.
//
// Defaults to a DRY RUN: it only prints counts, never email addresses (GitHub Actions logs on
// this repo are world-readable, and this is member data). Pass --execute to actually revoke
// duplicates and send invitations.
//
// DELETE THIS SCRIPT AND ITS WORKFLOW (.github/workflows/dedupe-clerk-waitlist-invitations.yml)
// once the owner has run the real (--execute) pass and confirmed the backlog is cleaned up —
// this is a one-shot cleanup, not a recurring job.

import { createClerkClient } from '@clerk/backend';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

const EXECUTE = process.argv.includes('--execute');
const clerk = createClerkClient({ secretKey: requireEnv('CLERK_SECRET_KEY') });

// Clerk's default rate limit comfortably covers a few hundred sequential calls, but a write
// loop this size is worth a small, bounded retry on a 429 rather than failing the whole run
// over one throttled request.
async function withRetry(fn, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const status = error?.status ?? error?.statusCode;
      if (status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        continue;
      }
      throw new Error(`${label} failed (status ${status ?? 'unknown'}): ${error?.message ?? error}`);
    }
  }
}

// getInvitationList() returns non-revoked invitations (pending/accepted/expired) by default,
// which is exactly what dedupe + re-invite needs — revoked rows are already dead ends.
async function fetchAllInvitations() {
  const limit = 100;
  let offset = 0;
  const all = [];
  for (;;) {
    const { data, totalCount } = await withRetry(
      () => clerk.invitations.getInvitationList({ limit, offset }),
      'listing invitations',
    );
    all.push(...data);
    offset += data.length;
    if (data.length === 0 || offset >= totalCount) break;
  }
  return all;
}

// Cross-check against real accounts: someone from this list may already have signed up
// through a path other than accepting their invitation. Batches the lookup so 139 addresses
// costs a handful of calls, not one per address.
async function existingAccountEmails(emails) {
  const found = new Set();
  const batchSize = 50;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const { data } = await withRetry(
      () => clerk.users.getUserList({ emailAddress: batch, limit: batchSize }),
      'looking up existing accounts',
    );
    for (const user of data) {
      for (const emailAddress of user.emailAddresses) {
        found.add(emailAddress.emailAddress.trim().toLowerCase());
      }
    }
  }
  return found;
}

async function main() {
  const invitations = await fetchAllInvitations();

  const byEmail = new Map();
  for (const invitation of invitations) {
    const key = invitation.emailAddress.trim().toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key).push(invitation);
  }

  const alreadyMembers = await existingAccountEmails([...byEmail.keys()]);

  const toRevoke = [];
  const toInvite = [];
  let skippedExistingMember = 0;
  let skippedAlreadyAccepted = 0;
  let skippedAlreadyPending = 0;

  for (const [email, group] of byEmail) {
    if (alreadyMembers.has(email)) {
      skippedExistingMember++;
      continue;
    }

    if (group.some((invitation) => invitation.status === 'accepted')) {
      skippedAlreadyAccepted++;
      continue;
    }

    const pending = group
      .filter((invitation) => invitation.status === 'pending')
      .sort((a, b) => b.createdAt - a.createdAt);

    if (pending.length > 0) {
      skippedAlreadyPending++;
      toRevoke.push(...pending.slice(1)); // keep the newest pending invitation, revoke the rest
      continue;
    }

    toInvite.push(email);
  }

  console.log(`[dedupe-clerk-invitations] mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`[dedupe-clerk-invitations] invitation records fetched: ${invitations.length}`);
  console.log(`[dedupe-clerk-invitations] unique email addresses: ${byEmail.size}`);
  console.log(`[dedupe-clerk-invitations] already an existing account (skipped): ${skippedExistingMember}`);
  console.log(`[dedupe-clerk-invitations] already accepted an earlier invite (skipped): ${skippedAlreadyAccepted}`);
  console.log(`[dedupe-clerk-invitations] already have one live pending invitation (skipped): ${skippedAlreadyPending}`);
  console.log(`[dedupe-clerk-invitations] duplicate pending invitations to revoke: ${toRevoke.length}`);
  console.log(`[dedupe-clerk-invitations] fresh invitations to send: ${toInvite.length}`);

  if (!EXECUTE) {
    console.log('[dedupe-clerk-invitations] dry run only — nothing in Clerk was changed.');
    console.log('[dedupe-clerk-invitations] re-run with --execute to revoke duplicates and send invitations.');
    return;
  }

  let revoked = 0;
  for (const invitation of toRevoke) {
    try {
      await withRetry(() => clerk.invitations.revokeInvitation(invitation.id), `revoking invitation ${invitation.id}`);
      revoked++;
    } catch (error) {
      console.error(`[dedupe-clerk-invitations] ${error.message}`);
    }
  }

  let sent = 0;
  for (const email of toInvite) {
    try {
      await withRetry(
        () => clerk.invitations.createInvitation({ emailAddress: email, notify: true, ignoreExisting: true }),
        'creating invitation',
      );
      sent++;
    } catch (error) {
      console.error(`[dedupe-clerk-invitations] ${error.message}`);
    }
  }

  console.log(`[dedupe-clerk-invitations] revoked ${revoked} duplicate invitation(s).`);
  console.log(`[dedupe-clerk-invitations] sent ${sent} fresh invitation email(s).`);
}

main().catch((error) => {
  console.error('[dedupe-clerk-invitations] failed:', error?.message ?? error);
  process.exitCode = 1;
});
