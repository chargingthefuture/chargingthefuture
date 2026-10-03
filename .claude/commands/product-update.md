---
description: Write the weekly product update by hand and publish it through the workflow — the no-credit route for the product update workflow.
---

Do the writing half of `.github/workflows/generate-product-update.yml` from this session. The
workflow's publish steps (wiki page, blog registry, in-app feed post, Quora draft issue, the
`update/*` tag) need secrets this session does not hold, so you write the content and hand it to the
workflow through its `update_json` input; the workflow publishes it exactly as it publishes a
model-written one.

## 1. Find what shipped

On the latest `main`:

```
LAST_TAG=$(git tag -l "update/*" --sort=-version:refname | head -1)
git log "${LAST_TAG}..HEAD" --max-count=30 --pretty=format:"=== %h %s%n%b%n"
```

Fetch tags first (`git fetch origin --tags`). Strip trailer lines (co-author, session URL, parity
status). If no subject starts with `feat:`, `fix:` or `perf:`, say there is nothing to publish and
stop, unless `$ARGUMENTS` says `force`.

## 2. Write the update

Read `ctf/docs/BRAND_VOICE_LEXICON.md` and the system and user prompt in
`ctf/scripts/generate-update.mjs`; they are your instructions. Write a JSON object with exactly the
keys that prompt lists: `feedTitle`, `feedBody`, `wikiPageName`
(`Product-Update-<YYYY-MM-DD>-Short-Title`, hyphens only), `wikiContent` (with `## What Shipped`
and `## Why It Matters`), `wikiSiteExcerpt` (one sentence, under 150 characters) and `quoraDraft`.
Every line traceable to a commit; nothing called a launch unless a commit adds it for the first
time; credits never described as money; the repository URL exactly
`https://github.com/chargingthefuture/chargingthefuture`. Use today's date in US Eastern time.

Save it to the scratchpad and check it parses (`node -e 'JSON.parse(...)'`).

## 3. Publish through the workflow

Start `generate-product-update.yml` with `actions_run_trigger` (`run_workflow`, ref `main`) and the
input `update_json` set to the minified JSON string. The input limit is 64 KB; keep `wikiContent`
well under it. Wait for the run; if a publish step fails, read only that step's log and say what it
said.

## 4. Report

Two lines: the wiki page name and the Quora draft issue link. Do not paste the update into chat.
