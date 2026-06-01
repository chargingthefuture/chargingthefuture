# Design brief — GDP currency-rate admin + the "estimate" label

Status: requested 2026-06-01 · Tracking: issue #121 (GDP multi-currency recognition) · Audience: the
Replit design agent (authors mockups in the `design` submodule under `…/survivor-hub/`).

This brief unblocks two UI surfaces that the #121 backend foundation needs but that have **no mockup
yet**, so the app side is gated by the design-pass rule (127). Build these in the design repo; the app
agent implements them once they land.

## Why

The platform is multi-currency. GDP rolls all eligible transaction volume into one **USD-denominated
estimate** using owner-curated conversion factors stored in `currency_usd_rates`. Two surfaces are
needed:

1. an **admin screen** for the owner to view and revise those conversion factors, and
2. an **"estimate" treatment** on the GDP figure so people understand it is an estimate, not an
   accounting figure.

## Hard constraint (the legal line — must be honored in the mockups)

A ServiceCredits amount must **never** be shown at a fiat equivalent anywhere user-facing. The USD
conversion factor exists **only** inside the aggregate GDP estimate. So:

- The rate admin screen is **owner/admin-only**, and it must read as "the notional factor used to
  estimate GDP," never as "what your ServiceCredits are worth." Include that disclaimer in the design.
- Never render "N ServiceCredits ≈ $X" for a wallet, price, or per-user figure.

## Surface 1 — Currency-rate admin screen (admin-only)

A management screen for the `currency_usd_rates` table. Real data fields only:

- A list of currencies (from the `currencies` catalog: label such as "ServiceCredits", "United States
  Dollar"; never the bare `SC` code for ServiceCredits) with each one's **current** USD factor
  (`usd_rate`), the `as_of` date it took effect, and the `source`.
- An action to **revise** a currency's factor: it creates a new dated entry (a new `as_of` row), so the
  history is preserved; the latest `as_of` is the active rate. Show prior values as history.
- A prominent, calm disclaimer: these factors are used only to estimate GDP and are never a redemption
  or per-wallet value of ServiceCredits.
- Admin states: loading, empty (no rates yet), populated, and a save/confirmation state.

Suggested component(s) in `design/.../survivor-hub/`: `GDPRatesAdmin.tsx` (+ `…Empty`, `…Loading`).
Keep it consistent with the existing admin/GDP visual language.

## Surface 2 — The GDP "estimate" treatment

On the GDP dashboard's headline figure (and any USD-normalized aggregate such as
`gdp_total_revenue` and the new `gdp_recognized_volume_usd`), add a clear but understated **"estimate"**
treatment — e.g. a small "Estimate" chip or caption near the number, with a short tooltip/footnote that
the figure is a USD estimate normalized across currencies (a morale/transparency metric, not an
accounting ledger). The data layer exposes this via `gdp_metric_snapshots.is_estimate`.

Update the existing GDP mockups rather than adding a new screen: `GDP.tsx`, `GDPPublic.tsx`,
`MobileGDP.tsx`, `MobileGDPPublic.tsx` (wherever the headline figure appears). Do not invent a fiat
value for the per-user "estimated contribution" line beyond what the API provides.

## Data the surfaces may bind (real only)

- `currencies`: `code`, `label`, `is_service_credits`, `symbol`.
- `currency_usd_rates`: `currency_code`, `usd_rate`, `as_of`, `source`.
- `gdp_metric_snapshots`: `metric_key`, `metric_value`, `is_estimate`.

No fabricated figures, target progress, or per-wallet conversions beyond these fields.
