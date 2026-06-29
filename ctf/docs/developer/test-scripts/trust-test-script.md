# Trust — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is
> generated from the plugin's feature inventory and contracts — those files are the source of
> truth, this is the runnable checklist derived from them. Do not edit a step here to match a
> bug; fix the code (or the inventory) and regenerate.
>
> **How to regenerate:** `pnpm --dir ctf test-script:generate -- trust`

| | |
|---|---|
| **Plugin** | Trust (`trust`) |
| **Visibility** | Internal — community reputation signal, not a member-facing screen of its own |
| **Roles to test** | admin / internal |
| **Surfaces** | web (internal admin surface) |
| **Seed first** | `pnpm --dir ctf seed:demo` |
| **Source inventory** | `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-trust-feature-inventory.md` |
| **Generated** | 2026-06-28 (initial authoring; regenerate via CI to stamp the commit) |

## How to run this

- Each case is **precondition → steps → expected**. Do it on each surface listed for the case.
- Mark each surface box: ✅ pass · ❌ fail · ⛔ blocked/can't reach.
- A ❌ becomes a row in the **Bug Reporting** plugin. Put the bug link in the notes line so the
  next run knows it's already filed.
- Run the **Core smoke** block every session. Run the full walkthrough when you changed this
  plugin or on a pre-release sweep.
- Trust is a derived signal computed from how members participate across other plugins. It is
  **never** a public numeric score. No step here should read out a member's reputation as a number,
  rank, or percentage — the signal is qualitative evidence only.

---

## Core smoke (every session)

Reputation plugin — these are the can't-ship-broken checks. Admin / internal role unless noted.

1. **Snapshot recomputes.** Run `POST /api/trust/signal/snapshot` for a seeded member. It writes a
   `trust_signal_snapshot` row and refreshes that member's evidence, without error. → web ☐
2. **No numeric score anywhere.** Confirm the evidence panel and any admin view show qualitative
   evidence items only — never a numeric score, rank, or percentage. → web ☐
3. **Admin verification is admin-only.** `POST /api/trust/admin/verification` is denied for a plain
   member and allowed for an admin. → web ☐
4. **Sensitive activity stays private.** Confirm no evidence item exposes ClickLog, Mood,
   GentlePulse, Unlock, or Foundation seeker-side activity. → web ☐

---

## Admin walkthrough

### TRUST-A1 · Signal snapshot from real participation
**Role:** admin / internal · **Surfaces:** web (internal surface) · **Seed:** `seed:demo`
**Precondition:** upstream plugins are seeded (the demo seed covers them); Trust reads their counts.
**Steps:**
1. For a seeded member with cross-plugin activity, call `POST /api/trust/signal/snapshot`.
2. Read the member's refreshed evidence (e.g. via `GET /api/trust/user/self` for that member, or
   the right-rail Trust widget).
**Expected:** A `trust_signal_snapshot` row is written (model `cross_plugin_engagement_v3`) holding
coarse counts only. Evidence items read as plain "verb N noun" lines (for example "Active on N
days", "Completed N SocketRelay trades", "Received ServiceCredits from N community members"). A
signal with zero backing rows produces **no** evidence item — nothing is fabricated. `trust_status`
is unchanged. The mutation is CSRF-guarded and writes a `trust_admin_audit_trail` row.
**Result:** web ☐ — notes:

### TRUST-A2 · No numeric score, sensitive plugins excluded
**Role:** admin / internal · **Surfaces:** web (internal surface)
**Steps:**
1. Inspect the evidence built for a member who is active in a sensitive plugin (e.g. seeded Mood or
   Unlock activity) as well as ordinary ones.
**Expected:** The evidence shows qualitative items only — never a numeric score, rank, or
percentage. ClickLog, Mood, GentlePulse, Unlock, and the Foundation seeker side are not surfaced;
member blocking and safety reports are never surfaced. A dispute **withholds** the clean-record
signal rather than producing a negative badge or a public dispute count.
**Result:** web ☐ — notes:

### TRUST-A3 · Admin verification status change
**Role:** admin / internal · **Surfaces:** web (internal surface)
**Precondition:** a target member with a `trust_user_extension` row (defaults apply on first read).
**Steps:**
1. As admin, call `POST /api/trust/admin/verification` to set a target's status to `verified`.
2. Repeat with `flagged`.
3. Attempt the same call as a plain member.
**Expected:** Admin sets the target's `trust_status` and appends one admin evidence item; bad input
(`targetUserId` / `trustStatus`) returns 400. The plain-member attempt is denied
(`requiredRoles: ['admin']`). Every change is CSRF-guarded and written to
`trust_admin_audit_trail`. The snapshot route never changes `trust_status` — only this route does.
**Result:** web ☐ — notes:

### TRUST-A4 · Visibility controls a cross-user read
**Role:** admin / internal (plus a second member account) · **Surfaces:** web (internal surface)
**Steps:**
1. As member A, set visibility via `POST /api/trust/visibility` to `private`.
2. As member B (not admin, not the owner), read `GET /api/trust/user/[A's id]`.
3. Read the same as an admin.
**Expected:** `public` is readable by any authenticated, unlocked member; `private`/`restricted`
are readable only by the owner or an admin, and a blocked viewer gets `403`. A target with no
extension row defaults to `public`. The visibility update accepts only the three values (others
return 400), is CSRF-guarded, and writes an audit row.
**Result:** web ☐ — notes:

---

## Parity check (web ↔ android)

Trust has no member-facing android surface of its own for this internal reputation/computation work
— there is no web ↔ android parity row to check here. (A member-facing android Trust widget exists
that reads `GET /api/trust/user/self`; the internal computation and admin verification tested above
are web/server only.)

---

## Known gaps — do not file these as bugs

Carried from the inventory's "Gaps and Known Technical Debt" section. If you hit one of these, it is
already tracked, not a new bug:

- Trust evidence is rendered from a structured JSONB field on `trust_user_extension`; no rich-text
  schema or attachment storage contract has been published.
- No automated/scheduled refresh job exists — recompute is on-demand via the snapshot route (and
  on a member's own self-read).
- The model counts engagement but does not expose a `member_since` or active-plugin-count signal;
  those design fields stay omitted until a backing source is wired.
