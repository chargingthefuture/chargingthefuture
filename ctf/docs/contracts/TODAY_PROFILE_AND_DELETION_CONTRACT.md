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

Card conversations (3.1, the board "a card opened in place") are the second exception. Since
2026-11-10 (owner decision) a card's conversation belongs to the plugin behind the card: Commons
holds one store and every row names the plugin and the item (`plugin`, `item_id`, from
`seCardItemRef` in `@ctf/shared`; Commons when no other plugin is behind the card). The earlier
`card_*` tables keyed by the card id were dropped with their rows by `post/0086`. `commons_item_answers` (a
member's answer on a card: can help, knows someone, would like this, this helped; once per kind),
`commons_item_messages` (public messages, and Just us two messages with the pair in `pair_low` and
`pair_high`, lower id first) and `commons_item_pair_requests` (who asked whom to talk just you two on a card,
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

A member's own marks on cards are the fifth: `today_card_marks`, one row per member per card id,
with the mark (`done` for the timeline dot, `not_for_me` for the ••• menu) and when it was made. They
are stored on the account so every phone and browser agrees, and GET /api/today applies them. They
are separate from `today_card_feedback_counts`, which counts marks with no names.

A member's Save for later list is the sixth: `today_card_saves`, one row per member per saved story
or replay, with the card's kind, title and address and when it was saved, so Saved in Me still works
after the card has left Today. Saving does not mark the card done.

When a member last read Today is the seventh: `member_presence`, one row per member with the time of
their last Today read (touched at most once a minute). It is only counted, for "N Avens here", and
never listed or shown with a name.

On the member's own device it keeps the last Today answer, so the screen draws at once. Marks a
device kept before they were stored on the account are sent up once and removed from the device. A
visitor who is not signed in has no account and no marks.

## 4) Deletion Scopes

- Service deletion: the member's `question_answers`, `question_matching_settings` and
  `question_answer_audit` rows, and every
  `question_match_messages` row where they are `user_low` or `user_high` (registry entry
  `twenty-one-questions`). The member's `commons_item_answers` rows, every `commons_item_messages` row they wrote,
  every Just us two message where they are `pair_low` or `pair_high`, and every
  `card_pair_requests` row where they are `user_low` or `user_high` (registry entry
  `today-card-conversations`), and every `today_card_windows` row where they are `owner_user_id`
  (same entry), every `today_card_marks` row where they are `account_id` (same entry), every
  `today_card_saves` row where they are `account_id` (same entry), and their `member_presence` row
  (same entry). Public messages other members wrote under a card stay.
- Full account deletion: the same 21 Questions, card conversation, card window, card mark, saved card
  and presence rows; each card source's own
  `commons_item_pair_requests` row where they are `user_low` or `user_high` (registry entry
  `today-card-conversations`). Public messages other members wrote under a card stay.
- Full account deletion: the same 21 Questions and card conversation rows; each card source's own
  contract covers its rows.
- `today_card_feedback_counts` is not touched by either: it stores no account id, so no row can be
  traced to the member.

## 5) Retention

21 Questions, card conversation, card window and card mark rows are kept until the account is deleted. When the item a
card came from is removed, its card leaves Today and its conversation is no longer shown; the rows
stay until their authors' accounts are deleted. The feedback totals are kept as counts; the admin screen reads the last 30 days. Nothing else is kept on the server; the
on-device copy is replaced on every read.
