// 'duplicate' is a real member who already has an account — the same Quora profile signed up again
// under a different email, which is ordinary and common. It removes app access like 'spam' does, but it
// is deliberately not spam: their Quora URL is never added to the denylist, because that URL belongs to
// their original account and denylisting it would lock the real person out for good.
export type UnlockReviewStatus = 'pending' | 'approved' | 'rejected' | 'spam' | 'duplicate';

export type UnlockAccessTier = 'pending_readonly' | 'locked_support_only' | 'approved_full';

export type UnlockSubmission = {
  id: number;
  userId: string;
  quoraProfileUrl: string;
  quoraProfileUrlNormalized: string;
  reviewStatus: UnlockReviewStatus;
  accessTier: UnlockAccessTier;
  unlockWindowExpiresAt: string;
  reminderStage: number;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  incentiveGrantedAt: string | null;
  // Duplicate-identity guard. rewardWithheldAt: the reward was held because another account already
  // holds this Quora identity's reward — awaiting an admin determination. rewardRevokedAt: an admin
  // clawed the reward back (the "loser" of a determination, or a perp).
  rewardWithheldAt: string | null;
  rewardRevokedAt: string | null;
  // Who put the URL that is stored right now. Null when the member submitted it themselves; otherwise
  // the admin who entered it for a member who could not produce one, or who corrected a wrong one.
  // Cleared when the member submits their own URL over the top, because it describes the current URL,
  // not the row's entire history — that trail is directory_quora_url_history. A reviewer needs the
  // difference in front of them: "this person proved they are real" and "an admin found this profile
  // for them" are not the same claim.
  urlSetByAdminUserId: string | null;
  urlSetByAdminAt: string | null;
  // How many accounts (including this one) have claimed the same normalized Quora URL. Only populated
  // by the admin queue list; 1 means no duplicate. Undefined where not computed.
  sharedUrlAccountCount?: number;
  // How many times this member's Quora URL has changed (directory_quora_url_history). Only populated by
  // the admin queue list. 0/1 is normal; a higher count is a signal to open the history and review —
  // never an automatic flag (Quora sometimes deletes accounts, so re-profiling is legitimate).
  quoraUrlChangeCount?: number;
  // Who the member is, so an admin reviewing the queue is not reading a raw id. Read from Clerk (see
  // lib/unlock/member-identity.ts) and only populated on the admin queue list; null when Clerk could
  // not be reached, or the account no longer exists, or it carries no handle.
  memberName?: string | null;
  memberUsername?: string | null;
  createdAt: string;
  updatedAt: string;
};

// One row of the persistent spam Quora-URL denylist (unlock_spam_quora_urls), as shown in the admin
// denylist panel. Keyed on the normalized URL; holds no member id.
export type SpamQuoraUrlEntry = {
  quoraProfileUrlNormalized: string;
  quoraProfileUrl: string;
  flaggedByUserId: string | null;
  flagCount: number;
  firstFlaggedAt: string;
  lastFlaggedAt: string;
};

export type RevokeUnlockRewardInput = {
  actorUserId: string;
  submissionId: number;
  reviewNote?: string;
};

export type CreateUnlockSubmissionInput = {
  userId: string;
  quoraProfileUrl: string;
  quoraProfileUrlNormalized: string;
  // Set only when an admin is entering this URL on the member's behalf — the member could not produce
  // one, asked for help, and an admin looked them up by hand. Absent on the member's own submission,
  // which is what clears the stamp if they later submit their own URL over an admin-entered one.
  addedByAdminUserId?: string;
};

export type ReviewUnlockSubmissionInput = {
  actorUserId: string;
  submissionId: number;
  reviewStatus: Exclude<UnlockReviewStatus, 'pending'>;
  reviewNote?: string;
};

export type UnlockQueueFilters = {
  reviewStatus?: UnlockReviewStatus;
  accessTier?: UnlockAccessTier;
  limit?: number;
};

export type UnlockDashboardSnapshot = {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  spamCount: number;
  duplicateCount: number;
  // Members who actually hold support-only access. Excludes spam and duplicate: both decisions also
  // place a platform-wide restriction, and that restriction is what decides — they reach nothing.
  lockedSupportOnlyCount: number;
};

export type UnlockStatus = {
  userId: string;
  accessTier: UnlockAccessTier | null;
  reviewStatus: UnlockReviewStatus | null;
  unlockWindowExpiresAt: string | null;
  reminderStage: number;
  incentiveGrantedAt: string | null;
  hasSubmission: boolean;
  // True when this member may enter the Commons even though they have no submission on file —
  // because they asked for help, or because they have been here on an earlier day. Set by the status
  // route (not the repository), which keeps `accessTier` meaning strictly "what the submission says".
  // The mobile app reads this to decide whether to show the Unlock wall or the app shell.
  commonsAccess: boolean;
};

// One account on the Unlock admin's demo/test exclusion list (unlock_excluded_accounts). Marking an
// account here takes it out of every sign-up number on that page; it changes nothing about the member's
// access or their submission.
export type UnlockExcludedAccount = {
  userId: string;
  note: string | null;
  excludedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

// Why an account was banned. Not free text: an admin picks the judgment, and the wording that goes
// with it lives in one place rather than being retyped per ban. 'spam' and 'duplicate' come from a
// review decision on a submission; 'perp' is an account banned straight from the sign-up list, which
// is the only route available for somebody who never submitted a Quora URL at all.
export type UnlockBanReason = 'spam' | 'duplicate' | 'perp';

// One banned account. Separate from an excluded (demo/test) account and from a deleted one: this is a
// real person who really signed up and was judged, recorded so the pattern stays countable. The row is
// paired with a ban at the auth provider, which is the half that actually stops a sign-in.
export type UnlockBannedAccount = {
  userId: string;
  reason: string;
  note: string | null;
  bannedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

// One signed-up account as the Unlock admin's sign-up panel shows it: who they are, when they joined,
// and whether they ever gave us a Quora URL. Identity comes from the auth provider (an account that
// never submitted has no row of ours to read a name from); the submission fields come from
// unlock_verification_submissions.
export type UnlockSignupAccount = {
  userId: string;
  name: string | null;
  username: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  // True when an admin has marked this as a demo/test account, so the sign-up counters leave it out.
  excluded: boolean;
  excludedNote: string | null;
  // True when this account has an account-scope row in account_deletion_events: the person asked to be
  // forgotten and their data is gone. Their submission row went with it, so without this they would be
  // counted as "signed up, never gave a Quora URL" — the opposite of what happened.
  deletedTheirData: boolean;
  deletedAt: string | null;
  // True when an admin has banned this account. The sign-up counters leave it out of memberCount, the
  // same way a demo/test mark does, so the share of real people who finished Unlock is not dragged
  // down by accounts nobody expected to finish. The ban itself is still counted, in bannedCount.
  banned: boolean;
  bannedReason: string | null;
  bannedAt: string | null;
  hasSubmission: boolean;
  reviewStatus: UnlockReviewStatus | null;
  submittedAt: string | null;
  // How many times this member has loaded the Unlock screen (`unlock.status.get` audit rows). This is
  // the honest "did they try" number: sign-in timestamps only move on a fresh sign-in, so a member with
  // a live session can come back repeatedly without the dates changing. 1 means they saw the ask once
  // and left; several means they came back to it and still could not finish.
  unlockScreenViews: number;
  // What this member typed into the "anything that helps me find you on Quora" box when they pressed
  // "ask for help" — a name, a link to something they posted, an email. Null when they never pressed
  // the button or left the box empty. Free text, shown to the admin as written: it is the only thing
  // on file for a member who could not produce a profile URL, and it is what an approval by hand is
  // made from.
  quoraHint: string | null;
};

// The sign-up reading on the Unlock admin page. `available: false` means the roster could not be read
// (the auth provider is not configured in this runtime, or the call failed) and `unavailableReason` says
// why in plain words; every count is 0 in that case rather than pretending nobody signed up.
export type UnlockSignupOverview = {
  available: boolean;
  unavailableReason: string | null;
  // True when the roster hit the per-load account cap, so the counts cover only the accounts read.
  truncated: boolean;
  // Every account the auth provider holds, demo/test accounts included.
  totalAccounts: number;
  // How many of those an admin has marked demo/test.
  excludedCount: number;
  // How many of the rest an admin has banned outright.
  bannedCount: number;
  // How many of the rest deleted their data (an account-scope row in account_deletion_events).
  deletedCount: number;
  // totalAccounts - excludedCount - bannedCount - deletedCount: the people we treat as real sign-ups.
  // Banned accounts come out of this denominator on purpose. Leaving them in reports the share of
  // everyone who ever signed up, which answers a question nobody is asking; taking them out reports
  // the share of people who could have finished and did. Neither number is hidden — bannedCount is
  // right above.
  memberCount: number;
  // Of memberCount, how many have a Quora URL on file, in any review state.
  submittedCount: number;
  // memberCount - submittedCount: signed up, never submitted a Quora URL.
  notSubmittedCount: number;
  // Of notSubmittedCount, how many have not signed in again since the day they signed up. The rest
  // came back and still did not submit — the two groups need different answers, so they are counted
  // separately rather than read off a list of rows one at a time.
  notSubmittedNeverReturnedCount: number;
  accounts: UnlockSignupAccount[];
};
