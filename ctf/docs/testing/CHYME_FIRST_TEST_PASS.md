# Chyme Validation and Release Evidence

Updated: 2026-04-05

## Scope

- Applies to the Chyme rewrite under `ctf/` only.
- Uses `ctf/schema.sql` as the canonical schema source.
- Covers web and Android parity on the same protected API surface.

## Required Environment

- `DATABASE_URL`
- `STREAM_API_KEY`
- `STREAM_API_SECRET`
- `MOBILE_APP_URL`
- `MOBILE_CTF_USER_ID`
- `MOBILE_CTF_USERNAME`
- `MOBILE_CTF_USER_ROLE`
- `MOBILE_CTF_USER_APPROVED`

## Canonical Schema and Seed Flow

Run from `ctf/`:

- `pnpm run migrate:schema`
- `node ./scripts/seedChyme.mjs`

Expected Chyme tables:

- `chyme_rooms`
- `chyme_service_profiles`
- `chyme_room_members`
- `chyme_messages`
- `chyme_deletion_events`

Expected downstream dependency tables touched by full-account delete:

- `service_credits_account_deletion_reclaims`
- `service_credits_adapter_outbox`

## Local Quality Gates

Run from `ctf/`:

- `pnpm --filter @ctf/shared typecheck`
- `pnpm --filter @ctf/web lint`
- `pnpm --filter @ctf/web typecheck`
- `pnpm --filter @ctf/mobile lint`
- `pnpm --filter @ctf/mobile typecheck`
- `pnpm --filter @ctf/mobile build:android:ci`

## Functional Validation

### Room bootstrap

- Open Chyme on web.
- Open Chyme on Android.
- Expected:
  - deterministic room loads,
  - participant row is upserted,
  - non-approved non-admin identities receive denial.

### Chat send and read

- Send a message on web.
- Refresh/read on Android.
- Expected:
  - message persists in `chyme_messages`,
  - message appears on both surfaces,
  - empty/oversized payloads are rejected.

### Join flow

- Trigger `Join Call` on web and Android.
- Expected:
  - `POST /api/chyme/join` returns Stream credentials,
  - room state flips `call_active=true`,
  - Stream credentials are issued through the shared adapter path.

### Service delete

- Trigger `DELETE /api/account/chyme-profile`.
- Expected:
  - `chyme_service_profiles.status='deleted'`,
  - current user member/message rows are removed,
  - service deletion event is recorded.

### Full-account delete

- Trigger `DELETE /api/account/full-account`.
- Expected:
  - account-scope row is recorded in `chyme_deletion_events`,
  - dependency row is inserted into `service_credits_account_deletion_reclaims`,
  - outbox row is inserted into `service_credits_adapter_outbox`,
  - response status remains `requested` until external orchestrator completion.

## Notes

- Chyme currently uses Stream-backed join credentials and shared Stream message fan-out; broader account-deletion terminal states remain outside the plugin.
- Android parity depends on runtime-configured provider-neutral identity headers, not a separate mobile-only mock path.