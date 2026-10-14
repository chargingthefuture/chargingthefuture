---
description: Is anything still in flight? Answer whether this chat can be archived, and nothing else.
---

The owner is about to archive this chat and wants to know whether anything would be lost. Answer
that. The question is only about **open tasks** — work that exists nowhere but in this session.

An open pull request is **not** an open task. Work that is committed, pushed and has a PR has left
this session: the branch holds it, the PR carries it, and the owner merges from their phone.
Archiving loses nothing. Say the PR is open and move on — do not treat it as unfinished, do not
offer to wait for its checks, and do not watch it (`CLAUDE.md`, "No PR watching").

## 1. Check the four things that can strand work

Run these in every repo attached to the session, not just this one:

1. **Uncommitted changes** — `git status --short`. An edit sitting in the working tree is lost when
   the container is reclaimed.
2. **Unpushed commits** — `git log --oneline @{u}.. 2>/dev/null`, and on a branch with no upstream,
   anything not on `origin/main`. A commit only in the container is lost the same way.
3. **A pushed branch with no PR** — the work survives, but nobody will find it. Opening the PR is
   part of finishing, per `/br`.
4. **Scheduled check-ins still armed** — `list_triggers`. One of these wakes a session the owner
   thinks is closed.

Also look back over the session itself: did the owner ask for something that was never started, or
started and left half-done? That is the one check no command can run, and it is the one that
matters most.

## 2. Finish what you find, then answer

Do not report a stranded change and ask what to do with it — that hands the owner a decision they
asked you to remove. Commit it, push it, open the PR, cancel the trigger. Then answer.

The one case to ask about rather than finish: an edit you are not sure the owner wants kept. Name
it in one line and let them decide.

## 3. Reply

**If nothing is in flight**, say so in a sentence, then list what left the session, one line each —
the PRs by number and state (open or merged), and anything written into the repo rather than only
into chat. Keep it to a few lines; the owner is deciding whether to close a tab, not reading a
report.

**If something was in flight**, say what it was and what you did about it, then give the same
short list.

Do not re-explain the work, do not summarize the session, and do not add a closing line about what
it all meant.
