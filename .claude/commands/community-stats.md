---
description: Write the weekly community stats Quora draft by hand from the filed numbers — the no-credit route for the community stats workflow.
---

Do the writing half of `.github/workflows/generate-community-stats.yml` from this session. The
numbers come from the database, which this session cannot reach, so they are collected by the
no-model twin workflow and filed as an issue; you write the post from that issue.

## 1. Get the numbers

Look for an open issue labeled `community-stats` and `draft-needed`. If there is none, start
`.github/workflows/generate-community-stats-manual.yml` with `actions_run_trigger`
(`run_workflow`, ref `main`), wait for it to finish, and then find the issue it filed. If the run
fails, read only the failing step and say what it said; do not retry blindly. `$ARGUMENTS` may name
the issue number directly.

## 2. Write the post

Read the "Source numbers" section of the issue. Read `ctf/docs/BRAND_VOICE_LEXICON.md` and
`.claude/rules/124-brand-voice-and-language-rules.mdc` first. Then write, in the same shape the
model is asked for in `ctf/scripts/generate-community-stats.mjs` (read the instructions it gives
the model and follow them as your own):

- `title`: a short, plain title for the week's snapshot.
- `quoraDraft`: a short community snapshot in a plain, personal tone. Single operator: never "we",
  "our" or "us". Every number comes from the issue, unchanged; name each app with its direct link
  exactly as the issue gives it. No negative framing, no rhetorical questions, no closing flourish,
  nothing described in money terms (the index figures are index numbers). One sentence saying the
  code is open source at https://github.com/chargingthefuture/chargingthefuture.

## 3. Put it on the issue

Edit the issue so it reads exactly like an automated draft: title
`Community Stats Draft: <YYYY-MM-DD> — <title>` (keep the date already in the title), body = the
post, a blank line, `---`, and the untouched "Source numbers" section. Remove the `draft-needed`
label. The owner reviews and posts from the issue and adds `posted` as before.

## 4. Report

One line with the issue link. Do not paste the post into chat.
