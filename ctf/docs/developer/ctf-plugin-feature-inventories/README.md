# CTF Plugin Feature Inventories

This folder holds one living feature inventory per plugin in the v3 app under `ctf/`.

## Single-document model

Each plugin has **one** combined document. The build checklist lives inside the
inventory as a `## Build Checklist` section (no separate checklist file). Machine-validated
contract files (`{PLUGIN}_PLUGIN_COMMAND_CONTRACTS.yaml`, `..._ACCESS_POLICY_CONTRACTS.yaml`,
`..._AUDIT_CONTRACTS.yaml`) stay separate under `ctf/docs/contracts/`.

## Naming convention

- Inventory (with embedded build checklist): `ctf-{plugin-slug}-feature-inventory.md`

Examples:

- `ctf-directory-feature-inventory.md`
- `ctf-socket-relay-feature-inventory.md`
- `ctf-workforce-feature-inventory.md`

## Current inventories

- [CTF plugin coding readiness matrix](./ctf-plugin-coding-readiness-matrix.md)
- [Chyme](./ctf-chyme-feature-inventory.md)
- [TrustTransport](./ctf-trust-transport-feature-inventory.md)
- [Feed](./ctf-feed-feature-inventory.md)
- [Announcements](./ctf-announcements-feature-inventory.md)
- [comic (AI assistant in the Feed/Hub chat)](./ctf-comic-feature-inventory.md)
- [Directory](./ctf-directory-feature-inventory.md)
- [Foundation](./ctf-foundation-feature-inventory.md)
- [PeerProgramming](./ctf-peer-programming-feature-inventory.md)
- [Gross Domestic Product](./ctf-gross-domestic-product-feature-inventory.md)
- [ServiceCredits](./ctf-service-credits-feature-inventory.md)
- [LevelUp](./ctf-level-up-feature-inventory.md)
- [SkillsHunt](./ctf-skills-hunt-feature-inventory.md)
- [Workforce](./ctf-workforce-feature-inventory.md)
- [Mood](./ctf-mood-feature-inventory.md)
- [SocketRelay](./ctf-socket-relay-feature-inventory.md)
- [Weekly Performance](./ctf-weekly-performance-feature-inventory.md)
- [Skills Taxonomy](./ctf-skills-taxonomy-feature-inventory.md)
- [Unlock](./ctf-unlock-feature-inventory.md)

Legacy reference inventories remain in `ctf/docs/developer/legacy-inventories` and should include `(Legacy Reference)` in the title.
