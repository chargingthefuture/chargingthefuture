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
- **No numeric score. No points, no tiers, no leaderboard, no ranking** on any surface. Standing is
  categorical: a member is eligible or not-yet.
- **This is its own gating module — it does NOT touch the Trust plugin.** The eligibility engine
  described here reads existing signals to make an access decision; it never writes to, changes, or
  re-uses the Trust plugin's model, status, or rules. Keep the two entirely separate.
- **No claim of verification or vetting.** The platform verifies no one's identity, background, or
  work. No surface may say "verified," "vetted," or "trusted by the platform."
- **The "material value first" norm still applies** inside the channel — it is not a
  pure-socializing lounge.

## 1. How access is earned (material value, weighted per plugin)

A single categorical decision per member: **eligible** or **not-yet**, computed on the server and
never shown as a number or a rank.

### The core property: gaming the gate means helping the community

Access is bought **only with real material value delivered to real people**. So the only way to
"game" it is to actually provide steady aid to the community — which is the outcome the platform
wants. A perp who grinds for access has to spend genuine effort helping survivors; that is
self-defeating, which is why this gate needs very little fraud detection. Everything below is just
calibrating "material value" honestly.

### What counts as value (not logins, not presence)

- **Value = each plugin's core value-action**, i.e. its *defining metric of success* — the action
  that means the plugin is being used as intended. Examples: a TrustTransport delivery completed, a
  Lighthouse stay hosted, a SocketRelay request filled, a Foundation quote fulfilled, a WhatWorks
  endorsement others found useful. The reference point is Airbnb's "active user = someone who books,"
  not "someone who logs in."
- **Logins are downstream of value, so they carry near-zero admission weight.** Recent activity is
  used only as a **liveness floor** ("is this member still around"), never as a positive score. A
  member who adds value logs in as a consequence; rewarding the login directly rewards the wrong thing
  and is the easiest signal to script.
- **Delivered to distinct people** (counterparty diversity): the value has to reach **many different**
  members over a window, so it is real community aid, not self-dealing or a sockpuppet ring.
- **Clean standing:** no active blocks or reports against the member.
- **Minimum tenure:** an account-age floor.

### Weighting value across plugins

- **Each plugin's value-action is weighted, normalized by its base rate / effort.** A frequent, small
  action (a TrustTransport delivery) and a rare, large one (hosting a Lighthouse stay) must not count
  equally: one Lighthouse action is worth many TrustTransport actions. The weights reflect *value
  contributed*, not raw event count, and are **owner-tunable without a redeploy** (the model the
  single-open-cohort toggle already uses).
- **Reuse each plugin's defining metric — do not reinvent it.** "Material value per plugin" is exactly
  what the **canonical metric registry (rule 121)** and the **Weekly Performance** plugin are meant to
  define (each plugin's success metric, tied to whether it is used in its intended form). The gating
  module should *consume* those per-plugin metrics. This is a real dependency: the cleanest version of
  this waits on the per-plugin success metrics being settled (part of the tabled Weekly Performance
  work). Build the admission engine on top of that layer, not beside it.
- **Note on plugin archetypes:** most plugins mirror a known app, so their value-action is borrowed
  from that archetype (Lighthouse ≈ a stay, TrustTransport ≈ a delivery/ride, Foundation ≈ a fulfilled
  service). A few — PeerProgramming, Workforce, SkillUp — are bespoke, so their value-action has to be
  defined from their own intended use rather than copied.
- **The bar is intentionally high (owner directive).** Access is meant to be genuinely hard to earn —
  sustained, broad, real contribution — not an easy unlock. The exact threshold and weights are
  **deferred until the per-plugin value metrics are settled** (that work defines what "contribution"
  even means per plugin), then set high on purpose.
- **Count each value event once, in its originating plugin (no double-counting).** A Chyme tip is a
  ServiceCredits transfer; a TrustTransport trip writes a credit line. If several metrics counted the
  same underlying event the total would inflate. Define each plugin's value event to be mutually
  exclusive — the GDP recognition model (fixed contribution weights, distinct recognition sources)
  already does this and is the reference.

### Output, cadence, and storage

- **Output:** a categorical eligibility flag per member (internal). Any internal score used to reach
  it stays server-side and is never surfaced.
- **Cadence:** recomputed on a schedule (not instantly), so nobody spikes the signals then coasts.
  The recompute is **additive only** — it admits newly-qualified members and never revokes on signal
  decay (see the next two points).
- **The badge is permanent once earned.** It is recognition of real past contribution, so it is
  **never** removed for going quiet, a dip in activity, or a hard stretch. Stripping a real survivor
  for struggling or stepping away is not trauma-informed. No decay, no "use it or lose it."
- **Channel access is revoked only for substantiated cause** — a *reviewed* harm or abuse action
  inside the space, handled by moderation. **Not** for inactivity, and **not** on an unreviewed report
  alone (an auto-revoke-on-report rule would be weaponized against real victims via report-brigading).
  A quiet survivor keeps everything; only someone who actually causes harm loses access.
- **High churn is expected and fine.** With typical messaging-app churn, most members never qualify;
  the badge is for the persistent value-adding minority, by design.

### Threat model: the long-game perp

A patient perp could earn access, then try to cause harm later. Perfect prevention is not the bar (no
community achieves it); **bounded, observable, recoverable** harm is — and the design already reaches
it:

- **Entry cost is real aid.** Getting in requires sustained material value delivered to many real
  survivors first. That is slow and expensive, and the survivors were genuinely helped along the way —
  the net is not zero even if the perp is later removed.
- **The blast radius is small and watched.** Inside there are no DMs, no images (v1), it is group-only,
  and moderators read it (disclosed). A perp cannot do 1:1 targeting or post images; harm is bounded
  and observable, which is what makes it actionable.
- **Removal is for-cause and immediate.** The moment they cause harm, moderation revokes access — you
  do not need to have caught them earlier, you catch them when they act, in a space built to make
  acting visible.
- **Account deletion resets the barrier.** A perp who deletes and returns loses the earned history and
  must re-grind real aid from scratch, so deletion is self-defeating, not a loophole. The broader
  "same person, new identity" problem is platform-level (Unlock's Quora social proof, suppression /
  takedown tools); this gate only adds cost on top.
- **Storage:** a computed eligibility flag plus a non-exposed reason snapshot, owned by this module —
  separate from the Trust plugin's storage.

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

- **It is a designed award emblem, not a UI chip.** A commissioned-quality vector seal
  (challenge-coin / die-cut sticker feel — something a member would print and put on a laptop),
  because it is an award, not a plain interface distinction. A first concept exists (a navy-and-gold
  seal, working name "Keeper of the Commons": a beacon-flame woven from many contributor nodes on a
  "Commons" baseline, ringed "Charging the Future · Keeper of the Commons · Earned"). Motif, palette,
  and name are still open.
- **One categorical badge** on the Directory profile, fitting the existing badge slot (alongside, for
  example, the "Community generated" badge). Binary: a member has it or does not. **No tiers, no
  points, no leaderboard, no visible ranking.**
- **Same concept as channel access.** The eligibility that grants channel access is the same thing
  that grants the badge — one system, two surfaces.
- **Honest click-through copy** (needs a brand-voice pass): say what is true, e.g. *"This member is a
  consistent, broad contributor to the community. Access is earned through steady participation over
  time — anyone can earn it,"* with a short "how it's earned" link. It must **not** say "verified,"
  "vetted," or "trusted by the platform." Prefer "contribution / participation" over "value" so it
  does not read as "big spender" or a judgment of a person's worth.
- **Only ever the positive.** Show the badge to members who have it; never surface an absence or a
  "does not have it" state on anyone else. No shaming.
- **Real members only.** The badge attaches to claimed profiles that earned it — not to
  community-generated (unclaimed) profiles.
- **Health note:** gamification in a trauma community can nudge performative activity or status
  anxiety. A single binary badge with transparent, earnable criteria (not a points race) is what
  keeps it healthy.

## Open decisions for the owner

- **The per-plugin value-action weights** and the base-rate normalization (how much one Lighthouse
  action is worth vs one TrustTransport action, and so on), plus the overall threshold and the minimum
  account age.
- **The dependency on per-plugin success metrics:** whether to settle each plugin's defining metric
  (canonical metric registry / Weekly Performance) first and have the gating module consume it, or to
  ship an interim weighting and reconcile later.
- The recompute cadence (weekly?).
- The badge's name and click-through wording (brand-voice pass).
- The minimum number of eligible members required before the single gated channel opens.
- When (if ever) the single gated channel is noisy enough to justify splitting — the same
  low-population trigger PeerProgramming uses for cohorts.
- Whether a member can opt out of showing the badge.
- **Does stopping contributing cost channel access?** Recommended: **no** — access is for-cause-only
  (removed only for a reviewed harm/abuse action), so a member who goes quiet keeps their seat. This is
  the trauma-informed default and inactivity is not a safety threat in a no-DM, no-image, moderated
  group; an inactivity-decay rule would mostly punish struggling survivors and would not stop a
  determined lurker anyway. The trade-off is channel vibrancy vs. trauma-informed retention — the owner
  can choose active-contributors-only instead, at that cost.

## Build sequence (only when approved)

0. **(Dependency)** Settle each plugin's defining value-metric via the canonical metric registry /
   Weekly Performance, so the gating module has a real per-plugin definition of material value to
   consume rather than a guessed one.
1. Eligibility computation in this new gating module (reads the per-plugin value-actions + counterparty
   diversity + liveness floor + clean standing; owner-tunable weights), producing the categorical flag.
   It does not touch the Trust plugin.
2. The Directory badge + click-through + a short "how it's earned" page.
3. One gated Stream channel (richer reactions, threads, **no images**), membership synced from the
   flag, moderators read-in and disclosed. Open it only once enough members qualify.
4. Observe how it behaves. Only then consider images, and only with a full report → fast-removal →
   retention pipeline (the Foundation retention model is the reference).
