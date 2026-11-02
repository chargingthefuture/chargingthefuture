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

Today's cards store nothing in the database: they read other features' tables, and the Mood read
does not create a Mood pseudonym. The one exception is 21 Questions (3.1.0 plan, task 18), whose
controls sit inside Today's cards: `question_answers` (a member's answers, the first one stands) and
`question_match_messages` (the conversation inside a match card, stored once per pair, low id first).

On the member's own device it keeps two things: the last Today answer, so the screen draws at once,
and the cards the member opened or hid. Web keeps them in this browser's storage under
`se-today-v1:<user_id>` and `se-today-marks-v1:<user_id>`; Android keeps them in the app's own files.
Neither leaves the device, and signing out of the device or clearing the app's data removes them.

## 4) Deletion Scopes

- Service deletion: the member's `question_answers` rows, and every `question_match_messages` row
  where they are `user_low` or `user_high` (registry entry `twenty-one-questions`).
- Full account deletion: the same 21 Questions rows; each card source's own contract covers its rows.

## 5) Retention

21 Questions rows are kept until the account is deleted. Nothing else is kept on the server; the
on-device copy is replaced on every read.
