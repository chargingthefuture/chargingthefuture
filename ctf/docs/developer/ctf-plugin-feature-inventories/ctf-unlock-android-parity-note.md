Android parity: unlock

In-progress: implement mobile parity items for unlock. Refer to checklist: ctf/docs/developer/ctf-plugin-feature-inventories/ctf-unlock-feature-inventory.md

Work started by agent. Will add UI mocks and tests in follow-up commits.

Deferred parity items:
- Early Commons access experiment (web shipped 2026-06-26): the mobile `UnlockStatus` type mirrors the
  `earlyCommonsAccess` flag, but the mobile Unlock screen does not yet show the "Ask in the Commons"
  help link, and mobile landing/routing for a treatment-bucket member is not yet wired to the mobile
  Commons surface. The server-side access change (support-only widening for the treatment bucket)
  already applies to mobile API calls; only the mobile UI/navigation is deferred.
