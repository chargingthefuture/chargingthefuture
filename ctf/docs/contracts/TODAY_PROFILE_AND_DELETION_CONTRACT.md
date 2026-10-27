# Today Profile and Deletion Contract

## 1) Plugin Metadata

- Plugin Name: Today (the 3.1 home screen read)
- Service Key (lowercase, stable): `today`
- Owner Team: chargingthefuture
- Rollout Stage: 3.1.0 build

## 2) Canonical Profile Usage

Rule 114 baseline: Today uses one canonical profile by `user_id`. There is no Today-local profile.

- Read fields:
  - `user_id` (the viewer, to pick their own PeerProgramming board and to leave blocked members out)
  - the canonical `username` of card authors, through each source's own name lookup
- Write fields:
  - none

## 3) Plugin Extension Fields

Today stores nothing in the database. It reads other features' tables and writes no row, and its
Mood read does not create a Mood pseudonym.

On the member's own device it keeps two things: the last Today answer, so the screen draws at once,
and the cards the member opened or hid. Web keeps them in this browser's storage under
`se-today-v1:<user_id>` and `se-today-marks-v1:<user_id>`; Android keeps them in the app's own files.
Neither leaves the device, and signing out of the device or clearing the app's data removes them.

## 4) Deletion Scopes

- Service deletion: nothing to delete on the server.
- Full account deletion: nothing to delete on the server; each source's own contract covers its rows.

## 5) Retention

No server-side retention. The on-device copy is replaced on every read.
