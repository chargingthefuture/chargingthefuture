# Spec — Platform-Wide Account Restriction Signal

Status: owner-approved, built · Created: 2026-06-15 · Issue: #528
Type: cross-cutting auth + schema + plugin-migration work.

## Why

Restriction was fragmented: TrustTransport kept `trusttransport_user_extension.account_restricted` (checked
only in its `createRequest`), and ServiceCredits kept `service_credits_wallets.is_frozen` (checked only in
its transfer path). A bad actor restricted in one plugin was free in the others. This spec makes one
canonical signal that every value-moving and contact-initiating surface honors.

## Owner-locked decisions (2026-06-15)

1. **Scoped, not binary.** A restriction carries a scope: `all` (full account block — every product route,
   enforced in the auth gate), `trading` (value movement — ServiceCredits transfers, TrustTransport
   requests/payouts), or `contact` (initiating matches/connections). This keeps the existing wallet-freeze
   nuance (spending-only) and lets the operator restrict narrowly or fully.
2. **Migrate the existing flags to the shared signal.** TrustTransport and ServiceCredits now read and write
   the shared signal; their per-plugin columns are retired in code and backfilled into the canonical table.

## Data model (`ctf/schema.sql`)

```sql
CREATE TABLE account_restrictions (
  user_id TEXT PRIMARY KEY,
  is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  restriction_scope TEXT NOT NULL DEFAULT 'all' CHECK (restriction_scope IN ('all','trading','contact')),
  restricted_at TIMESTAMPTZ, restricted_by_user_id TEXT, restriction_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE account_restrictions_audit ( id, actor_id, action ('restrict'|'unrestrict'), target_user_id, scope, reason, metadata, created_at );
```

The table is defined at the **end** of `schema.sql` so the per-plugin tables it backfills from already exist.
The backfill (from `trusttransport_user_extension.account_restricted` and `service_credits_wallets.is_frozen`,
both mapped to `trading` scope) uses `ON CONFLICT (user_id) DO NOTHING`, so re-running never re-restricts a
member whose canonical row already exists (e.g. after an operator lifts a restriction).

## Coverage rule

A restriction with stored scope `S` blocks an attempted action of scope `A` **iff `S === 'all'` or
`S === A`**. So an `all` restriction blocks everything; a `trading` restriction blocks trading (and is
ignored by the auth gate's `all`-scope check); a `contact` restriction blocks contact only.

## Enforcement

- **Auth gate** (`lib/auth/server-authz.ts`): after the Unlock tier check, a non-admin with an `all`-scope
  restriction is denied (`AUTH_FORBIDDEN_POLICY` / reason `account_restricted`). **Skipped** for admins and
  for `any_authenticated` routes (account/profile/deletion, Unlock status), so a restricted member can still
  see their status and manage or delete their own data — humane by design.
- **ServiceCredits transfer** (`createTransfer`): blocks when the sender has an `all` or `trading`
  restriction (replaces the old `is_frozen` check); throws `account_restricted` → 403.
- **TrustTransport `createRequest`** (`ensureUserNotRestricted`): blocks on `all`/`trading`.

The helper is `getAccountRestrictionStatus(userId, actionScope)` in `lib/auth/account-restrictions.ts`;
`restrictAccount(...)` / `unrestrictAccount(...)` upsert and write an audit row.

## Migration of existing flags

- ServiceCredits `setWalletFrozen` now calls `restrictAccount(..., scope: 'trading')` / `unrestrictAccount`;
  `getCreditLimitInfo`'s `frozen` reads the shared signal. The `/admin/wallet-status` endpoint and the web +
  Android freeze UI are unchanged — they now drive the shared signal.
- TrustTransport `restrictAccount` / `restoreAccount` write the shared signal (scope `trading`) and keep
  their TrustTransport-specific `trusttransport_risk_signals` evidence rows.
- The retired columns (`trusttransport_user_extension.account_restricted` and friends,
  `service_credits_wallets.is_frozen` and friends) are left in place (no destructive `DROP`) but are no
  longer read or written in code; backfilled into the canonical table.

## Admin surface

Platform-level, admin-gated, CSRF-protected:
- `POST /api/admin/account-restrictions/restrict` ← `{ targetUserId, reason?, scope? }` (scope default `all`)
- `POST /api/admin/account-restrictions/unrestrict` ← `{ targetUserId }`
- `GET  /api/admin/account-restrictions/audit` → recent restrict/unrestrict entries

## Open considerations

- **Deletion handling**: `account_restrictions` is platform-core (not plugin-scoped), so it is not in the
  per-plugin account-deletion registry yet. The audit table is the retained compliance record; wiring the
  live restriction row into the full-account deletion sweep is a small follow-up.
- **Contact scope**: the `contact` scope exists in the model and admin API but is not yet enforced at any
  contact point (LightHouse matches, Foundation connections, etc.) — a follow-up to add those checks.
- **Admin UI**: this PR ships the API; a web/mobile admin screen to drive restrict/unrestrict/audit is a
  follow-up (the ServiceCredits wallet-freeze UI already drives the `trading` scope today).
