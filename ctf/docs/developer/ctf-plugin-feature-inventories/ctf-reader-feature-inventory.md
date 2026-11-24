# CTF Reader — Feature Inventory

## Scope and Boundary

Reader is a tile and one page in this app. It is not the reader.

The reader itself is the shared reader page of the `chargingthefuture/rss-feeds` repository, at
https://chargingthefuture.github.io/rss-feeds/read/, on GitHub's free hosting for public pages. It
has no sign-in and no server: a reader's list of feeds, what they mark watched and what they save
are kept in their own browser, and a backup they download is how they keep or move them. This
repository holds none of it. It replaced the hosted FreshRSS reader at rss.lagatos.com on
2026-11-24 (owner decision).

What lives here is the page a member reaches from the apps list: what the reader is, what it cannot
do, how to ask for a YouTube channel, and a link to it. Nothing about their reading ever reaches
this app.

## Intent and Outcome

A member who would rather not install or configure anything can still read what sites publish, in
publication order, without a platform deciding what they see first. They open the Reader tile, read
what it is and that their list lives in their own browser, and go to it in one tap, with no sign-in.

## User Features

- A tile in the apps list called Reader, opening a page that explains the reader in plain words.
- An "Open the reader" button that goes to https://chargingthefuture.github.io/rss-feeds/read/ in a
  new tab, with a line underneath naming the address and saying there is no sign-in, that what
  you add and mark stays in that browser, and to download a backup there to keep it.
- A statement of what the reader starts with: this blog, the owner's demo-video channel and the
  recorded broadcasts. Anything else is added by its address, and any feed can be removed, those
  three included.
- A statement of what the reader cannot do: it reaches back only as far as a feed carries, it never
  notifies anybody, and a site that does not let other web pages read its feed cannot be added.
- How to get a YouTube channel: ask from + New with the channel's address and, if wanted, the date
  to stop at. The owner collects it, cuts it at that date and replies with an address to add.

## Admin Features

None. Collecting a channel is done in `chargingthefuture/rss-feeds`, outside this app.

## API Surface and Route Map

| Route | Method | Purpose |
|---|---|---|
| `/apps/reader` | GET | The member page, served by the shared plugin route from the `reader` registry row. |

No API routes. This plugin makes no server call of its own.

## Data Model and Storage Contracts

One row in `ctf_plugin_registry` (`plugin_slug = 'reader'`), which is what puts the tile in the apps
list. No tables of its own, no columns added to anything, and nothing written at runtime.

## Security, Privacy, and Compliance Controls

- The page requires full Unlock approval, the default for every plugin page. It is not an exception
  and was not proposed as one.
- No command contracts, no access-policy contract and no audit contract, because there is no
  command to run and nothing to audit — the page reads nothing and writes nothing.
- No deletion contract. Deleting an account in this app removes nothing here, because nothing is
  stored here. The reader keeps nothing on any server, so there is nothing elsewhere to close.
- The link carries `rel="noopener noreferrer"`, so the opened page gets no handle on this one.

## Web and Android Delivery Status

| Surface | Status |
|---|---|
| Web (phone-width) | Shipped. |
| Android | Out of scope per rule 105 — not on the keep-list, so the app has no Android surface for it. Recorded in `ctf/config/plugin-parity-contracts.json` with `requiresMobileSurface: false`. |

## Seed Coverage Status

No seed script. The only row is the registry row, carried by `ctf/schema.sql` and by the migration
`ctf/db/migrations/post/0037_plugin_registry_reader.sql`.

## Trust Signal

Not applicable. Nothing a member does here is recorded, so there is nothing to count, and what
somebody reads is not evidence anybody should be publishing.

## Gaps and Known Technical Debt

- The page cannot say what a member has added to the reader, because the reader keeps that in the
  member's own browser and this app never asks it anything. Everybody sees the same page.
- The reader's address is written into the shell as a constant. If it ever moves, that line and the
  blog's announcement post both change.

## Build Checklist

1. Registry row in `ctf/schema.sql` and in `ctf/packages/web/lib/plugins/repository.ts`. Done.
2. Migration under `ctf/db/migrations/post/`, since an existing database is not re-seeded. Done —
   blocked by task 1.
3. Accent pair and tile visuals so the tile is not painted in the fallback gray. Done.
4. The shell at `ctf/packages/web/components/reader/reader-shell.tsx`. Done.
5. The branch in the shared plugin route that returns it. Done — blocked by task 4.
6. Parity contract entry and manual test-script manifest entry. Done.

## Change Log

- 2026-11-24 — The reader is now the shared reader page at https://chargingthefuture.github.io/rss-feeds/read/ (owner decision): the hosted FreshRSS reader at rss.lagatos.com cost a monthly bill for one reader and is shut down. Open the reader goes there. The page says there is no sign-in and the list lives in the member's browser, keep it with a backup; that the three defaults can be removed and anything else added by address; that a site which does not let other web pages read its feed cannot be added; and how to ask for a YouTube channel from + New. The "What a place on it costs" card is gone, since there is no server and no place. The FreshRSS workflows, their scripts, `ctf/ops/freshrss/` and `FRESHRSS.md` are removed with it, and the test script's sign-in case (RD-5) with them.
- 2026-11-02 — The reader's address is rss.lagatos.com (owner report: the reader failed after the domain change, since rss.chargingthefuture.com no longer leads to it). The Open the reader button, the line under it, the user guide, the test script and `FRESHRSS.md` name the new address. The service settings the move needs outside this repository are listed in `FRESHRSS.md`, "The address".
- 2026-10-15 — The generic public preview, which is what a signed-out visitor to `/apps/reader` sees, said a free account is all it takes. Reader needs Unlock approval like every plugin but Fireside (`pluginPageMinUnlockTier`), so the sentence in `generic-public-shell.tsx` now says the app opens once you have an account and finish verifying it (owner-approved copy fix, #2889).
- 2026-10-03 — The "What you get" card named two default feeds after the recorded broadcasts
  became the third on 2026-09-29 (owner report). The card, the user guide step and the test
  script now name all three. The cards also sat almost touching: the page column is a direct
  child of the app viewport, whose fallback rule forces it to `display: block` and so drops its
  14px gap. The column now carries `ctf-self-responsive`, so the gap applies again. The gap between items is now 16px, and the
  line under the button sits 8px below it, grouped with the button rather than spaced like a card.
- 2026-09-23 — Created. The reader went live at rss.chargingthefuture.com earlier the same day;
  this adds the tile and the page that explains it, so the apps list carries it rather than members
  finding the address in a blog post. The page exists at all because the apps list has no way to
  hold an external address — every tile links to `/apps/<slug>` — and because a tile that dropped
  somebody onto another domain and a sign-in prompt would tell them nothing about what it is or
  what a place on it costs.
- 2026-09-26 — The reader asked for a sign-in on nearly every reload (owner report). Its sign-in ran
  on the image's defaults: forgotten after 5 minutes idle, dropped when the phone closed the
  browser, and wiped by every restart. The reader now keeps a sign-in for seven days in an
  encrypted cookie on the device, and the provider's consent screen for the reader is turned off.
  Applied by the workflow `FreshRSS — Set how long a reader sign-in lasts` from
  `ctf/ops/freshrss/sign-in.env`. Nothing in this app's tile or page changed.
