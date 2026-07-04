# Recurring Activity — Manual Test Script

> Walk these steps on a real device to confirm the plugin works end to end. This script is the
> runnable counterpart of the plugin's feature inventory and contracts — those files are the source
> of truth. Do not edit a step here to match a bug; fix the code (or the inventory) and regenerate
> (`pnpm --dir ctf test-script:generate -- recurring-activity`).

| Field | Value |
|---|---|
| Slug | `recurring-activity` |
| Visibility | member |
| Roles to test | member |
| Seed | `pnpm --dir ctf seed:recurring-activity` |
| Web | `/apps/recurring-activity` (+ the "ongoing activities" card in the account hub) |
| Android | Recurring Activity screen (registered in `App.tsx`) |

## Setup

1. Seed demo data: `pnpm --dir ctf seed:recurring-activity`. This creates one confirmed fiat housing
   tie (USD, no amount), one confirmed ServiceCredits service tie (50 SC/month), and one pending fiat
   favor tie.
2. Sign in as an approved member.

## Member — web (desktop and mobile-responsive at 390px)

1. Open `/apps/recurring-activity`. Confirm the hub loads (loading → populated), and that an empty
   account shows a calm empty state, not an error.
2. **Create an activity.** Pick a counterparty from the member picker (it searches the directory and
   commits a real member — there is no free-text member entry). Choose a sector (Housing / Service /
   Favor / General), a currency, and a cadence. Confirm:
   - There is **no note / description free-text field anywhere** — the sector dropdown is the only
     "description."
   - The ServiceCredits value field appears **only** when the selected currency is ServiceCredits,
     and is hidden for every fiat currency.
   - After saving, the new activity shows as **pending** and one calm line appears — "This is part of
     what the community builds together." No "you owe", no amount due, no red/warning styling
     anywhere.
3. **Confirm flow (two-sided).** Sign in as the counterparty of a pending activity. Confirm you can
   **Confirm** or **Decline** it, and that only the counterparty (not the owner) sees those actions.
   After confirming, the activity reads as ongoing/active.
4. **End flow.** As either party of an active activity, end it. Confirm it moves to ended and stops
   being ongoing.
5. **Visibility.** As the owner of an activity, change its visibility (private / members only /
   public). Confirm the control is owner-only and defaults to private.
6. Repeat the create/confirm/end walkthrough at a 390px-wide viewport; confirm the mobile-responsive
   layout (header + scroll) works and nothing overflows.

## Member — Android

1. Open the Recurring Activity screen. Confirm loading / error / empty / populated states.
2. Confirm you can view activities, confirm/decline a pending invitation where you are the
   counterparty, and end an active one — matching the web behavior. The ServiceCredits value field
   appears only for ServiceCredits.

## Cross-plugin effects (spot-check)

1. **GDP:** after confirming activities, run `pnpm --dir ctf gdp:recognize`; a confirmed fiat activity
   moves the Community Value Index by count, a confirmed ServiceCredits activity by its declared
   value, and a pending activity moves nothing. See the GDP test script for detail.
2. **Trust:** a member with confirmed activities gains the evidence item "Ongoing activities with N
   community members" (distinct counterparties). See the Trust test script for detail.

## Known limitations (do not file as bugs)

1. **Contextual create prompts not yet embedded.** The intended primary entry point — a one-tap "Is
   this ongoing?" prompt inside LightHouse / Foundation / SocketRelay / ServiceCredits — is a
   documented follow-up; v1 ships the standalone hub + account-hub card. Creating from the hub is the
   supported path for now.
2. **Fiat lines never carry an amount, by design.** There is no field to enter a fiat amount — only
   ServiceCredits carries a value. This is the liability firewall, not a missing feature.
3. **Cadence is not normalized** for the ServiceCredits value contribution to GDP (a weekly 50 SC and
   a monthly 50 SC both contribute 50). The figure is a labeled estimate; normalization is a
   follow-up.
4. **No admin surface.** There is no admin screen yet; the audit trail supports a future
   collusion-review view.
