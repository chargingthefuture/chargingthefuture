# The reader (FreshRSS)

A feed reader at `rss.chargingthefuture.com`, on Render, for members who would rather not run one
themselves. Signing in goes through the app's own auth provider, so nobody sets a second password
and a ban at the provider closes both at once.

This file is the record of how it is set up. The app's own tile and page are described in
`ctf-plugin-feature-inventories/ctf-reader-feature-inventory.md`; this is the service underneath.

## What runs

| | |
|---|---|
| Service | `ctf-freshrss` on Render, web service from a published image, starter plan |
| Image | pinned by digest in [`ctf/ops/freshrss/image.txt`](../../ops/freshrss/image.txt) |
| Disk | 1 GB at `/var/www/FreshRSS/data` |
| Database | SQLite on that disk |
| Feed fetching | the image's own scheduler, on `CRON_MIN` |

## The image is pinned, and why

The service was created on the `latest` tag. That means a redeploy nobody asked for — after a
restart, or a settings change — could pull a different FreshRSS under a running reader.

It now names an exact build by digest. A digest cannot be re-pointed. A tag can: a publisher may
push a new image to the same tag, so `1.30.0` tomorrow need not be `1.30.0` today. The ledger's
image is pinned the same way, for the same reason.

To move version: edit `ctf/ops/freshrss/image.txt` in a pull request, then run the workflow
`FreshRSS — Pin the reader's image`. The change is reviewed and the repository records what is
running, so the two cannot drift. A dashboard edit loses both of those.

Find a digest for a version at `https://hub.docker.com/v2/repositories/freshrss/freshrss/tags`.

## Getting at it from outside

Render is the only way in. Two things about that shape anything done here:

- Render expands anything beginning with a dollar sign in a start command before the container sees
  it, and leaves quote characters as ordinary text. A shell one-liner sent that way arrives with
  every variable blank and the rest treated as one command name. Each step has to be one plain
  command with no variables and no quotes.
- The image carries no download tool — no `curl`, no `wget`, only the PHP extension of that name.
  Content that has to reach the disk goes in through Render's secret files, mounted at
  `/etc/secrets/`, and is copied into place by a start command that is one `cp` and nothing else.

A start command that ends by exiting rather than serving is reported by Render as a failed deploy.
That is expected for a step whose job is to change something on the disk; the work lands on the
disk, which outlives the container, and a following step hands the start command back.

## What is on the disk

`data/config.php` (the instance settings, including the sign-in method), `data/users/<name>/` per
account with that account's own SQLite database and settings, `data/opml.xml`, and the caches.

`data/opml.xml` is what a brand-new account is given instead of the FreshRSS project's own default
list. It holds two feeds and nothing else: this blog, and the owner's demo-video channel (the
feed collected by `chargingthefuture/rss-feeds` at
`https://chargingthefuture.github.io/rss-feeds/youtube/mutilpe.xml`, added 2026-09-23; the
collected feeds moved out of the blog repository on 2026-09-24).

## What is not backed up

Everything above. The disk is the only copy: Render's disks are not snapshotted on this plan, and
nothing reads the disk from outside.

Moving the article and subscription data to Postgres would allow the nightly dump the ledger gets
(`backup-formance.yml`). It was raised and not done: a reader that polls keeps a serverless
database awake for most of the day, which is billed compute, and a managed one is a flat monthly
cost. Recorded here so the next person knows it was a decision rather than an oversight.

## Known limits, so they are not rediscovered

- A YouTube channel feed carries only the newest videos. Nothing older ever arrives, so a date
  filter inside the reader cannot reach a back catalogue.
- FreshRSS's own pages are plain on a phone. It ships a web manifest and the Apple full-screen
  tags, so adding it to the home screen gives a standalone app with no browser chrome.
- The reader's API (`/api/greader.php`) sits outside what the auth provider guards and has its own
  per-account password, which is how a native reader app connects.
