# Chyme guest listener — server-side listen-only (Stream call-type role)

This is the one-time Stream configuration that makes signed-out **guest** listeners truly
listen-only, closing the gap where a guest could extract their own token and publish audio to the
live room. Until this is applied, listen-only is enforced only on the client (the guest UI joins
muted with no speak controls), which a determined guest can bypass.

The code half ships in `ctf/packages/web/lib/chyme/stream.ts`: when the `CHYME_GUEST_STREAM_ROLE`
environment variable is set, every guest Stream user is created with that role. The variable is read
at request time, so the code change does nothing until the role and the call-type grants below exist
and the variable is set — making it safe to deploy in any order, then switch on.

Members are unaffected: only the anonymous guest identity (`chyme-guest-…`) gets the restricted role.

## What to configure in the Stream app

Do this in the **production** Stream app (the one behind `STREAM_API_KEY` / `STREAM_API_SECRET`) and,
if you record demos, the **demo** app (`STREAM_API_KEY_STAGING` / `STREAM_API_SECRET_STAGING`) too —
otherwise demo guests stay client-only.

1. **Create a role** named `chyme_listener` (Stream dashboard → Roles & Permissions, or the RBAC API).
2. **Edit the `default` Video call type's grants** for `chyme_listener` so it can join and hear the
   room but cannot publish:
   - **Keep** (so the guest can connect and receive audio): `join-call`, `read-call`,
     `create-call` is **not** needed, `send-event` optional, plus the default
     connect/subscribe capabilities.
   - **Remove** (so the guest cannot speak): `send-audio`, `send-video`, `screenshare`
     (and any `start-*` broadcast/record capabilities).
3. Leave the member roles (`user` / `admin` / host) on the `default` call type unchanged — members
   must still publish audio.

## Turn it on

Set the secret in Infisical (the single source of truth), `production` environment:

```
CHYME_GUEST_STREAM_ROLE = chyme_listener
```

After it is set, new guest tokens carry the `chyme_listener` role and Stream blocks publish at the
API level. Verify by joining the live room as a guest and confirming the guest cannot send audio even
when driving the Stream client directly. To roll back, unset `CHYME_GUEST_STREAM_ROLE` — guests revert
to the default role and client-only enforcement.

## How a missing grant shows up (seen in production, 2026-09-17)

If `CHYME_GUEST_STREAM_ROLE` is set but step 2 above was not completed — the role exists, the
`default` call type does not grant it `join-call` — every signed-out listener is locked out. The
guest identity is minted fine (the role exists, so the upsert succeeds), so the public page shows
the room as live, and then the join is refused. The page reads:

> Couldn't connect to the live room. Try refreshing.
> Stream error code 17: JoinCall failed with error: "User 'chyme-guest-…' with role
> 'chyme_listener' is not allowed to perform action JoinCall in scope 'video:default'"

Members are unaffected, which is why it can go unnoticed: a host in the room sees a normal live
room while no visitor can hear it. Two ways out, either one restores listening:

- **Finish step 2** in the Stream dashboard (production app → Video & Audio → the `default` call
  type → role `chyme_listener` → allow `join-call` and `read-call`). This is the intended end
  state: guests can hear, and still cannot publish.
- **Unset `CHYME_GUEST_STREAM_ROLE`** in Infisical. Guests go back to the default role and
  client-only enforcement, as under "Turn it on" above.

## Notes

- The role name in the env var must exactly match the role configured in Stream; a mismatch means
  Stream falls back to default behavior (or rejects the upsert), so keep them in sync.
- This does not change member moderation. The broader "request to speak / host grant" flow for
  members is still unbuilt (tracked in the Chyme inventory Gaps).
