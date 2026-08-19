# Account & Data — Manual Test Script

> **Android: not applicable.** This surface is web-only (rule 105); the installable web app (PWA)
> serves phones. Test on web only: the phone-width layout at desktop and ~390px.

> Walk these steps on a real device to confirm the Account & Data page (`/account/data`) works end
> to end. Source of truth: the account deletion registry
> (`ctf/packages/web/lib/account/deletion-registry.ts`) and the non-plugin feature inventory §1.2.

| | |
|---|---|
| **Surface** | `/account/data` (Your Data & Privacy) |
| **Visibility** | Any signed-in identity (including unlock-pending) |
| **Roles to test** | member |
| **Surfaces** | web (phone-width layout) |
| **Generated** | 2026-07-26 (hand-written on the JSON-export build, issue #1264) |

## How to run this

- Each case is **precondition → steps → expected**. Mark each box: ✅ pass · ❌ fail · ⛔ blocked.
- A ❌ becomes a row in the **Bug Reporting** plugin; link it in the notes line.

---

## AD-1 · Page loads and lists services from the registry

**Role:** member · **Precondition:** signed in; some plugin data exists (post in Commons, etc.).
**Steps:**
1. Open `/account/data`.
2. Read both lists: "Personal data" (deletable services) and "Always retained".
**Expected:** Every service and its one-line summary comes from the deletion registry (no
hardcoded copy). Retained entries (ServiceCredits, GDP, Weekly Performance…) show a lock and are
honestly framed as kept by design.
**Result:** web ☐ — notes:

## AD-2 · Export one service (JSON download)

**Role:** member · **Precondition:** the member has data in at least one service (e.g. Commons posts).
**Steps:**
1. On a service card, tap the Download (export) button beside Delete.
2. Open the downloaded file.
**Expected:** A file named `ctf-account-data-<slug>-<date>.json` downloads without leaving the
page. It is valid JSON with the envelope `exportVersion: 1`, `generatedAtIso`, `userId` (yours),
`scope: "service:<slug>"`, one `services[]` entry with `tables[]` (`table`, `userColumn`,
`rowCount`, `rows`), and `notes[]` stating the retained-data scope. Every row is the member's own
(the `userColumn` value is their user id); no other member's profile is joined in. A service with
no data still downloads an honest zero-table/zero-row file.
**Result:** web ☐ — notes:

## AD-3 · Export the whole account

**Role:** member
**Steps:**
1. At the top of the data view, tap **Download all my data (JSON)** (spinner shows while preparing).
2. Open the downloaded `ctf-account-data-full-account-<date>.json`.
**Expected:** One valid JSON document, `scope: "full-account"`, with a `services[]` entry for every
registry service that has user-scoped tables — including retained-list services that still hold the
member's own rows (e.g. Notifications). Money ledgers and audit trails are absent, and the `notes`
say so. Contents match what the page shows (a service you deleted in this session exports zero rows).
**Result:** web ☐ — notes:

## AD-4 · Export errors and rate limit

**Role:** member
**Steps:**
1. Trigger the full-account export 4+ times within a few minutes.
2. (If reachable) request `/api/account/services/not-a-service/export` directly.
**Expected:** Past the per-user limit (3 full exports / 10 min; 10 per-service / 10 min) the page
shows the inline "Too many exports" message (HTTP 429 with `Retry-After`) instead of replacing the
page with an error. An unknown slug returns 404 `ACCOUNT_UNKNOWN_SERVICE`. Signed out, the export
routes return the auth denial, never data.
**Result:** web ☐ — notes:

## AD-5 · Per-service delete (existing flow unchanged)

**Role:** member · **Precondition:** a service with data you are willing to delete.
**Steps:**
1. Tap Delete on a service card; read the confirm dialog; confirm.
2. Re-export the whole account.
**Expected:** The two-step confirm names the service and states permanence. After deletion the card
leaves the list and a fresh full export shows zero rows for that service. Full-account deletion
still requires typing `delete my account` (do not run this casually).
**Result:** web ☐ — notes:

## AD-6 · Deleting Commons data removes the posts, not just the author's name

**Role:** member (or admin on a throwaway account) · **Precondition:** the account has posted at
least two messages in the Commons, and one of them is still visible on the Commons chat.
**Steps:**
1. Open the Commons and note the exact text of your posts.
2. Go to Account & Data and delete the Commons service (or the whole account on a throwaway
   account).
3. Reload the Commons in a signed-in session and scroll to where the posts were.
4. Repeat the deletion once more, then reload again.
**Expected:** The post text is **gone** from the Commons — not still on screen under a generic
handle such as `user-hub-syst`, and not present with any other substituted author name. Official
announcements from the operator stay exactly as they were. The second deletion finds nothing left to
remove and changes nothing on screen. Replies and reactions that hung off the deleted posts are gone
with them.
**Result:** web ☐ — notes:

## AD-7 · Full-account delete removes the sign-in too

**Role:** member on a **throwaway account** · **Precondition:** a disposable account you are willing
to lose permanently — this cannot be undone. Note its email before you start.
**Steps:**
1. Sign in as the throwaway account, open Account & Data, choose the full-account delete, type
   `delete my account`, and confirm.
2. Read the "Deletion queued" screen.
3. Try to sign in again with that account's email.
4. As an admin, open `/admin/unlock` and look at the "Sign-ups" panel.
**Expected:** Step 2: the confirmation says the personal data is being removed across all services
**and that the sign-in is removed with it**. Step 3: signing in is no longer possible — the account is
gone from the auth provider, not merely emptied. Step 4: the account is not in the sign-up list at all
(it no longer exists), so it is not sitting in the "No Quora URL" tab as if it were someone who never
verified. If the auth provider is unreachable at the moment of deletion, the data deletion still
succeeds and the response carries `identityRemoved: false` with the reason — the leftover account is
then cleared through the operator `Delete Account (manual)` workflow.
**Result:** web ☐ · android ☐ — notes:
