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
`question_match_messages` (the conversation inside a match card, stored once per pair, low id first)
`question_matching_settings` (whether the member is matched; no row means on) and
`question_answer_audit` (each answer, each refused attempt to change one, and matching turned off or
on, read by the owner to spot somebody fishing for matches).

Card conversations (3.1, the board "a card opened in place") are the second exception: one store
for every ask, offer and story card, keyed by the card id (`<source>:<id>`). `card_answers` (a
member's answer on a card: can help, knows someone, would like this, this helped; once per kind),
`card_messages` (public messages, and Just us two messages with the pair in `pair_low` and
`pair_high`, lower id first) and `card_pair_requests` (who asked whom to talk just you two on a card,
and when the other agreed). A report made from a card goes into the existing `member_safety_reports`
table, which the safety contract covers.

`today_card_feedback_counts` is the third: a daily total per card source, card kind and signal
(`done` or `not_for_me`), added to when a member marks a card done or picks Not for me. It holds no
account id and nothing about who tapped, so no row in it belongs to anybody and there is nothing in
it to delete when an account is deleted.

How long an ask or offer stays on Today is the fourth: `today_card_windows`, one row per card id,
written only once its poster set something. It holds the poster's account id, the deadline chosen
in + New, the end of a renewed 14 days and when it was renewed, and, when the poster closed the ask
from Today, the outcome (`done` or `not_done`) and when. It holds nothing anybody wrote.

On the member's own device it keeps two things: the last Today answer, so the screen draws at once,
and the cards the member marked done (with the member's own day each was marked) or hid. Web keeps them in this browser's storage under
`se-today-v1:<user_id>` and `se-today-marks-v1:<user_id>`; Android keeps them in the app's own files.
Neither leaves the device, and signing out of the device or clearing the app's data removes them.

## 4) Deletion Scopes

- Service deletion: the member's `question_answers`, `question_matching_settings` and
  `question_answer_audit` rows, and every
  `question_match_messages` row where they are `user_low` or `user_high` (registry entry
  `twenty-one-questions`). The member's `card_answers` rows, every `card_messages` row they wrote,
  every Just us two message where they are `pair_low` or `pair_high`, and every
  `card_pair_requests` row where they are `user_low` or `user_high` (registry entry
  `today-card-conversations`), and every `today_card_windows` row where they are `owner_user_id`
  (same entry). Public messages other members wrote under a card stay.
- Full account deletion: the same 21 Questions, card conversation and card window rows; each card source's own
  contract covers its rows.
- `today_card_feedback_counts` is not touched by either: it stores no account id, so no row can be
  traced to the member.

## 5) Retention

21 Questions, card conversation and card window rows are kept until the account is deleted. When the item a
card came from is removed, its card leaves Today and its conversation is no longer shown; the rows
stay until their authors' accounts are deleted. The feedback totals are kept as counts; the admin screen reads the last 30 days. Nothing else is kept on the server; the
on-device copy is replaced on every read.
