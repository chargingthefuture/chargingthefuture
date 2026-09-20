# Chyme guest listener — server-side listen-only (Stream call-type role)

This is the one-time Stream configuration that makes signed-out **guest** listeners truly
listen-only, closing the gap where a guest could extract their own token and publish audio to the
live room. Until this is applied, listen-only is enforced only on the client (the guest UI joins
muted with no speak controls), which a determined guest can bypass.

The code half ships in `ctf/packages/web/lib/chyme/stream.ts`: when the `CHYME_GUEST_STREAM_ROLE`
environment variable is set, every guest Stream user is created with that role. The variable is read
at request time, so the code change does nothing until the role and the call-type grants below exist
and the variable is set — making it safe to deploy in any order, then switch on.

This role also carries Chyme's hand-raise mode, as of 2026-09-19: when an admin moves a member to
listening, that member is given the same role on the call. So the role is no longer guests only, and
the two uses want exactly the same grants — join and hear, never publish. See "What hand-raise mode
adds" below.

## What to configure in the Stream app — run the workflow

The Stream side is owned by code: `ctf/scripts/stream-guest-listener-setup.mjs`, run by the
**"Stream — Guest Listener Setup"** workflow (`.github/workflows/stream-guest-listener-setup.yml`).
It reads the Stream key pairs and `CHYME_GUEST_STREAM_ROLE` from Infisical and brings the app to the
target state through Stream's APIs:

1. The role named by `CHYME_GUEST_STREAM_ROLE` exists in the app (roles are app-wide, shared by Chat
   and Video).
2. On the `default` Video call type, that role has `join-call` and `read-call`, does **not** have
   `send-audio`, `send-video` or `screenshare`, and keeps anything else it already had.

No other role changes: the `default` call type's member roles (the `user` role a speaker holds) are
never touched. The named role is the one a guest carries, and the one a member carries while an
admin has them listening in hand-raise mode.

**From the browser (works on a phone):** Actions tab → "Stream — Guest Listener Setup" → Run
workflow.

- **plan** (the default) reads everything and prints the state and what apply would change. Writes
  nothing. Run this first.
- **apply** writes what is missing and reads it back; the run goes red if the read-back is still
  short.
- **check** is what the weekly schedule runs (Tuesdays 05:52 UTC, production): the same read as
  plan, but the run goes red when anything has drifted from the target state — so a half-done or
  undone setup is caught before a member reports it.

"target" picks the Stream app: production (default), staging (the demo app, so demo guests are
listen-only too), or both.

It takes effect on the next page load — Stream checks the role at join time — so no redeploy is
needed. The script never prints a secret, and scrubs the api key from any Stream error text.

## What hand-raise mode adds (2026-09-19)

Chyme's moderation controls shipped a second use for this same role. A room is in open mic (every
joiner may speak, the default) or hand-raise mode, where a joiner listens until an admin lets them
speak. The app records the decision in its own tables; the call-side half gives the listening member
this role through `updateCallMembers`, and gives a member let back on stage Stream's default `user`
role. That code is `setCallMemberRole` in `ctf/packages/web/lib/chyme/stream-moderation.ts`.

Nothing extra to configure: a listening member wants exactly what a guest wants — join and hear,
never publish — so the target state above already serves both, and the workflow's **check** mode
covers both. What changed is the blast radius of a drift: a missing `join-call` now also drops a
member an admin moved to listening, and a `send-audio` added back by hand would let both a guest and
a listening member publish.

With `CHYME_GUEST_STREAM_ROLE` unset, hand-raise mode still works — the web and Android apps hide
the microphone control and turn the microphone off — but a member who drives the Stream client
directly could publish anyway, the same client-only enforcement guests had before this role existed.

**If Infisical is unreachable.** Every Infisical-backed workflow has failed with
"Application not found" since 2026-09-10 — the self-hosted instance on Railway is not answering (tracked in the ci-health issue #2030).
The workflow then falls back to the GitHub Actions secrets `STREAM_API_KEY` and
`STREAM_API_SECRET` (repository Settings → Secrets and variables → Actions; copy the values from
the Stream dashboard's API keys page, which does work on a phone), and takes the role name from the
**role** input — set it to `chyme_listener`. The log says which store each value came from. Rule
123 allows GitHub Actions as a deliberate second store; Infisical stays the source of truth, and
the fallback is only read when Infisical set nothing.

**The dashboard is the fallback, not the record.** If the workflow cannot run, the same two steps
by hand are: create the role (Roles & Permissions), then Video & Audio → Call types → `default` →
Permissions → the role's column → allow Join Call and Read Call, leave the three publish
capabilities off. The dashboard does not work at phone width. Whatever was done by hand, run the
workflow in **check** mode afterwards to confirm the state.

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

A speaking member is unaffected, which is why it can go unnoticed: a host in the room sees a normal
live room while no visitor can hear it. Since 2026-09-19 the same missing grant also breaks
hand-raise mode, where a member an admin moved to listening holds this role: they are dropped from
the call instead of listening quietly. Two ways out, either one restores listening:

- **Run "Stream — Guest Listener Setup" with mode apply** (above). This is the intended end state:
  guests can hear, and still cannot publish. The weekly check run exists so this cannot go
  unnoticed again.
- **Unset `CHYME_GUEST_STREAM_ROLE`** in Infisical. Guests go back to the default role and
  client-only enforcement, as under "Turn it on" above.

## Notes

- The role name in the env var is the one the workflow creates and grants, so the two cannot drift
  apart as long as the workflow is what sets Stream up. If the name in Infisical is changed, run the
  workflow again: it creates and grants the new name (the old role is left in place, unused).
- This does not change member moderation. The broader "request to speak / host grant" flow for
  members is still unbuilt (tracked in the Chyme inventory Gaps).
