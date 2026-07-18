# Proposal: Trusted Channels + Contributor Badge

> **Status: proposal — NOT built.** Owner-directed exploration, 2026-07-18. Nothing here ships until
> the owner approves it. A future agent reading this must not treat any of it as an existing feature.
> The open decisions at the bottom are still open.

## Why this exists

Commons is deliberately one channel with no direct messages: it makes spam easy to spot, blocks perps
from trolling people one-on-one, and its "provide material value before storytelling" norm filters
out most bad actors fast. This proposal keeps all of that and adds an **earned**, higher-feature space
for members who have shown, over time, that they are here to help — plus a way for members to
discover that space and want to reach it.

## Hard guardrails (do not violate)

- **No direct messages. Ever.** These channels are group spaces, never 1:1 inboxes.
- **No images in v1.** Image upload in a survivor community is a serious safety and legal risk (a
  patient perp or a compromised account can post illegal or targeting images). It is a separate,
  later decision that requires a moderation pipeline — never a free perk bundled into the tier.
- **No numeric trust score. No points, no tiers, no leaderboard, no ranking.** This stays consistent
  with the Trust plugin rule: standing is categorical, never a number.
- **No claim of verification or vetting.** The platform verifies no one's identity, background, or
  work. No surface may say "verified," "vetted," or "trusted by the platform."
- **The "material value first" norm still applies** inside these channels — they are not a
  pure-socializing lounge.

## 1. Trust eligibility (private, server-computed)

A single categorical decision per member: **eligible** or **not-yet**. It is computed on the server
and never shown as a number or a rank.

**Signals (all from data already stored):**

- **Account tenure** — a minimum account age.
- **Login consistency** (`auth_login_activity`) — weighted **low**, because it is the easiest signal
  to script.
- **Unlock status** — `approved_full`.
- **Participation breadth** — active in more than one plugin, not just one.
- **Counterparty diversity** — interacts/transacts with **many distinct** people over a window, not
  the same one or two. This is the strongest anti-collusion signal (it resists sockpuppet rings far
  better than raw volume) and is the owner's key idea.
- **Clean standing** — no active blocks or reports against the member.

**How the signals combine:** an owner-tunable rule (a threshold over weighted signals, or an explicit
set of minimums). Keep the exact formula server-side and adjustable **without a redeploy**, the same
way the single-open-cohort toggle and the trust snapshot already work.

**Cadence:** recomputed on a schedule (for example, alongside the trust snapshot), **not instantly**.
This prevents a "spike the signals then coast" gaming pattern.

**Earn and keep:** eligibility can lapse if the signals decay or a report lands, so behaviour stays
good inside the channel, not just at the door.

**Storage:** a computed eligibility flag plus a non-exposed reason snapshot. Reuse the Trust snapshot
infrastructure rather than building a second scoring system.

## 2. The gated channel (one, not many)

**One gated channel, not topic channels.** This is a correction from real evidence: the owner ran
several topic-based Signal groups, nobody adhered to the topics, they were folded into one group, and
a member said they preferred the single group. That result is not an anomaly — at low population there
is not enough traffic to keep several rooms alive, so topic-splitting produces dead channels while a
single general room is what actually gets used. The app already learned this twice: **Commons folded
to one channel**, and **PeerProgramming runs a single standing cohort** in low-population mode instead
of splitting members into tiny rooms. So the gated space is differentiated by **who is in it**
(trusted members) and **what features it has**, **not** by topic.

- **Channel model:** a single admin-owned channel — "Commons for trusted members." **Not** multiple
  topic rooms, and **not** user-created private rooms (a private room for a few friends is a group DM
  by another name, and it moves trolling into an unwatched back-room). Split into more than one channel
  only if and when the single channel becomes genuinely too noisy to follow — the same low-population
  reasoning PeerProgramming uses to decide whether to split cohorts.
- **Launch gate:** do not open the channel until enough members qualify to make it feel alive. A cold,
  near-empty "trusted" room reads worse than not having one, so gate the launch on a minimum number of
  eligible members and let it open populated.
- **Access:** channel membership is synced from the eligibility flag. Lose eligibility, lose access.
- **Features (v1):** a richer reaction set / more emoji, threads, and longer messages. **No image
  upload.**
- **Moderation:** moderators keep **read access** to the channel, and members are told so in-channel
  ("moderators can read this channel"). That is what keeps a "non-public" channel from becoming an
  unmoderated back-room where the same trolling simply relocates.
- **Implementation:** a distinct GetStream channel-type with the richer feature config; Commons stays
  its own, more limited channel-type. Stream already powers Chyme/Hub, so per-channel-type feature
  configuration (uploads off, reaction set, threads) is a native setting, not custom plumbing.

## 3. Contributor badge (discovery + motivation)

A hidden perk that nobody can find is not a perk. One earnable badge solves discovery and gives
members something to aim for — and "you can earn it too" keeps it from reading as a clique.

- **One categorical badge** on the Directory profile, fitting the existing badge pattern (for example
  the "Community generated" badge). Binary: a member has it or does not. **No tiers, no points, no
  leaderboard, no visible ranking.**
- **Same concept as channel access.** The eligibility that grants channel access is the same thing
  that grants the badge — one system, two surfaces.
- **Honest click-through copy** (needs a brand-voice pass): say what is true, e.g. *"This member is a
  consistent, broad contributor to the community. Access is earned through steady participation over
  time — anyone can earn it,"* with a short "how it's earned" link. It must **not** say "verified,"
  "vetted," or "trusted by the platform." Prefer "contribution / participation" over "value" so it
  does not read as "big spender" or a judgement of a person's worth.
- **Only ever the positive.** Show the badge to members who have it; never surface an absence or a
  "does not have it" state on anyone else. No shaming.
- **Real members only.** The badge attaches to claimed profiles that earned it — not to
  community-generated (unclaimed) profiles.
- **Health note:** gamification in a trauma community can nudge performative activity or status
  anxiety. A single binary badge with transparent, earnable criteria (not a points race) is what
  keeps it healthy.

## Open decisions for the owner

- The exact eligibility weights/thresholds and the minimum account age.
- The recompute cadence (weekly? alongside the trust snapshot?).
- The badge's name and click-through wording (brand-voice pass).
- The minimum number of eligible members required before the single gated channel opens.
- When (if ever) the single gated channel is noisy enough to justify splitting — the same
  low-population trigger PeerProgramming uses for cohorts.
- Whether a member can opt out of showing the badge.
- Whether eligibility loss on a report is immediate or applies at the next recompute.

## Build sequence (only when approved)

1. Eligibility computation (reuse the trust snapshot) producing the categorical flag.
2. The Directory badge + click-through + a short "how it's earned" page.
3. One gated Stream channel (richer reactions, threads, **no images**), membership synced from the
   flag, moderators read-in and disclosed.
4. Observe how it behaves. Only then consider images, and only with a full report → fast-removal →
   retention pipeline (the Foundation retention model is the reference).
