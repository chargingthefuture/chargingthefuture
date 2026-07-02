Android parity: unlock

In-progress: implement mobile parity items for unlock. Refer to checklist: ctf/docs/developer/ctf-plugin-feature-inventories/ctf-unlock-feature-inventory.md

Work started by agent. Will add UI mocks and tests in follow-up commits.

Completed parity items:
- Early Commons access experiment (web shipped 2026-06-26; Android parity 2026-06-29, #1034): the
  mobile Unlock submission and status screens now show the "Trouble finding your Quora URL? Ask in the
  Commons" link for treatment-bucket members only (gated on the `earlyCommonsAccess` status field),
  tapping it to the Hub home (Commons). The server-side support-only widening was already applied to
  mobile API calls.
- Verify prompt on the mobile Commons (Android parity 2026-07-02, #1315): completed the mobile side of
  the web verify-prompt fix. The client Unlock gate in `App.tsx` now passes a treatment-bucket member
  (`earlyCommonsAccess`) through to the navigator (lands on `HubHome`) instead of walling them to the
  Unlock screen — correcting the earlier assumption that a treatment member was already admitted (they
  are tier `null`/`pending_readonly`, not `locked_support_only`, so they were in fact walled). A new
  `UnlockVerifyBanner` on `HubHome` prompts an unverified treatment member for their Quora URL inline
  (existing submission endpoint) with an "ask in the Commons" nudge, self-hiding for control/verified
  members. No backend/schema/contract change; inert until the Unleash rollout is enabled.
