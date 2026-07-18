# Disclaimer — Credits Are Not Money

This is the project's authoritative statement on what ServiceCredits and every other in-app
credit are, and are not. It exists so that any wording anywhere in this codebase that implies
otherwise is **obviously an error, not an intentional claim**.

## The statement

1. **ServiceCredits and all in-app credits are not money.** They are not legal tender, not a
   currency, not cash, not a security, not an investment, and not a financial instrument of any
   kind. They are a non-fiat internal credits unit used to recognize help exchanged between
   members inside the platform.
2. **Credits cannot be redeemed, withdrawn, exchanged, or cashed out** for cash, fiat currency,
   cryptocurrency, or anything of monetary value — not by members, not by the operator, not by
   anyone.
3. **The project makes no financial, investment, or monetary-value claims.** Numbers such as the
   GDP plugin's Community Value Index are estimates of community activity, never a price, a
   valuation, or a promise of value.
4. **Any wording anywhere in this repository that implies otherwise is an error** and does not
   reflect the project's intent. If you find such wording, correct it (or report it) rather than
   propagating it.

## Why this file exists

Most development in this repository is done by AI agents. An agent can accidentally frame credits
in money terms — for example, calling ServiceCredits "the money plugin", or describing a credit
transfer as a "payment". This committed statement puts the owner's position on record,
independent of whether every such slip is caught in review.

## Approved phrasing

When writing about credits anywhere (code comments, docs, UI copy, PR descriptions, posts):

- Say **"non-fiat internal credits"**, **"ServiceCredits"**, or **"credits"** — never "money",
  "cash", "currency", "payment", or "funds" as a description of what credits are.
- A transfer of credits is a **"send"**, **"transfer"**, or **"exchange"** — not a "payment" or
  "payout" (exception: established code identifiers keep their names).
- Negations are always correct and encouraged: "credits are **not money**", "never redeemable for
  cash".
- Real fiat amounts unrelated to credits (for example a housing listing's actual rent amount and
  its currency, or Contributions' confirmed USD donations to the operator's fundraiser) are real
  money and should be described as such — this disclaimer is about credits, not about those.

## Where this is referenced

- `README.md` (repository root)
- `CLAUDE.md` (agent home)
- `.claude/rules/124-brand-voice-and-language-rules.mdc` and `ctf/docs/BRAND_VOICE_LEXICON.md`
  (the writing rules that enforce the approved phrasing)
- The ServiceCredits feature inventory
  (`ctf/docs/developer/ctf-plugin-feature-inventories/ctf-service-credits-feature-inventory.md`)
  and the ServiceCredits contracts (`ctf/docs/contracts/SERVICE_CREDITS_*`)
