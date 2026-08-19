# Spec — App-Wide Multi-Currency Value-Field Model

Status: owner-approved, ready to build · Created: 2026-05-29 · Owner decisions: locked (see below)
Tracking issue: [#120](https://github.com/chargingthefuture/chargingthefuture/issues/120) — feat: app-wide multi-currency value-field model + ServiceCredits no-fiat-parity.
Type: cross-cutting schema + library + contract/inventory work. Non-UI foundation — buildable now without a design pass (rule 127). The UI pass and a Replit design prompt come *after* this lands.

---

## 1. Why

ServiceCredits is an internal credits unit. It is non-fiat, non-cash, non-withdrawable, and has no fiat
redemption path (already policy in the ServiceCredits inventory: "enforce non-fiat, non-cash,
non-withdrawable credit behavior"; "fiat redemption paths are out of scope and explicitly denied").
Showing ServiceCredits at a fiat equivalent (e.g. "≈ $242 USD", "real monetary value", "credits ≈
$242 USD") claims a fiat parity that legally must not exist and must be removed everywhere.

The platform itself is multi-currency: survivors and providers can transact in fiat, barter, or
ServiceCredits. So a USD rate is legitimate data; the bug is that currency is not modeled as its
own field, so "accepts ServiceCredits" gets rendered as if the listed fiat price equals credits.

GDP is currency-agnostic. GDP aggregates governed canonical metrics
(`canonical_metrics_registry`, `gdp_metric_snapshots`; rule 121), accounting for all transactions
regardless of currency. GDP figures are not ServiceCredits balances and are not in scope for
this issue beyond ensuring nothing here implies SC↔fiat parity (see §7).

### Current data-model inconsistency (the root cause)

| Plugin | Value field today | Currency field? | "Accepts ServiceCredits"? |
|---|---|---|---|
| TrustTransport | `trust_transport_payout_requests.amount` + `currency` | ✅ `currency TEXT` | implicit in currency |
| LightHouse | `lighthouse_properties.monthly_rent` (bare `NUMERIC`) | ❌ none | ❌ none |
| Foundation | quotes are free-text (`foundation_quote_requests.request_text`); no price model | ❌ none | ❌ none |
| SocketRelay | none (mutual aid; reward shown only in mockup) | ❌ none | ❌ none |
| LevelUp | `level_up_cohorts.stipend_amount_per_payout`, `microgrant_amount` (bare `NUMERIC`) | ❌ implicit SC | ❌ none |
| Unlock | `unlock_runtime_config.incentive_amount` (`TEXT`) | ❌ implicit SC | ❌ none |

Only TrustTransport pairs amount with a currency, and even that is a free `TEXT` column, not a
referenced, admin-curated option set.

---

## 2. Owner-locked decisions (2026-05-29)

1. Price model = primary price + accepted set. Each priced item carries ONE listed price
   (`amount` + `currency`) plus a separate multi-select accepted currencies (which may
   include ServiceCredits, USD, Barter…). "Shows $85/hr · Accepts ServiceCredits" is two distinct
   fields, never a parity statement.
2. Barter is a currency-table row (`kind = 'barter'`), selectable like USD/ServiceCredits; an
   item priced or accepted in Barter carries no numeric amount.
3. Scope of this issue = field model + display rules only. GDP multi-currency *recognition /
   normalization* is a separate tracked follow-up (it needs its own valuation policy because SC
   cannot be valued at fiat parity).
4. Plugins in scope: LightHouse, Foundation, TrustTransport (align), SocketRelay, LevelUp,
   Unlock.

### Naming (owner-confirmed, applies to copy throughout)

- Canonical token name is `ServiceCredits` (one word, PascalCase) in all user-facing copy — not
  "ServiceCredits", "SC", "cr", or "credits".
- User-facing app names that are two words are joined PascalCase (ServiceCredits, LightHouse,
  SkillsHunt, ClickLog). Internal app names keep separate words (e.g. "Weekly Performance").
- Counts in mockups ("12 mini-apps", "17 Mini Apps", "4.9M survivors") are dummy placeholders.
  Canonical: 18 plugins (internal term is "plugin/plugins"); 62 users today, goal 5
  million. Do not render aspirational member counts as if real.

---

## 3. Data model

### 3.1 New reference table: `currencies` (admin-curated)

The dropdown is populated from the DB, owner-curated, to maintain data integrity.

```sql
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,                 -- technical code: 'SC', 'USD', 'EUR', 'BTC' (NEVER shown for SC)
  label TEXT NOT NULL,                   -- user-facing label, e.g. 'ServiceCredits', 'United States Dollar'
  kind TEXT NOT NULL CHECK (kind IN ('token','fiat','crypto','barter')),
  is_service_credits BOOLEAN NOT NULL DEFAULT FALSE,
  symbol TEXT,                           -- e.g. '$', '€'; NULL for token/barter
  decimal_places INTEGER NOT NULL DEFAULT 2,
  requires_amount BOOLEAN NOT NULL DEFAULT TRUE,  -- barter = FALSE
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,         -- SC = 0 (always preferred/first)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS is_service_credits BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS requires_amount BOOLEAN NOT NULL DEFAULT TRUE;
-- (one ALTER ... ADD COLUMN IF NOT EXISTS per column, per rule in CLAUDE.md)
```

Invariants:
- Exactly one row has `is_service_credits = TRUE` (code `SC`, label `ServiceCredits`, `kind='token'`).
  `code='SC'` is internal only — UI always renders the label `ServiceCredits`, never the bare code "SC".
- `kind='barter'` rows set `requires_amount = FALSE`.
- Rows are never hard-deleted; deactivate via `is_active = FALSE` to preserve FK integrity.
- ServiceCredits sorts first (`sort_order = 0`) — it is the platform's preferred currency wherever
  multiple options are shown (owner ruling).

Seed set (owner-locked 2026-05-29) via a new deterministic `ctf/scripts/seedCurrenciesPhase0.mjs`:

| code | label | kind | decimals | symbol | sort_order |
|---|---|---|---|---|---|
| SC | ServiceCredits | token | 0 | (none) | 0 |
| USD | United States Dollar | fiat | 2 | $ | 10 |
| EUR | Euro | fiat | 2 | € | 20 |
| JPY | Japanese Yen | fiat | 0 | ¥ | 30 |
| GBP | British Pound Sterling | fiat | 2 | £ | 40 |
| CHF | Swiss Franc | fiat | 2 | CHF | 50 |
| CAD | Canadian Dollar | fiat | 2 | CA$ | 60 |
| AUD | Australian Dollar | fiat | 2 | A$ | 70 |
| CNY | Chinese Yuan | fiat | 2 | CN¥ | 80 |
| INR | Indian Rupee | fiat | 2 | ₹ | 90 |
| BRL | Brazilian Real | fiat | 2 | R$ | 100 |
| BTC | Bitcoin | crypto | 8 | ₿ | 110 |

(No `BARTER` row at launch — the owner's seed list omits it; the `'barter'` kind stays in the enum
for when feedback adds it. The owner curates this table over time; "as feedback comes in I will
update the DB with currencies.")

### 3.2 Priced-item pattern (applied per plugin)

For every value-bearing entity, add a listed price + an accepted-currencies set:

```sql
-- listed price (nullable; barter rows leave amount NULL)
ALTER TABLE IF EXISTS <entity> ADD COLUMN IF NOT EXISTS price_amount NUMERIC NULL;
ALTER TABLE IF EXISTS <entity> ADD COLUMN IF NOT EXISTS price_currency TEXT NULL REFERENCES currencies(code);

-- accepted currencies (multi-select) — one join row per accepted code
CREATE TABLE IF NOT EXISTS <entity>_accepted_currencies (
  <entity>_id UUID NOT NULL REFERENCES <entity>(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  PRIMARY KEY (<entity>_id, currency_code)
);
```

Rule: `accepts ServiceCredits` is true iff a row `(entity_id, 'ServiceCredits')` exists in the
join table — it is never derived from `price_currency`.

### 3.3 Per-plugin application

- LightHouse (`lighthouse_properties`): keep `monthly_rent` as `price_amount` semantics; add
  `rent_currency TEXT REFERENCES currencies(code)`; add `lighthouse_property_accepted_currencies`.
  Backfill (owner ruling): all existing rows with a non-null `monthly_rent` → `rent_currency =
  'USD'` (everything to date is USD). Canadian rows that "did not add their listing cost yet" have a
  NULL `monthly_rent` → leave `rent_currency` NULL (no price set). Backfill only touches non-null rents.
- Foundation (no price model today): owner ruling — rates live on the provider profile, and
  the quote process is OUT OF SCOPE for this version (users negotiate manually via the chat
  button; no structured quote amount). So:
  - Add/extend a Foundation provider profile/extension with `rate_amount` + `rate_currency` (FK)
    + `foundation_provider_accepted_currencies`.
  - Do not add price fields to `foundation_quote_requests` — quotes stay free-text/manual.
- TrustTransport (already has `amount` + `currency`): migrate `currency TEXT` → FK
  `currencies(code)`; add `trust_transport_*_accepted_currencies` where an offer/posting exposes
  accepted currencies. Reconcile both `trust_transport_payout_requests` and
  `trust_transport_earnings_ledger`.
- SocketRelay (`socket_relay_requests` / `socket_relay_fulfillments`): if a reward/offer is shown,
  add `price_amount` + `price_currency` + accepted set; "Cost to post = Free" should render from
  absence of a price, not `$0`.
- LevelUp (`level_up_cohorts`): add `stipend_currency` / `microgrant_currency` FK, defaulted to
  `ServiceCredits` (these are internal SC payouts).
- Unlock (`unlock_runtime_config`): add `incentive_currency` FK, defaulted to `ServiceCredits`.

---

## 4. Shared library

Add `ctf/packages/web/lib/currency/` with:
- `types.ts` — `Currency`, `CurrencyKind`, `PricedValue { amount: number|null; currency: Currency }`,
  `AcceptedCurrencies`.
- `repository.ts` — load active currencies from DB (cached); resolve by code.
- `format.ts` — `formatPrice(value, currency)` (uses `symbol`/`decimal_places`; barter →
  "Barter", token → "N ServiceCredits"); `formatAcceptedCurrencies(codes)`.
- `assertNoFiatParity()` guard — a function/lint helper that refuses to format a ServiceCredits
  amount alongside a fiat symbol in the same string. Used by display components and covered by tests.

Mobile parity: mirror under `ctf/packages/mobile/src/features/currency/`.

---

## 5. Display rules (the contract designs and shells must follow)

1. Never render ServiceCredits with a fiat equivalent or "purchasing power" / "real monetary
   value". No "≈ $X USD", no "= N SC". This is the legal line.
2. Compact view (cards, list rows): show the listed price in its own currency
   (`$85/hr`, `1,400 ServiceCredits/mo`) and, separately, an "Accepts ServiceCredits" badge when
   the accepted set includes it. The two are visually distinct fields. This is allowed and correct.
3. Detail view: render each accepted currency as its own line/field; if multiple currencies are
   accepted, list them — never juxtapose a fiat amount and an SC amount as if interchangeable.
4. Free (e.g. SocketRelay post): render "Free" from the absence of a price, not `$0`.
5. ServiceCredits balances/wallets show only the credit quantity + utility ("usable across the
   18 plugins"), never a fiat figure.
6. ServiceCredits is always listed first / preferred wherever multiple currencies appear (owner
   ruling). The accepted-currencies formatter sorts by `sort_order` (SC = 0) so SC leads.
7. Compact-view cap (owner ruling: yes): when many currencies are accepted, the compact badge
   shows ServiceCredits first plus a capped remainder — e.g. "Accepts ServiceCredits +2" — with the
   full set in the detail view.

---

## 6. Contract + inventory artifact updates (required, per CLAUDE.md sync policy)

For each in-scope plugin, update its feature inventory (Data Model and Storage Contracts, Security/
Privacy/Compliance Controls) and command/access-policy contracts to reflect the new currency fields
and the no-fiat-parity rule. Add a `currencies` entry to the canonical metric/registry docs where
referenced. Add the new `currencies` table + per-plugin columns to `ctf/schema.sql` using the
`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS` pattern.

---

## 7. GDP boundary (in scope vs not)

- In scope here: ensure no GDP surface implies SC↔fiat parity; GDP figures stay currency-agnostic
  aggregate metrics; remove "$ = SC" framing from GDP copy; the banned "Phase" words on GDP surfaces
  (e.g. "By Phase" filter, `Phase 2` badges) are corrected as plain copy fixes.
- Out of scope (separate follow-up issue #121): how fiat/barter/SC/crypto transaction volumes
  are recognized and normalized into GDP canonical metrics. Owner decision (2026-05-29): GDP
  normalizes everything to a USD-denominated estimate. It is explicitly labeled an estimate
  (small drift acknowledged); GDP exists to keep the community motivated as an informal economy, not
  as an accounting ledger.
  - Guardrail (preserves the legal line): the SC→USD notional rate used for GDP lives only in
    the GDP estimation layer (a server-side aggregate FX factor, e.g. a `currency_usd_rates`
    table with `as_of`). It is never surfaced as a per-wallet or per-price SC=fiat equivalence.
    A user never sees "your N ServiceCredits = $X"; the only place a USD-normalized SC value appears
    is inside the aggregate, estimate-labeled GDP figure.
  - This is owned by the GDP feature inventory (`ctf-gross-domestic-product-feature-inventory.md`) +
    the canonical metric registry (rule 121) + metric governance.

---

## 8. Open questions — RESOLVED (owner, 2026-05-29)

1. Seed list — locked; see the table in §3.1 (USD, EUR, JPY, GBP, CHF, CAD, AUD, CNY, INR, BRL,
   SC, BTC). Owner curates the table over time as feedback comes in.
2. LightHouse backfill — non-null `monthly_rent` rows → `rent_currency = 'USD'`; Canadian rows
   with no cost yet stay NULL (no price). See §3.3.
3. Foundation rates — on the provider profile; the quote process is out of scope this
   version (manual chat). See §3.3.
4. Accepted-currency display cap — yes; ServiceCredits always shown first, then a capped "+N".
   See §5.6–5.7.
5. Decimal/format per currency — confirmed; per-currency `decimal_places` + `symbol` in §3.1
   (note JPY = 0 decimals, BTC = 8, SC = 0).

No open questions remain for this issue. GDP USD-normalization is tracked in the GDP follow-up
issue (see §7).

---

## 9. Ordered task list (no phases; dependencies stated)

1. Create `currencies` table in `ctf/schema.sql` + `seedCurrenciesPhase0.mjs`. *(no deps)*
2. Build `ctf/packages/web/lib/currency/` (+ mobile mirror), incl. `assertNoFiatParity()` + tests.
   *(blocked by 1)*
3. Retrofit schema for each in-scope plugin (price_amount/price_currency + accepted-currencies join):
   LightHouse, Foundation, TrustTransport, SocketRelay, LevelUp, Unlock. *(blocked by 1)*
4. Backfill migrations per §8 Q2 decision. *(blocked by 3)*
5. Update API routes/commands to read/write currency + accepted set; enforce no-fiat-parity server
   side. *(blocked by 3)*
6. Update contracts + feature inventories for each plugin. *(blocked by 3, 5)*
7. Run `pnpm build`, schema-drift gate, EOF + tests. *(blocked by all above)*
8. UI pass is design-gated — do NOT build the currency-field UI here. After this lands, feed the
   Replit design agent the prompt (produced post-implementation) so mockups model price + accepted
   currencies + "Accepts ServiceCredits" correctly across all surfaces, then implement shells under
   rule 126.

## 10. Acceptance criteria

- `currencies` table exists, seeded, admin-curated; dropdowns can populate from it.
- Every in-scope value-bearing entity stores `price_amount` + `price_currency` (FK) + an
  accepted-currencies set; "accepts ServiceCredits" derives only from the join table.
- No code path or copy renders a ServiceCredits amount at a fiat equivalent; `assertNoFiatParity()`
  is enforced and tested.
- Contracts + inventories updated; schema-drift gate green; `pnpm build` clean.
- GDP recognition explicitly deferred to its own issue (linked).
