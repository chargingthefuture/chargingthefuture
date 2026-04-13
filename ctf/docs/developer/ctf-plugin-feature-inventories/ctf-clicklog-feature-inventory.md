# ClickLog Plugin Feature Inventory

## 1. Scope & Boundary

ClickLog provides a simple, auditable incident counter and logging system for users, supporting optional location and notes metadata. It is designed for event tracking, user journaling, and lightweight incident reporting.

## 2. Intent & Outcome

- Allow users to log incidents with a single tap/click
- Optionally capture geolocation and notes
- Display a running count and history
- Support deletion and auditability

## 3. Target User Features

- Log incident (with optional location/notes)
- View incident count and history
- Delete own incidents
- Mobile and web parity

## 4. Target Admin Features

- View all incidents (future)
- Delete any incident (future)

## 5. API Surface and Route Map

- `GET /api/clicklog` — List incidents for authenticated user
- `POST /api/clicklog` — Create incident
- `DELETE /api/clicklog/[id]` — Delete incident by id

## 6. Data Model and Storage Contracts

- Table: `clicklog_incidents`
  - `id UUID PRIMARY KEY`
  - `user_id TEXT`
  - `metadata JSONB NOT NULL DEFAULT '{}'` (latitude, longitude, notes)
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Indexes: `user_id`, `created_at DESC`

## 7. Security, Privacy, and Compliance Controls

- Auth required for all actions
- Users can only view/delete their own incidents
- Admins (future) can view/delete all
- See [CLICKLOG_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml](../../contracts/CLICKLOG_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml)

## 8. Web and Android Delivery Status

- Web: Implemented shell, full parity
- Android: Implemented shell, full parity
- See [plugin-parity-contracts.json](../../../config/plugin-parity-contracts.json)

## 9. Seed Coverage Status

- See [scripts/seedClicklogPhase0.mjs](../../../scripts/seedClicklogPhase0.mjs)
- 3–5 sample incidents with varied metadata

## 10. Risks & Known Technical Debt

- No admin UI for global view/delete yet
- No rate limiting on incident creation
- No advanced search/filtering

## Change Log

- 2026-04-13: Initial implementation and registration
