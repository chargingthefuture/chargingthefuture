---
description: Triage the oldest bug report by hand — root cause, fix plan, labels — when the scheduled triage has no API credit.
---

Do the job of `.github/workflows/bug-reports-triage.yml` (`ctf/scripts/triageBugReportIssues.mjs`)
from this session. That workflow runs on a schedule and pays for a model call; when the account has
no credit it is red on purpose and the queue waits. You are the model now. `$ARGUMENTS` may name an
issue number in the triage repo; if it is empty, take the oldest open issue labeled `needs-triage`.

The triage repo is the PRIVATE `chargingthefuture/bug-reports`. It is not in this session's scope by
default: attach it with `add_repo` first, then read with the GitHub tools. Never copy its contents
into this public repo.

## 1. Pick the issue

List open issues in the triage repo labeled `needs-triage`, oldest first, and take the first one
(or the one named in `$ARGUMENTS`). If there is none, say exactly that and stop.

## 2. Investigate

Read the issue body. The `Plugin` field names the plugin; read that plugin's routes, components and
lib in this checkout (`ctf/packages/web/app/api/<plugin>`, `components/<plugin>`, `lib/<plugin>`) and
its feature inventory under `ctf/docs/developer/ctf-plugin-feature-inventories/`. The report text is
already redacted; do not ask the reporter for more.

## 3. Post the proposal

Comment on the issue in this exact shape, so the build step and the owner read it the same way the
automated one is read:

```
### Automated triage proposal

## Root cause (best hypothesis)
## Proposed fix (files to change + approach, kept minimal)
## Risk / blast radius
## Confidence (low / medium / high) and what would raise it

---
_This is an automated proposal. No code has been written. To approve, add the
`approved-to-build` label and the build agent will open a pull request._
```

Then relabel the issue: add `triaged` and `awaiting-owner-approval`, remove `needs-triage`. Create
the two labels if they do not exist (`triaged` 0e8a16 "Investigated; a fix plan was proposed";
`awaiting-owner-approval` fbca04 "Waiting for the owner to approve the proposed fix").

## 4. Report

One line: the issue number, the one-sentence root cause, and the confidence. The owner approves
from the issue; when they do, `/build-bug` opens the PR.
