# Plugin Profile and Deletion Contracts Index

This index is the Rule 114 baseline artifact map for coding readiness. Every API surface under
`ctf/packages/web/app/api/` must have a profile-and-deletion contract (and the command, access-policy
and audit contracts beside it) or a recorded reason in `ctf/scripts/contract-coverage-allowlist.json`;
`ctf/scripts/check-contract-coverage.mjs` fails CI otherwise (job `contract-coverage-gate`). The
behavior each contract describes is executed by `ctf/packages/web/lib/account/deletion-registry.ts`.

| Plugin inventory slug | Profile/deletion contract | Status |
| --- | --- | --- |
| `announcements` | `ctf/docs/contracts/ANNOUNCEMENTS_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `beacon` | `ctf/docs/contracts/BEACON_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `bug-reporting` | `ctf/docs/contracts/BUG_REPORTING_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `chyme` | `ctf/docs/contracts/CHYME_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `click-log` | `ctf/docs/contracts/CLICK_LOG_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `comic` | `ctf/docs/contracts/COMIC_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `contributions` | `ctf/docs/contracts/CONTRIBUTIONS_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `contributor-access` | `ctf/docs/contracts/CONTRIBUTOR_ACCESS_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `directory` | `ctf/docs/contracts/DIRECTORY_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `feed` | `ctf/docs/contracts/FEED_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `fireside` | `ctf/docs/contracts/FIRESIDE_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `foundation` | `ctf/docs/contracts/FOUNDATION_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `gross-domestic-product` | `ctf/docs/contracts/GDP_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `lighthouse` | `ctf/docs/contracts/LIGHTHOUSE_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `member-blocks (non-plugin §1.6)` | `ctf/docs/contracts/MEMBER_BLOCKS_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `mood` | `ctf/docs/contracts/MOOD_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `mutual-time` | `ctf/docs/contracts/MUTUAL_TIME_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `notifications` | `ctf/docs/contracts/NOTIFICATIONS_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `peer-programming` | `ctf/docs/contracts/PEER_PROGRAMMING_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `quora-deletion-survey` | `ctf/docs/contracts/QUORA_DELETION_SURVEY_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `quora-live-census` | `ctf/docs/contracts/QUORA_LIVE_CENSUS_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `recurring-activity` | `ctf/docs/contracts/RECURRING_ACTIVITY_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `service-credits` | `ctf/docs/contracts/SERVICE_CREDITS_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `skill-up` | `ctf/docs/contracts/SKILL_UP_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `skills-hunt` | `ctf/docs/contracts/SKILLS_HUNT_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `skills-taxonomy` | `ctf/docs/contracts/SKILLS_TAXONOMY_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `socket-relay` | `ctf/docs/contracts/SOCKET_RELAY_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `ti-radio` | `ctf/docs/contracts/TI_RADIO_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `trust` | `ctf/docs/contracts/TRUST_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `trust-transport` | `ctf/docs/contracts/TRUST_TRANSPORT_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `unlock` | `ctf/docs/contracts/UNLOCK_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `weekly-performance` | `ctf/docs/contracts/WEEKLY_PERFORMANCE_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `what-works` | `ctf/docs/contracts/WHAT_WORKS_PROFILE_AND_DELETION_CONTRACT.md` | Present |
| `workforce` | `ctf/docs/contracts/WORKFORCE_PROFILE_AND_DELETION_CONTRACT.md` | Present |

Surfaces with no deletion contract by recorded decision, and where the decision is written down:

| Surface | Where the decision is recorded |
| --- | --- |
| `presence` (member presence index) | `ctf-member-presence-feature-inventory.md`; its one table is in the registry under `presence`. |
| `reader` | `ctf-reader-feature-inventory.md`; it stores nothing. |
| `account`, `admin`, `internal`, `webhooks`, `health`, `plugin`, `plugins`, `currencies` | Platform machinery, each with its reason in `ctf/scripts/contract-coverage-allowlist.json`. |
