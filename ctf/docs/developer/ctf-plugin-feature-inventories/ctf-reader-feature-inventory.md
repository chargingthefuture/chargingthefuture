# CTF Reader — Feature Inventory

## Scope and Boundary

Reader is a tile and one page in this app. It is not the reader.

The reader itself is a separate service — FreshRSS, on its own address at
rss.chargingthefuture.com, on a server this project pays for. It has its own database, its own
accounts and its own admin screens, and this repository holds none of them. Signing in there goes
through the same auth provider this app uses, so a member needs no second password and a ban at the
provider closes the reader too, within the reader's sign-in length (seven days; see
`ctf/docs/developer/FRESHRSS.md`).

What lives here is the page a member reaches from the apps list: what the reader is, what it cannot
do, what a place on it costs, and a link to it. Nothing about their reading — what they subscribe
to, what they opened — ever reaches this app.

## Intent and Outcome

A member who would rather not install or configure anything can still read what sites publish, in
publication order, without a platform deciding what they see first. They open the Reader tile, read
what it is and what a place on it costs, and go to it in one tap, signing in with the account they
already have.

## User Features

- A tile in the apps list called Reader, opening a page that explains the reader in plain words.
- An "Open the reader" button that goes to rss.chargingthefuture.com in a new tab, with a line
  underneath naming the address it opens and saying the sign-in is this same account.
- A statement of what a new reader account starts with: this blog and the owner's demo-video
  channel, and nothing else added for you (the channel joined the default list 2026-09-23).
- A statement of what the reader cannot do: it collects only from the day a feed is added, and it
  never notifies anybody.
- A statement of what a place on the reader costs, and that losing one is not a ban: the account in
  this app is untouched, and not finishing Unlock never costs anybody their account.

## Admin Features

None in this app. The reader's own administration — accounts on it, feed limits, purge policy — is
done inside the reader by its own administrator.

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
  stored here. An account on the reader is separate and is closed on the reader.
- The link carries `rel="noopener noreferrer"`, so the opened page gets no handle on this one.
- A ban at the auth provider (see the Unlock inventory) closes the reader too, because the reader
  asks the same provider. It reaches somebody already signed in to the reader when their sign-in
  there ends, at most seven days later; the settings are in `ctf/ops/freshrss/sign-in.env`.

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

- The page cannot say whether the member already has an account on the reader, because this app
  never asks the reader anything. Everybody sees the same page.
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
