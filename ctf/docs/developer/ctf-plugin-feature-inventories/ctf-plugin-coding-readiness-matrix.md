# CTF Plugin Coding Readiness Matrix

This matrix tracks coding-readiness status across CTF feature inventories and applies Rule 114 and Rule 120 governance decisions.

## Governance Decisions Applied

- Non-plugin inventory is Rule 120 exempt and is not a blocker for plugin coding readiness.
- Planned state is acceptable pre-implementation.
- Command/access/audit YAML contracts are required before PR merge/release, not before coding start.
- Rule 114 profile/deletion contract is required for all plugins before coding start.

| Inventory | Checklist | Rule120 Required Content | Rule114 Profile/Deletion Contract | Command/Access/Audit YAML | Migrations/Schema Drift Readiness | Coding Start Status | Blockers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ctf-announcements-feature-inventory.md` | `ctf-announcements-feature-inventory.md` | Present | `ctf/docs/contracts/ANNOUNCEMENTS_PROFILE_AND_DELETION_CONTRACT.md` | Present (`ANNOUNCEMENTS_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-chyme-feature-inventory.md` | `ctf-chyme-feature-inventory.md` | Present | `ctf/docs/contracts/CHYME_PROFILE_AND_DELETION_CONTRACT.md` | Present (`CHYME_*` YAML triplet) | Planned; checklist gate | Ready after baseline Phase -1 (Clerk → Railway → Vercel → Expo) | Awaiting fresh implementation dispatch |
| `ctf-directory-feature-inventory.md` | `ctf-directory-feature-inventory.md` | Present | `ctf/docs/contracts/DIRECTORY_PROFILE_AND_DELETION_CONTRACT.md` | Present (`DIRECTORY_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-feed-feature-inventory.md` | `ctf-feed-feature-inventory.md` | Present | `ctf/docs/contracts/FEED_PROFILE_AND_DELETION_CONTRACT.md` | Present (`FEED_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-foundation-feature-inventory.md` | `ctf-foundation-feature-inventory.md` | Present | `ctf/docs/contracts/FOUNDATION_PROFILE_AND_DELETION_CONTRACT.md` | Present (`FOUNDATION_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-gentle-pulse-feature-inventory.md` | `ctf-gentle-pulse-feature-inventory.md` | Present | `ctf/docs/contracts/GENTLE_PULSE_PROFILE_AND_DELETION_CONTRACT.md` | Present (`GENTLE_PULSE_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-gross-domestic-product-feature-inventory.md` | `ctf-gross-domestic-product-feature-inventory.md` | Present | `ctf/docs/contracts/GDP_PROFILE_AND_DELETION_CONTRACT.md` | Present (`GDP_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-lighthouse-feature-inventory.md` | `ctf-lighthouse-feature-inventory.md` | Present | `ctf/docs/contracts/LIGHTHOUSE_PROFILE_AND_DELETION_CONTRACT.md` | Present (`LIGHTHOUSE_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-mood-feature-inventory.md` | `ctf-mood-feature-inventory.md` | Present | `ctf/docs/contracts/MOOD_PROFILE_AND_DELETION_CONTRACT.md` | Present (`MOOD_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-non-plugin-feature-inventory.md` | `ctf-non-plugin-feature-inventory.md` | Exempt (non-plugin inventory) | N/A (non-plugin) | N/A (non-plugin) | Planned; checklist gate | Ready (Rule 120 exempt; non-blocking) | None |
| `ctf-peer-programming-feature-inventory.md` | `ctf-peer-programming-feature-inventory.md` | Present | `ctf/docs/contracts/PEER_PROGRAMMING_PROFILE_AND_DELETION_CONTRACT.md` | Present (`PEER_PROGRAMMING_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-service-credits-feature-inventory.md` | `ctf-service-credits-feature-inventory.md` | Present | `ctf/docs/contracts/SERVICE_CREDITS_PROFILE_AND_DELETION_CONTRACT.md` | Present (`SERVICE_CREDITS_*` YAML triplet) | Implemented in part; checklist gate | Ready | None for coding start |
| `ctf-skills-hunt-feature-inventory.md` | `ctf-skills-hunt-feature-inventory.md` | Present | `ctf/docs/contracts/SKILLS_HUNT_PROFILE_AND_DELETION_CONTRACT.md` | Present (`SKILLS_HUNT_*` YAML triplet) | Implemented in part; checklist gate | Ready | None for coding start |
| `ctf-skills-taxonomy-feature-inventory.md` | `ctf-skills-taxonomy-feature-inventory.md` | Present | `ctf/docs/contracts/SKILLS_TAXONOMY_PROFILE_AND_DELETION_CONTRACT.md` | Present (`SKILLS_TAXONOMY_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-socket-relay-feature-inventory.md` | `ctf-socket-relay-feature-inventory.md` | Present | `ctf/docs/contracts/SOCKET_RELAY_PROFILE_AND_DELETION_CONTRACT.md` | Present (`SOCKET_RELAY_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-trust-transport-feature-inventory.md` | `ctf-trust-transport-feature-inventory.md` | Present | `ctf/docs/contracts/TRUST_TRANSPORT_PROFILE_AND_DELETION_CONTRACT.md` | Present (`TRUST_TRANSPORT_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-weekly-performance-feature-inventory.md` | `ctf-weekly-performance-feature-inventory.md` | Present | `ctf/docs/contracts/WEEKLY_PERFORMANCE_PROFILE_AND_DELETION_CONTRACT.md` | Present (`WEEKLY_PERFORMANCE_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |
| `ctf-workforce-feature-inventory.md` | `ctf-workforce-feature-inventory.md` | Present | `ctf/docs/contracts/WORKFORCE_PROFILE_AND_DELETION_CONTRACT.md` | Present (`WORKFORCE_*` YAML triplet) | Planned; checklist gate | Ready | None for coding start |

## Release-Gate Backlog

No plugins are currently missing command/access/audit YAML triplets.

## Change Log

- 2026-02-25: Created initial coding readiness matrix with Rule 114 baseline and release-gate backlog.
- 2026-02-25: Added triplets for announcements, directory, feed, gentle-pulse, lighthouse, mood, socket-relay, trusttransport, and workforce; cleared release-gate backlog.
- 2026-02-25: Added Chyme inventory/checklist row and reopened release-gate backlog for missing `CHYME_*` command/access/audit triplet artifacts.
- 2026-02-25: Added `CHYME_PLUGIN_COMMAND_CONTRACTS.yaml`, `CHYME_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`, and `CHYME_PLUGIN_AUDIT_CONTRACTS.yaml`; cleared Chyme release-gate contract debt.
- 2026-03-01: Rebased Chyme readiness for fresh-start rewrite planning; removed implemented-baseline assumption and added mandatory baseline Phase -1 gate (Clerk → Railway → Vercel → Expo).
