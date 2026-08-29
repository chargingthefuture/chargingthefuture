# Spec — ServiceCredits Monetary Policy and Mutual-Credit Rail

Status: owner-approved, ready to build · Created: 2026-06-15 · Owner decisions: locked (see §2)
Plugin: `service-credits` · Related inventory: `ctf/docs/developer/ctf-plugin-feature-inventories/ctf-service-credits-feature-inventory.md`
Type: monetary policy + schema + library + contract/inventory work, plus the circulation dashboard and the
pay-time mutual-credit rail UI. The policy, schema, and server pieces are non-UI foundation. The dashboard
and pay/send rail UI are owner-bypassed for design gating (owner granted `bypass design` on 2026-06-15;
build net-new surfaces directly from the app's existing tokens).

---

## 1. Why this exists

ServiceCredits is the internal credit that human-trafficking survivors — people shut out of the global
economy and unable to earn an income elsewhere — use to transact with each other across the app's plugins.
It is non-fiat, non-cash, and non-withdrawable: it has value only inside this economy. The project is run by
one person, so the credit supply needs a written, auditable rule, not case-by-case judgment. Without a rule,
the easy mistake is to mint credits whenever someone needs them; that is exactly how an economy gets
over-saturated and each credit ends up buying less. This spec is that rule.

### ServiceCredits is not Bitcoin

Bitcoin's fixed 21-million cap and halving schedule exist to manufacture scarcity, because its value
proposition is being a scarce asset that appreciates. Copying that here would be the wrong model: credits
would appreciate, holders would hoard, newcomers could not get any, and circulation — the whole point —
would die. ServiceCredits' value proposition is the opposite: access and circulation. The right reference
models are closed-loop store credit (loyalty points, redeemable only internally) and community /
complementary currencies built for groups excluded from the mainstream economy (time banks, mutual-credit
networks). In those models the money supply is elastic — it tracks how much real trading happens — rather
than a fixed number.

### The governing principle

The credit supply should track the real supply of goods and services people will provide for credits, not
the level of need. Minting to need rather than to productive capacity is the mechanism behind every
hyperinflation. So: issue credits mostly as payment for verified contribution (earning), seed a deliberate
one-time float to bootstrap circulation, cap the rate of new issuance, keep credits leaving circulation at
roughly the rate they enter, and steer by measured circulation rather than a magic total.

---

## 2. Owner-locked decisions (2026-06-15)

1. **One unit, two payment rails.** There is exactly one credit unit (ServiceCredits). A member has one
   balance. "ServiceCredits" pays from the balance the member already holds. "ServiceCredits — Mutual
   Credit" lets a member pay even at a zero balance by going negative up to a per-account credit limit; the
   credit is created at the moment of the trade and repaid later as the member earns. Both rails resolve to
   the same unit, so there is no exchange rate and no split liquidity. This is **not** a second currency and
   does **not** add a row to the `currencies` table.
2. **Rate cap, not a hard total cap.** Treasury issuance is bounded by a configurable per-period mint
   budget (a rule-based limit on how many credits may be minted per rolling window), not by a fixed lifetime
   supply ceiling. Mutual-credit issuance is bounded by the sum of per-account credit limits. Both are
   bounded; the total supply stays elastic to real activity.
3. **Earn first, grant rarely.** In steady state, almost all issuance is payment for verified contribution
   (the existing Unlock approval reward is the template). Direct admin grants are the exception
   (corrections, disputes, bootstrapping), not the faucet.
4. **Deliberate one-time seed, then taper.** A known, capped genesis float bootstraps circulation, logged
   as seeding; after that the economy runs on earning.
5. **Two-tier circulation dashboard.** A public, all-members view shows aggregate, non-identifying trust
   numbers (in circulation, total issued, treasury, how much is moving). An admin-only view adds the
   operational levers (mint budget remaining this period, concentration, per-wallet drill-down, treasury
   controls, disputes).
6. **Mutual-credit rail lives in the pay/send step**, not the listing currency picker. A seller "accepts
   ServiceCredits"; whether the buyer funds from balance or community credit is the buyer's choice at pay
   time and is invisible to the seller.
7. **No fiat parity, ever.** No surface shows a ServiceCredits amount at a fiat equivalent. This is an
   existing legal line (see the multi-currency value-field spec) and applies to every number in this spec.

---

## 3. The monetary model

### 3.1 Sources (how credits enter circulation)

| Source | Trigger | Bound | Default posture |
|---|---|---|---|
| Earn rewards | Verified contribution (e.g. Unlock approval) | Per-period mint budget (§3.3) | Primary, steady-state |
| Genesis seed | One-time bootstrap per onboarded member or a treasury float | Capped, logged as seeding | One-time |
| Admin mint grant | Operator decision with a governance ticket | Per-period mint budget (§3.3) | Rare; corrections only |
| Mutual-credit issuance | A member pays on the mutual-credit rail (goes negative) | Sum of per-account credit limits (§3.4) | Created and destroyed by trade |

### 3.2 Sinks (how credits leave circulation)

Treasury fee collection, governance burns, and the 7-day account-deletion reclaim (which sweeps a deleted
member's balance back to the treasury). A healthy closed economy needs credits to leave at roughly the rate
they enter, or supply grows without bound. Policy pairs each issuance budget with an expected sink flow so
net supply growth is a chosen number, not an accident.

### 3.3 Per-period mint budget (the keystone rule)

Treasury-rail issuance (earn rewards + admin grants, **excluding** mutual-credit, which is bounded
separately) is capped per rolling window. The budget is stored in the existing
`service_credits_treasury_config.policy` JSON so the operator can tune it without a schema change:

```json
{
  "issuance": {
    "periodDays": 7,
    "maxMintPerPeriod": null,
    "maxNetGrowthPctOfCirculation": null,
    "enforce": false
  }
}
```

- `enforce` — the master switch. Defaults to **off**, so a live economy keeps minting (the earn reward and
  admin grants) exactly as before until the operator deliberately turns the budget on. Measure first with the
  dashboard, then enforce when a sensible budget is known. This avoids silently freezing the live reward.
- `maxMintPerPeriod` — hard ceiling on credits minted in the rolling window. `null` = no per-amount ceiling.
- `maxNetGrowthPctOfCirculation` — optional alternative ceiling expressed as a percent of current
  circulation (the steady, pre-announced small-growth rule). `null` disables it. When both are set, the
  effective ceiling is the lower of the two.
- With `enforce: true` but neither limit set, the ceiling is `0` — an explicit operator choice to freeze
  treasury minting.

Enforcement (server-side, in the mint path): when `enforce` is on, before a mint commits, sum `mint_grant`
amounts in the current window from `service_credits_governance_events`; if `current + requested > ceiling`,
deny with `mint_budget_exceeded` and surface it. Mutual-credit issuance does not draw on this budget.

### 3.4 Per-account credit limit (mutual-credit bound)

Each member has a mutual-credit limit: the most negative their balance may go. A negative balance is a
commitment to repay the community in goods/services, so limits start small and are operator-tunable. The sum
of all limits is the ceiling on outstanding mutual-credit debt, which is the system's total mutual-credit
exposure. Stored per member (see §5). Default base limit is small and set in `treasury_config.policy`:

```json
{ "mutualCredit": { "enabled": true, "defaultLimit": 0, "maxLimit": 0 } }
```

`defaultLimit: 0` means the rail is visible but a member cannot go negative until the operator raises the
base limit — again, safe by default.

### 3.5 Unit anchor

Decide informally what 1 credit should buy — a reference service, or a notional unit of effort — and watch
whether that reference basket costs more credits over time. A rising basket cost is the inflation alarm. This
anchor is **internal only**; it is never expressed as a fiat equivalence and never shown per-wallet (§2.7).

---

### 3.6 How much credit one member can use — a flat, equal line (no credit or social score)

This platform does not have, and will never have, a credit score or a social score — including the Trust
plugin, which is explicitly *not* a score. The mutual-credit limit must honor that. So the limit is **flat
and equal**: every member gets the same line, set by one policy number, regardless of their history.

```json
{ "mutualCredit": { "enabled": true, "defaultLimit": 0, "maxLimit": 0 } }
```

- `defaultLimit` — the line every member has. Equal for everyone. `0` until the operator sets it (safe
  default). Recommended starting value: enough for one or two typical transactions, no more.
- `maxLimit` — a hard ceiling on any per-account override (below), enforced even at its default of `0`. So
  with the default an admin cannot set a positive per-account limit until a ceiling is configured; revoking
  (setting an override to `0`) always works.

The bound on abuse does **not** come from judging people. It comes from three things that are not scores:
1. the line is **small**, so the most the community can lose to any one account is small;
2. an admin can **freeze** a wallet (§3.7) — a binary safety action for a demonstrated bad actor, the way
   moderation works, not a creditworthiness rating;
3. the **dispute** system unwinds bad transfers.

A per-account override (`service_credits_credit_limits`) exists for two deliberate, human decisions only —
raise a line for a known partner, or set it to `0` to revoke for a flagged account. It is set by a person,
not computed from behavior, and it is never shown to members as a rank. There is no behavioral
"earned" number anywhere in the spend path or the member experience.

So the answer to "how much credit can one member use" is: **the same small, equal amount as everyone else
— granted by membership, not earned point by point — bounded by a small cap, the freeze, and disputes.**
This is also the dignified answer for a community where most members (the owner included) are destitute:
trust is extended to every survivor equally from day one, not rationed by a score they must climb.

#### Why this still resists the "perpetrator takes from victims" attack

A flat line does not weaken the defense, because the loss per account is capped small, the account had to
pass membership/verification to exist, the wallet freeze stops a flagged actor immediately, and total
community exposure is bounded by `defaultLimit × members`. No scoring is required to make it safe.

### 3.7 Wallet freeze (trust & safety)

Separate from the credit limit (which only bounds going negative), an admin can **freeze** a wallet:
a frozen wallet cannot spend on *either* rail. This is the lever for a risk-flagged account. Stored as
`is_frozen` (+ reason/actor/time) on `service_credits_wallets`; the transfer path rejects a frozen
sender with `wallet_frozen`. Unfreeze restores. (Note: there is no platform-wide account-restriction
signal today — TrustTransport keeps its own `account_restricted` flag — so this freeze is the
ServiceCredits-owned control; unifying restriction signals platform-wide is a separate follow-up.)

## 4. Metrics and the two-tier dashboard

### 4.1 Metrics (computed server-side)

| Metric | Definition | Tier |
|---|---|---|
| In circulation | Sum of positive member balances (available + escrow), excluding the treasury wallet | Public |
| Total issued | Lifetime sum of `mint_grant` amounts | Public |
| Total burned | Lifetime sum of `burn` amounts | Public |
| Treasury balance | The treasury wallet's balance | Public |
| Velocity | Transfer volume in the last 30 days ÷ in-circulation | Public |
| Outstanding mutual-credit debt | Sum of negative member balances (absolute value) | Public (aggregate) |
| Mint budget remaining | Ceiling (§3.3) − minted-this-period | Admin |
| Concentration | Share of circulation held by the top N wallets | Admin |
| Per-wallet drill-down | Individual balances and history | Admin |
| Open disputes | Count and list of unresolved disputes | Admin |

Public numbers are aggregate and non-identifying — no individual balances, nothing that identifies a member.
This aggregate transparency is what makes a one-person-run economy trustworthy: it is visible proof the
operator follows the issuance rule.

### 4.2 Endpoints

- `GET /api/service-credits/circulation` — public (signed-in members). Returns the public-tier metrics only.
- `GET /api/service-credits/admin/circulation` — admin-gated (CSRF + admin). Returns public-tier metrics plus
  the admin levers (mint budget remaining, concentration, open-dispute count).

Both are read-only and best-effort. Neither renders a fiat figure.

### 4.3 Surfaces

- Public page under the ServiceCredits app surface: the four headline numbers plus velocity and a plain-
  language note that credits are usable across the plugins and are not money.
- Admin dashboard (`/admin/service-credits`): the summary tiles the existing admin shell left out for lack of a
  backing endpoint (in-circulation / issued / treasury / mint budget remaining / concentration) now have one.

---

### 4.4 Clean distinction from GDP (they do not cross)

The Economy/circulation dashboard and the GDP model measure different things and must never share a
number:

- **GDP** measures economic *activity/output* across the whole platform — fiat, crypto, ServiceCredits,
  barter, free — folded into one relative **Community Value Index** via owner-set contribution weights
  (`currency_usd_rates`, USD only as a reference base of 1). It is an index, not dollars, and it never
  expresses a per-wallet ServiceCredits-to-fiat value.
- **Circulation (this dashboard)** measures the ServiceCredits *credit supply itself* (not money — see `ctf/docs/DISCLAIMER.md`) — supply in circulation,
  total issued/burned, treasury, velocity, mutual-credit debt — always in **credits**, never in dollars.

They touch at exactly one point, and only as an input: ServiceCredits *transaction activity*. Even there
the code keeps them apart — GDP recognizes only the SkillUp trainer-payout slice of validated work, read
from `service_credits_governance_events` where `reason = 'levelup_trainer_split'`; every other
ServiceCredits ledger entry is written with `accounting_scope = 'service_credits_non_gdp'`, which is the
exclusion marker the GDP recognition layer honors (it reads governance events, not the SC ledger, by
design). The new code in this spec keeps that boundary: the mutual-credit transfer entry and the
`mutual_credit_default` entry both use `service_credits_non_gdp`, and the circulation endpoints emit
only credit quantities — no fiat figure. One cross-effect to keep in mind: the §3.3 mint budget governs
*all* `mint_grant` issuance, including the GDP-recognized SkillUp trainer split, so a too-tight budget
could throttle those payouts — a non-issue while enforcement is off, but worth setting the budget above
expected trainer-split volume when it is turned on.

## 5. Data model changes

All additive, using the `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS`
pattern in `ctf/schema.sql`.

### 5.1 New table: `service_credits_credit_limits`

```sql
CREATE TABLE IF NOT EXISTS service_credits_credit_limits (
  user_id TEXT PRIMARY KEY,
  credit_limit NUMERIC NOT NULL DEFAULT 0,
  updated_by_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The most negative `service_credits_wallets.available_balance` may reach is `-credit_limit`. Absent a row, the
member's limit is the policy `defaultLimit`. A member with no limit row and a `defaultLimit` of 0 cannot go
negative.

### 5.2 `service_credits_wallets` — negative balances and freeze

`available_balance` already permits negative values (`NUMERIC`, no non-negative constraint). The mutual-credit
rail is enforced in application code against the credit limit, not by a column constraint, so the existing
balance-check under `FOR UPDATE` stays the guard for going negative. New freeze columns support §3.7:

```sql
ALTER TABLE IF EXISTS service_credits_wallets ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS service_credits_wallets ADD COLUMN IF NOT EXISTS frozen_reason TEXT;
ALTER TABLE IF EXISTS service_credits_wallets ADD COLUMN IF NOT EXISTS frozen_by_user_id TEXT;
ALTER TABLE IF EXISTS service_credits_wallets ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;
```

The transfer path reads `is_frozen` under the same `FOR UPDATE` lock and rejects a frozen sender with
`wallet_frozen` before any balance or rail check.

### 5.3 Ledger reference types (no schema change)

Mutual-credit-funded transfers record ledger entries with `reference_type = 'mutual_credit'`; mutual-credit
defaults absorbed by the treasury on deletion record `reference_type = 'mutual_credit_default'`. These are
string values in the existing `service_credits_ledger_entries.reference_type` column — no DDL needed.

### 5.4 Genesis seed and governance events

Seed issuance reuses the existing `mint_grant` governance event with `reason = 'genesis_seed'` so seeding is
auditable and shows up in "total issued". No new table.

---

## 6. Mutual-credit rail behavior

The transfer path gains an optional `rail` input: `'balance'` (default — current behavior, rejects when the
sender lacks the funds) or `'mutual_credit'`.

On the `mutual_credit` rail the sender may go negative, but only down to `-(credit_limit)`. The check, run
under the existing `FOR UPDATE` lock:

```text
effectiveFloor = rail === 'mutual_credit' ? -creditLimit : 0
if (senderBalanceAfter < effectiveFloor) reject 'credit_limit_exceeded'
```

The recipient is credited normally; the buyer going negative and the seller going positive net to zero, so
mutual-credit issuance never inflates total supply — it only creates a matched debt/credit pair that unwinds
as the buyer earns back to zero.

### 6.1 Negative balance at account deletion (required rule)

The deletion-reclaim today sweeps a positive balance to the treasury. A negative balance at deletion is a
mutual-credit default — a loss the treasury (that is, everyone) absorbs. The reclaim path must:

- when the final balance is negative, record a `mutual_credit_default` ledger entry, debit the treasury by
  the shortfall, and emit the deletion event with the default amount in its metadata;
- keep this bounded by small credit limits (§3.4) so a single default cannot meaningfully harm the economy.

This must be reflected in `SERVICE_CREDITS_PROFILE_AND_DELETION_CONTRACT.md`.

---

## 7. Display and brand rules

- No ServiceCredits amount is ever shown at a fiat equivalent, on any tier of the dashboard (existing legal
  line; see the multi-currency value-field spec).
- The token renders by its label "ServiceCredits", never the bare code "SC" in prose; the pay/send rail
  option labels are "ServiceCredits" and "ServiceCredits — Mutual Credit".
- Public circulation numbers are aggregate only; never a per-member figure.
- Plain language throughout: "in circulation", "total issued", "held by the community", not jargon.

---

## 8. Contract and inventory updates (required, per CLAUDE.md sync policy)

- `SERVICE_CREDITS_PLUGIN_COMMAND_CONTRACTS.yaml`: extend `transfer.create` with the `rail` input; add a
  `circulation.metrics.get` read command (public + admin projections).
- `SERVICE_CREDITS_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`: public read for aggregate circulation; admin read
  for levers; mutual-credit rail denial reasons (`credit_limit_exceeded`).
- `SERVICE_CREDITS_PROFILE_AND_DELETION_CONTRACT.md`: the §6.1 negative-balance default rule.
- Feature inventory: new routes in API Surface; `service_credits_credit_limits` in Data Model; mint-budget
  and mutual-credit controls in Security/Privacy/Compliance; dashboard in Delivery Status; close the "no
  circulation/issuance read endpoint" gap.

---

## 9. Ordered task list (no phases; dependencies stated)

1. Land this spec. *(no deps)*
2. Add `service_credits_credit_limits` to `ctf/schema.sql`. *(no deps)*
3. Repository: `getCirculationMetrics()` (public + admin projections); read credit limit; helpers to read the
   issuance budget from treasury policy. *(blocked by 2)*
4. Repository: enforce the per-period mint budget in `mintGrant`. *(blocked by 3)*
5. Transfer path: add the `rail` input + credit-limit floor in the shared `createTransfer` and the transfers
   route. *(blocked by 2)*
6. Endpoints: `GET /api/service-credits/circulation` (public) and `GET /api/service-credits/admin/circulation`
   (admin). *(blocked by 3)*
7. Deletion reclaim: handle the negative-balance default per §6.1. *(blocked by 5)*
8. UI: pay/send rail selector (SC first, then Mutual Credit); public circulation page; admin circulation
   tiles. *(blocked by 5, 6)*
9. Contracts + feature inventory + deletion contract updates. *(blocked by 2–7)*
10. `pnpm build`, schema-drift gate, EOF, tests. *(blocked by all above)*

## 10. Acceptance criteria

- The per-period mint budget is enforced in the mint path only when the operator turns enforcement on
  (`issuance.enforce: true`); with the default (`enforce: false`) minting is unrestricted so the live earn
  reward is never frozen. When enforcement is on, mints over the ceiling are denied and audited.
- The mutual-credit rail lets a member pay to `-(credit_limit)` and no further; issuance nets to zero;
  default limit of 0 keeps the rail safe until raised.
- `GET /api/service-credits/circulation` returns aggregate, non-identifying numbers; the admin endpoint adds
  the levers; no endpoint or surface renders a fiat equivalent.
- Account deletion with a negative balance is handled as a treasury-absorbed mutual-credit default and
  recorded immutably.
- Contracts, deletion contract, and the feature inventory match the code; schema-drift gate green; build
  clean.
