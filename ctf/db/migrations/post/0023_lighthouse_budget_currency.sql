-- LightHouse: name the currency a seeker's budget is stated in.
--
-- The seeker form asked for "least/most you can pay per month" and never asked which currency that
-- was. On a private profile a bare number was survivable; on a published wanted posting it is not,
-- because a reader has to guess — and the guess a reader makes is a dollar sign, which is exactly
-- what the multi-currency rule forbids putting on a ServiceCredits figure.
--
-- No backfill. A budget saved before this column existed named no currency, and writing 'USD' onto
-- it would be this migration inventing a fact about someone's money. NULL reads as "not stated",
-- and the card falls back to the plain number for it. A published posting always carries a currency
-- in practice: publishing is only reachable by saving the form, and the form now sends one.

ALTER TABLE IF EXISTS lighthouse_profiles
  ADD COLUMN IF NOT EXISTS budget_currency TEXT NULL REFERENCES currencies(code);
