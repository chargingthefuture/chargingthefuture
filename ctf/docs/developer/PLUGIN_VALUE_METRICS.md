# Per-Plugin Value Metrics — Decision Record

> **Status: decisions in progress (owner + agent working session, 2026-07-18).** This document is the
> single source for each plugin's **defining metric of success** — the event that means the plugin is
> being used as intended. Two consumers will read it once settled: the **Weekly Performance rebuild**
> (the dashboard shows these instead of the current near-useless set) and the **gated-channel
> eligibility engine** (see `TRUSTED_CHANNELS_AND_CONTRIBUTOR_BADGE_PROPOSAL.md`). Nothing in this
> file is implemented yet. **All rows are now owner-locked (2026-07-18)** — the metrics pass is
> complete; what remains is implementation in the blocked order at the bottom.

## Principles (owner-confirmed)

- **Value = the plugin's core value-action, not logins or presence.** Logins are downstream of value
  (an active user is "someone who books," not "someone who logs in") and carry no positive weight.
- **Count each value event once, in its originating plugin.** A Chyme tip is a ServiceCredits
  transfer under the hood; per-plugin metrics must be mutually exclusive so totals never
  double-count. The GDP recognition model (distinct recognition sources, fixed weights) is the
  reference.
- **Plugins with no value-to-others action are NOT forced into a value metric.** They get an honest
  coverage/adoption/engagement metric instead — or none.
- **Weekly Performance today mis-measures or omits nearly everything** (only logins, feed counts,
  mood, and SkillUp *enrollments started* — the wrong end). The rebuild replaces that set with the
  table below.

## Value-delivered metrics (drive the dashboard AND gating)

| Plugin | Defining value event | Grounding (real data) | Status |
|---|---|---|---|
| Foundation | **An answered, charged 1:1 call — only.** Message exchange does NOT count (too easy to game). Completed quotes are not tracked as an event today; either add tracking later or members record the ongoing arrangement in Recurring Activity — undecided, so calls are the sole Foundation signal for now. **Private:** feeds gating math but is never a public number (rule 132, sensitive wellbeing/payment). | `foundation_call_sessions` where `ring_status='answered' AND blocks_charged > 0` | **Locked** |
| SocketRelay | A request **closed as successful** by the requester | `socket_relay_fulfillments` closed with `close_reason='successful'` | **Locked** |
| TrustTransport | A trip **both sides confirmed complete** | `trust_transport_trips` with both completion confirmations | **Locked** |
| Lighthouse | A stay **completed** (not merely accepted — accepted is a leading indicator, not delivered value) | `lighthouse_matches.status='completed'` | **Locked** |
| Chyme | A **peer tip** in ServiceCredits to another participant | transfers with `origin_plugin='chyme'`, sender ≠ recipient | **Locked** |
| ServiceCredits | A **completed direct peer send** (excludes mints, treasury, and plugin-mediated transfers — those count in their originating plugins) | `service_credits_transfers` `status='completed'` AND `origin_plugin='service-credits'` | **Locked** |
| Contributions | A **confirmed contribution** (real dollars). Counts as "supported the platform" — a different flavor than member-to-member aid; its gating weight is a later owner call. | `contributions_submissions` `status='confirmed'`, `confirmed_amount_usd` | **Locked** |
| SkillsHunt | A nomination a moderator **accepted** (produces a real Directory profile + reward) | `skills_hunt_submissions.status='accepted'` | **Locked** |
| WhatWorks | An **approved tool contributed** (primary — lasting resource) and an **endorsement given** (secondary) | `what_works_products.status='approved'` by `suggested_by`; `what_works_endorsements` | **Locked** |
| SkillUp | A **completed enrollment** + released trainer payout. (Fixes Weekly Performance, which currently counts enrollments *started* — intent, not delivered value.) | `skill_up_enrollments.status='completed'`; `skill_up_disbursements` trainer payouts | **Locked** |
| Recurring Activity | A tie the counterparty **confirmed active**, measured as **distinct counterparties** (anti-collusion) | `recurring_activities.status='active'`, distinct counterparty count | **Locked** |
| PeerProgramming | **Distinct members who posted in their cohort.** Participation is the plugin's purpose — but it weighs **low** for gating (contribution to a group, not aid to a person). | `peer_programming_messages` distinct authors | **Locked** |
| Beacon | **Broadcast completion does NOT count — only the owner can start a session** (an admin action measures the admin, not members; no session has even run yet). Member value = **engagement per unique broadcast**: upvotes/reactions/comments, counted **at most once per member per broadcast** (so 100 comments on one broadcast count once). | Grounded via the broadcast's Commons replay post: `beacon_events.commons_recording_post_id` → `feed_community_post_reactions` / `feed_community_replies`. Live in-event chat/reactions are Stream-ephemeral and are NOT countable today — if in-event engagement should count, it needs persisting first. | **Locked** |

## Honest non-value metrics (dashboard only — never gating fuel)

These plugins have no member value-to-others action (owner-confirmed). They are measured honestly,
not forced into a value frame. Per owner direction, **Directory, Mood, and ClickLog must appear in
Weekly Performance** with the metrics below.

| Plugin | Weekly Performance metric | Grounding | Status |
|---|---|---|---|
| Directory | **Coverage:** claimed, active profiles with ≥1 skill (findable members), plus growth over the window | `directory_profiles` claimed + active + non-deleted, joined to ≥1 `directory_profile_skills` | **Locked (in WP)** |
| Mood | **Adoption:** check-ins per window + community average (already computed today — keep). Aggregate only, never per-member. | `mood_submissions` count, `AVG(mood_value)` | **Locked (in WP)** |
| ClickLog | **Adoption, aggregate only:** incidents logged per window + distinct members logging. Never per-member detail on the dashboard — it is a private personal tally. | `click_log_incidents` count + distinct `user_id` count | **Locked (in WP)** |
| GentlePulse | **None — no Weekly Performance stats** (owner ruling) | — | **Locked (absent)** |
| Skills Taxonomy | **None — no Weekly Performance stats** (owner ruling) | — | **Locked (absent)** |
| Workforce | **People recruited, week over week, toward the 2,000,000-recruited goal.** Workforce aids in reaching the GDP goal; its dashboard row shows recruited count + weekly delta + progress toward 2M. | `workforce_recruited_current_count` (registry; derived from active Directory profiles) | **Locked (in WP)** |
| GDP | **Community Value Index, week over week, toward the $300B goal.** The goal is reaching 300B in community value; the dashboard row shows the index + weekly delta + progress toward 300B. (The index is an estimate, never money/price — keep the existing honest framing.) | `gdp_value_index` (registry; `buildLiveGdpReport`) | **Locked (in WP)** |

## What happens next (blocked order)

1. Register the locked metrics in the canonical metric registry (`ctf/config/canonical_metrics.yaml`,
   rule 121) — most value events are not registered today.
2. Rebuild Weekly Performance around this table: replace the current metric set; fix SkillUp to
   completion; add Directory/Mood/ClickLog rows; add the two goal rows (GDP Community Value Index
   week-over-week toward $300B, Workforce recruited week-over-week toward 2,000,000); drop
   GentlePulse and Skills Taxonomy entirely; respect the Foundation privacy constraint.
3. Only then: the gating eligibility engine consumes the value table with owner-set weights — the
   admission bar is deliberately high (owner directive; see the trusted-channels proposal).
