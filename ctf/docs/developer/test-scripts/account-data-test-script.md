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
