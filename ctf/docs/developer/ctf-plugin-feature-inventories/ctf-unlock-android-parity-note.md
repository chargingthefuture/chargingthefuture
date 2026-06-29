Android parity: unlock

In-progress: implement mobile parity items for unlock. Refer to checklist: ctf/docs/developer/ctf-plugin-feature-inventories/ctf-unlock-feature-inventory.md

Work started by agent. Will add UI mocks and tests in follow-up commits.

Completed parity items:
- Early Commons access experiment (web shipped 2026-06-26; Android parity 2026-06-29, #1034): the
  mobile Unlock submission and status screens now show the "Trouble finding your Quora URL? Ask in the
  Commons" link for treatment-bucket members only (gated on the `earlyCommonsAccess` status field),
  tapping it to the Hub home (Commons). Mobile landing/routing already admits a treatment-bucket member
  to the Commons: the App.tsx unlock gate passes `locked_support_only` through to the navigator, which
  lands on `HubHome`, so no separate routing change was needed. The server-side support-only widening
  was already applied to mobile API calls.
