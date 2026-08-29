# Design Cohesion Pass — Findings & Session Continuity

> Status: **web + mobile token conversion COMPLETE** (2026-07-10); only owner value-decisions
> (Q2/Q4/Q5/Q6) and optional CI hardening remain. Branch `design/brand-cohesion-theme-token-pass`.
> Resumable spec for the cross-cutting brand/theme cohesion pass across **web (desktop +
> mobile-responsive)** and **Android (React Native)**. A future session resumes from §8 + §9.
>
> Scope guardrail (rule 127 + owner): this is a **visual cohesion** pass only. Unify color / theme /
> token / typography usage. Do **NOT** add, remove, or redesign any feature, screen, IA, copy, or
> interaction. Inventories/contracts in `docs/developer/ctf-plugin-feature-inventories/` are the
> source of truth for what exists — never design anything not listed there.

## 1. Context

- Monorepo. Web app: `ctf/packages/web` (Next.js). Mobile: `ctf/packages/mobile` (React Native).
- Two themes, both first-class and both must work everywhere: **default** (dark UI) and **comic**
  (comic-book dark). Web toggles via `data-theme="comic"` on `<html>` (absent = default), wired in
  `hooks/useTheme.tsx`. Mobile has a parallel `src/theme/theme-context.tsx` + `ThemeToggle`.
- Comic token spec (authoritative, do not invent values):
  `design/artifacts/mockup-sandbox/COMIC_THEME_TOKENS.md`.
- Replit mockups are **reference only** and deprecated; prod is the source of truth (rule 127).

## 2. The theme token architecture (how it is SUPPOSED to work)

Three composable building blocks already exist in the web app:

1. `app/globals.css` — CSS custom properties `--ctf-*` for both `:root` (default) and
   `:root[data-theme="comic"]`. Components that use `var(--ctf-x)` switch automatically.
2. `lib/theme/theme-tokens.ts` — `type ThemeName`, and `getAppAccent(slug, theme)`: the per-plugin
   accent table. Comic accents copied verbatim from `COMIC_THEME_TOKENS.md §6`.
3. `components/shared/plugin-shell-theme.ts` — `getPluginShellTokens(accent, theme)`: returns the
   shared chrome palette (BG/HEADER/RAIL/TEXT/TITLE/SUBTLE/MUTED/FAINT/BORDER/BORDER_STRONG/
   BORDER_HI/INPUT_BG). Default returns the exact shipped hex ⇒ pixel-identical default theme.

The established per-plugin idiom (see `components/account-data/account-data-shared.ts` and the already
-converted `components/workforce/workforce-shell.tsx`): a `components/<p>/<p>-shared.ts` exports
`get<P>Tokens(theme) = getPluginShellTokens(accent, theme)` where
`accent = theme==='comic' ? getAppAccent('<slug>','comic') : '<SHIPPED_HEX>'`. Components call
`useTheme()` then `const t = get<P>Tokens(theme)` and use `t.*` instead of inline hex.

Concrete hex is still needed inline (not `var()`) because shells use the `${color}NN` alpha-suffix
trick (e.g. `${t.ACCENT}20`) that CSS `var()` cannot express — hence the JS token helpers.

## 3. Findings (gaps)

**F1 — Comic theme is the primary cohesion failure (systemic, but partial).**
Of the web `.tsx` files that contain inline hex (233), **201 are "true violators"**: they hardcode
hex AND consume **no** theme helper, so they render identical grays/surfaces under both themes ⇒
toggling comic produces a half-themed UI. **32** files already adopt the helpers (many shells are
done). 19 plugin dirs already have a `*-shared.ts` token file but still have unconverted sibling
components. Full inventory in the Appendix.

**F2 — Same hex means different tokens by role.** A raw `#9CA3AF` is `--ctf-text-secondary`;
`#6B7280` is `--ctf-text-subtle`; `#0F1117` is BG. A blind global find/replace is UNSAFE. Convert
per component, by role, using the shell/token helpers.

**F3 — Status / data-viz swatches have no sanctioned default token.** Bright `#EF4444` (danger),
`#22C55E` (success), `#F59E0B` (amber), `#6366F1` (indigo), chart palettes. The shipped exemplar
`workforce-shell.tsx` deliberately keeps these RAW. Do NOT map them to `--ctf-danger` (that value is
`#B91C1C`, a different shade — would change prod pixels). Comic values for danger/success exist in
the spec but applying them is a value decision — see §7.

**F4 — Cross-platform token drift (web vs Android).** Confirmed deltas:
- danger: web `--ctf-danger` = `#B91C1C` but components use raw `#EF4444`; mobile `danger` = `#EF4444`.
- "secondary" text: web `--ctf-text-secondary` = `#9CA3AF`, `--ctf-text-subtle` = `#6B7280`; mobile
  `textSecondary` = `#6B7280` (i.e. mobile "secondary" == web "subtle"). Naming collision.
- card radius: web `--ctf-card-radius` 14px / control 10px; mobile `radius` = 12. Minor geometry drift.
These need owner sign-off before flipping either platform (§7).

**F5 — Intentional exceptions (do NOT tokenize).**
- `components/shared/app-loading.tsx` bg `#0F1117` + loading text — `COMIC_THEME_TOKENS.md §11` says
  the comic theme has NO effect on loading screens. Leave raw.
- `components/shared/stream-chat-panel.tsx` white/near-black — a computed contrast helper, not chrome.
- Any hex used as a `var(--ctf-x, #fallback)` fallback is correct defensive theming. Leave it.

## 4. Verified conversion recipe (typecheck-green pattern)

Per plugin `<p>` with slug `<slug>` and shipped accent `<HEX>`:
1. If missing, create `components/<p>/<p>-shared.ts`:
   `export function get<P>Tokens(theme){ const accent = theme==='comic' ? getAppAccent('<slug>','comic') : '<HEX>'; return getPluginShellTokens(accent, theme); }`
2. In every component of the plugin: ensure `'use client'`, `import { useTheme }` + `get<P>Tokens`,
   then `const { theme } = useTheme(); const t = get<P>Tokens(theme);`.
3. Replace chrome hex with `t.*` (BG/HEADER/RAIL/TEXT/TITLE/SUBTLE/MUTED/FAINT/BORDER/… + shipped
   accent → `t.ACCENT`).
4. LEAVE RAW: semantic status/data-viz swatches (§F3), contrast helpers, loading screens (§F5).
5. `pnpm --filter @ctf/web run typecheck`. Default theme must remain byte-identical (guaranteed by
   construction — the default branch returns the original hex).

## 5. Android (mobile) — same gap, parallel layer

`ctf/packages/mobile/src/theme/theme-tokens.ts` has `getThemeTokens(theme)` (flat palette incl.
danger/success/gold/radius, with comic values). ~116 feature files hardcode hex and bypass it. Same
recipe applies with the mobile helper. Reconcile values with web per §F4 first (owner decision).

## 6. Admin surfaces (rule 131)

Admin pages/components are in scope for the SAME token treatment (they share the plugin shells and
`components/ui/*`). Convert admin shells/tables with the same recipe; no admin-only redesign.

## 7. Open questions for owner (DO NOT GUESS)

- **Q1 (status colors): ANSWERED by the token spec itself (2026-07-08).** `app/globals.css` keeps
  `--ctf-danger: #b91c1c` and `--ctf-success: #22c55e` IDENTICAL in both `:root` and
  `[data-theme='comic']` — the sanctioned behavior is that status colors do not change under comic.
  Keeping bright status/data-viz swatches RAW is therefore spec-consistent, not a gap. Closed.
- **Q2 (cross-platform reconciliation): RESOLVED (2026-07-10) — web is the reference; make mobile
  identical to web (owner directive).** The mobile flat palette in
  `packages/mobile/src/theme/theme-tokens.ts` now mirrors web's `app/globals.css` `:root` values
  field-for-field (the comic palette already matched web comic):
  - `borderDim` `#283548` → `#1E2A3A` (`--ctf-border-dim`)
  - `textSecondary` `#6B7280` → `#9CA3AF` (`--ctf-text-secondary`)
  - `danger` `#EF4444` → `#B91C1C` (`--ctf-danger`)
  - `gold` `#C8A84B` → `#38BDF8` (`--ctf-gold`; warm gold stays in comic, matching web comic)
  - `radius` `12` → `14` (`--ctf-card-radius`)
  - added `textShell` `#E8EAF0`/comic `#EDE3CB` (`--ctf-text-shell`).
  These change shipped mobile default pixels — sanctioned by the owner directive. Raw `#9CA3AF`
  (108 occurrences) and `#E8EAF0` (39) literals across mobile were then repointed to the
  `textSecondary`/`textShell` tokens (byte-identical in default) so the comic theme themes them too.
  Note: web's own `--ctf-control-radius` (10) and `--ctf-surface-raised` have no distinct mobile
  consumer, so no separate mobile control-radius/surface-raised token was added.
- **Q3 (admin token group): RESOLVED (2026-07-08).** `getPluginShellTokens` now carries
  `SURFACE` (`#161B27` → comic `#141414`) and `BORDER_SOLID` (`#1E2A3A` → comic `#D4C49A1A`,
  the click-log precedent). All admin shells were converted with it.
- **Q4 (undefined var, NEW):** `community-shell.module.css` uses `var(--ctf-surface-raised, #1e293b)`
  but `--ctf-surface-raised` is not defined in `globals.css` — it always resolves to the `#1e293b`
  fallback in BOTH themes. Either define the var (default `#1e293b`, comic value TBD) or switch the
  call site to `--ctf-surface`. Left as-is pending the call.
- **Q5 (#38BDF8 in community chat, NEW):** community-shell chat has ~15 raw `#38BDF8` (equal to the
  `--ctf-gold` default). Several sit on `@comic`-assistant classes whose comic overrides deliberately
  remap to inkDim ("no blue in comic"), but six sites (`chatActionBtn`, `chatReplyBtn:hover`,
  `chatQuotedAuthor`/quoted block, `chatReactionPillActive`, `unreadDividerLabel`,
  `composerReplyLabel`) have NO comic override, so cyan currently leaks into comic. Owner call:
  map them to `--ctf-gold` (warm gold in comic) or add inkDim comic overrides.
- **Q6 (accent-pinned contrast inks, NEW):** several dark "ink on accent" colors are pinned to the
  DEFAULT accent (e.g. workforce `#3a1d05` on orange, lighthouse `#06210F`, gdp `#04243a`,
  what-works `#0A0E06`, gentle-pulse `#0A0F0E`). Under comic the accent changes but the ink stays
  tuned to the old accent. Kept raw (pixel-safe; contrast remains readable on the darker comic
  accents). A follow-up could add an ACCENT_INK token slot if wanted.

## 8. Progress log

### Session (2026-07-07) — branch `design/brand-cohesion-theme-token-pass`
- Wrote this findings/continuity doc (this commit).
- NOTE for resumer: an earlier attempt lost local commits when the clone was moved into the v0
  workspace (v0 converted it to a submodule and wiped it). Durable store = the GitHub branch. Push
  after every chunk.
- Verified against a clean clone of `main`: 201 true violators (Appendix), 32 files already converted,
  19 plugin dirs already have a `*-shared.ts`.

## 9. Execution checklist (resumable) — remaining per-dir violator counts

Work highest-count dirs first; follow §4 recipe; commit+push per plugin.

```
hexCount | file
4 | app/admin/page.tsx
1 | app/sign-up/[[...sign-up]]/page.tsx
8 | components/beacon/beacon-admin-shell.tsx
3 | components/beacon/beacon-host-stage.tsx
5 | components/beacon/beacon-viewer.tsx
17 | components/bug-reports/bug-reports-admin-shell.tsx
11 | components/chyme/chyme-audio-room.tsx
8 | components/chyme/chyme-chat-panel.tsx
6 | components/chyme/chyme-controls.tsx
3 | components/chyme/chyme-guest-listen.tsx
5 | components/chyme/chyme-header.tsx
11 | components/chyme/chyme-public-shell.tsx
5 | components/chyme/chyme-room-view.tsx
8 | components/chyme/chyme-sidebar.tsx
5 | components/chyme/chyme-stage.tsx
9 | components/chyme/chyme-tip-dialog.tsx
1 | components/click-log/click-log-empty-state.tsx
1 | components/click-log/click-log-icon-rail.tsx
1 | components/click-log/click-log-log-panel.tsx
8 | components/click-log/click-log-public-shell.tsx
5 | components/click-log/click-log-right-rail.tsx
1 | components/click-log/click-log-sidebar.tsx
16 | components/comic/comic-review-dashboard.tsx
10 | components/community-shell/shell-chat-panel.tsx
10 | components/community-shell/unlock-verify-banner.tsx
1 | components/contributions/admin/contributions-admin-drive.tsx
3 | components/contributions/admin/contributions-admin-queue.tsx
1 | components/contributions/admin/contributions-admin-settings.tsx
3 | components/contributions/contributions-confirmation.tsx
5 | components/contributions/contributions-paths.tsx
6 | components/directory/directory-browse.tsx
3 | components/directory/directory-empty-state.tsx
10 | components/directory/directory-public-shell.tsx
8 | components/directory/directory-right-panel.tsx
3 | components/directory/directory-skills-picker.tsx
17 | components/feed-announcements/feed-announcements-admin-shell.tsx
15 | components/foundation/foundation-admin-shell.tsx
5 | components/foundation/foundation-call-alerts.tsx
4 | components/foundation/foundation-call-audio.tsx
18 | components/foundation/foundation-connect-now.tsx
6 | components/foundation/foundation-direct-line.tsx
12 | components/foundation/foundation-instant-call-settings.tsx
14 | components/foundation/foundation-instant-call.tsx
10 | components/foundation/foundation-offer-skills.tsx
17 | components/foundation/foundation-panels.tsx
13 | components/foundation/foundation-profile.tsx
6 | components/foundation/foundation-public-shell.tsx
16 | components/foundation/foundation-rails.tsx
10 | components/gdp/gdp-admin-shell.tsx
13 | components/gdp/gdp-dashboard.tsx
2 | components/gdp/gdp-icon-rail.tsx
10 | components/gdp/gdp-public-shell.tsx
16 | components/gdp/gdp-rate-admin.tsx
9 | components/gdp/gdp-sidebar.tsx
4 | components/gdp/gdp-world-map.tsx
6 | components/gentle-pulse/gentle-pulse-public-shell.tsx
1 | components/gentle-pulse/gp-icon-rail.tsx
3 | components/gentle-pulse/gp-player.tsx
2 | components/gentle-pulse/gp-right-panel.tsx
3 | components/gentle-pulse/gp-sessions.tsx
1 | components/gentle-pulse/gp-sidebar.tsx
4 | components/skill-up/skill-up-public-shell.tsx
1 | components/skill-up/su-achievements.tsx
20 | components/skill-up/su-admin-shell.tsx
3 | components/skill-up/su-browse.tsx
1 | components/skill-up/su-progress.tsx
1 | components/skill-up/su-right-panel.tsx
2 | components/skill-up/su-trainers.tsx
2 | components/skill-up/su-wallet.tsx
20 | components/lighthouse/lighthouse-admin-shell.tsx
11 | components/lighthouse/lighthouse-browse.tsx
7 | components/lighthouse/lighthouse-chat.tsx
8 | components/lighthouse/lighthouse-filter-sidebar.tsx
2 | components/lighthouse/lighthouse-icon-rail.tsx
9 | components/lighthouse/lighthouse-matches.tsx
22 | components/lighthouse/lighthouse-property-detail.tsx
5 | components/lighthouse/lighthouse-public-shell.tsx
7 | components/lighthouse/lighthouse-right-panel.tsx
7 | components/mood/mood-public-shell.tsx
5 | components/peer-programming/peer-programming-public-shell.tsx
8 | components/peer-programming/pp-admin-assignments.tsx
14 | components/peer-programming/pp-admin-shell.tsx
6 | components/peer-programming/pp-admin-topic-form.tsx
7 | components/peer-programming/pp-chat-tab.tsx
23 | components/peer-programming/pp-cohorts-tab.tsx
2 | components/peer-programming/pp-icon-rail.tsx
7 | components/peer-programming/pp-right-panel.tsx
6 | components/peer-programming/pp-session-call.tsx
6 | components/peer-programming/pp-session-tab.tsx
4 | components/peer-programming/pp-sidebar.tsx
6 | components/plugins/generic-public-shell.tsx
1 | components/plugins/public-shell-back-link.tsx
4 | components/recurring-activity/recurring-activity-create-form.tsx
2 | components/recurring-activity/recurring-activity-item.tsx
15 | components/safety/safety-admin-shell.tsx
6 | components/service-credits/sc-circulation-tab.tsx
8 | components/service-credits/sc-earn-tab.tsx
2 | components/service-credits/sc-icon-rail.tsx
13 | components/service-credits/sc-send-panel.tsx
3 | components/service-credits/sc-sidebar.tsx
14 | components/service-credits/sc-wallet-tab.tsx
6 | components/service-credits/sca-circulation-panel.tsx
6 | components/service-credits/sca-credit-limits-panel.tsx
5 | components/service-credits/sca-disputes-panel.tsx
14 | components/service-credits/sca-fields.tsx
5 | components/service-credits/sca-governance-panel.tsx
7 | components/service-credits/sca-ledger-status.tsx
7 | components/service-credits/sca-treasury-panel.tsx
5 | components/service-credits/sca-wallet-status-panel.tsx
8 | components/service-credits/service-credits-admin-shell.tsx
5 | components/service-credits/service-credits-public-shell.tsx
1 | components/shared/app-loading.tsx
4 | components/shared/form-field.tsx
2 | components/shared/mobile-screen-header.tsx
1 | components/shared/mobile-top-actions.tsx
1 | components/shared/plugin-admin-button.tsx
1 | components/shared/plugin-rail-footer.tsx
5 | components/shared/share-link.tsx
6 | components/shared/stream-chat-panel.tsx
3 | components/skills-hunt/sh-icon-rail.tsx
8 | components/skills-hunt/sh-leaderboard-tab.tsx
12 | components/skills-hunt/sh-missions-tab.tsx
12 | components/skills-hunt/sh-my-finds-tab.tsx
7 | components/skills-hunt/sh-notifications.tsx
9 | components/skills-hunt/sh-right-panel.tsx
27 | components/skills-hunt/sh-scout-tab.tsx
9 | components/skills-hunt/sh-sidebar.tsx
17 | components/skills-hunt/sh-skills-picker.tsx
5 | components/skills-hunt/sha-filters.tsx
13 | components/skills-hunt/sha-missions.tsx
8 | components/skills-hunt/sha-moderation.tsx
12 | components/skills-hunt/sha-reports.tsx
7 | components/skills-hunt/sha-reward-card.tsx
12 | components/skills-hunt/sha-round-manager.tsx
14 | components/skills-hunt/sha-table.tsx
5 | components/skills-hunt/skills-hunt-admin-shell.tsx
11 | components/skills-hunt/skills-hunt-public-shell.tsx
13 | components/skills-taxonomy/skills-taxonomy-public-shell.tsx
1 | components/skills-taxonomy/st-empty-state.tsx
1 | components/skills-taxonomy/st-icon-rail.tsx
3 | components/skills-taxonomy/st-sectors-column.tsx
1 | components/skills-taxonomy/st-skills-detail.tsx
2 | components/skills-taxonomy/st-titles-column.tsx
20 | components/socket-relay/socket-relay-admin-shell.tsx
9 | components/socket-relay/sr-chat.tsx
13 | components/socket-relay/sr-feed.tsx
1 | components/socket-relay/sr-icon-rail.tsx
7 | components/socket-relay/sr-post.tsx
5 | components/socket-relay/sr-right-panel.tsx
3 | components/socket-relay/sr-sidebar.tsx
8 | components/trust-transport/trust-transport-admin-accounts.tsx
24 | components/trust-transport/trust-transport-admin-shell.tsx
11 | components/trust-transport/trust-transport-public-shell.tsx
18 | components/trust-transport/tt-book-tab.tsx
10 | components/trust-transport/tt-chat-tab.tsx
19 | components/trust-transport/tt-earnings-tab.tsx
25 | components/trust-transport/tt-help-tab.tsx
2 | components/trust-transport/tt-icon-rail.tsx
8 | components/trust-transport/tt-right-panel.tsx
10 | components/trust-transport/tt-sidebar.tsx
22 | components/trust-transport/tt-tracking-tab.tsx
12 | components/trust/TrustWidgetCard.tsx
12 | components/trust/trust-public-shell.tsx
5 | components/ui/button.tsx
4 | components/ui/dialog.tsx
32 | components/unlock/unlock-admin-shell.tsx
1 | components/unlock/unlock-icon-rail.tsx
8 | components/unlock/unlock-public-shell.tsx
3 | components/unlock/unlock-right-rail.tsx
1 | components/unlock/unlock-sidebar.tsx
2 | components/unlock/unlock-status-card.tsx
10 | components/weekly-performance/weekly-performance-public-shell.tsx
3 | components/weekly-performance/wp-admin-shell.tsx
1 | components/weekly-performance/wp-dashboard-main.tsx
1 | components/weekly-performance/wp-icon-rail.tsx
7 | components/weekly-performance/wp-metric-cards.tsx
2 | components/weekly-performance/wp-right-rail.tsx
3 | components/weekly-performance/wp-sidebar.tsx
16 | components/what-works/what-works-public-shell.tsx
9 | components/what-works/ww-admin-problems.tsx
15 | components/what-works/ww-admin-products.tsx
11 | components/what-works/ww-admin-shell.tsx
2 | components/what-works/ww-hero.tsx
1 | components/what-works/ww-icon-rail.tsx
1 | components/what-works/ww-product-card.tsx
6 | components/what-works/ww-public.tsx
4 | components/what-works/ww-right-rail.tsx
6 | components/what-works/ww-sidebar.tsx
11 | components/what-works/ww-suggest-panel.tsx
12 | components/workforce/workforce-admin-shell.tsx
10 | components/workforce/workforce-bucket-drilldown.tsx
11 | components/workforce/workforce-hero-stats.tsx
3 | components/workforce/workforce-icon-rail.tsx
12 | components/workforce/workforce-member-list.tsx
31 | components/workforce/workforce-occupations.tsx
13 | components/workforce/workforce-profile-panel.tsx
10 | components/workforce/workforce-public-shell.tsx
12 | components/workforce/workforce-sector-gaps.tsx
10 | components/workforce/workforce-sidebar.tsx
7 | components/workforce/workforce-skill-distribution.tsx
6 | components/workforce/workforce-training-gaps.tsx
```

### Session (2026-07-07) cont. — Workforce plugin converted (reference implementation)
- Added `components/workforce/workforce-shared.ts` exporting `getWorkforceTokens(theme)` and refactored
  `workforce-shell.tsx` to consume it (removed its private duplicate).
- Converted all signed-in, member-facing Workforce components to `t.*` chrome tokens (typecheck green,
  default theme byte-identical): icon-rail, sidebar, hero-stats, training-gaps, skill-distribution,
  sector-gaps, bucket-drilldown, member-list, profile-panel, occupations. Status/data-viz swatches
  (#22C55E/#EF4444/#F59E0B/#6366F1/#3B82F6/#A855F7) left RAW per §F3.
- Added `scripts/tokenize-theme.py`: the repeatable transformer used for this pass. Usage:
  `python3 scripts/tokenize-theme.py <file.tsx> get<P>Tokens ./<p>-shared COLOR '#ACCENTHEX'`.
  It maps chrome hex/rgba → `t.*`, rewrites the plugin accent, adds `useTheme`+getter imports, and
  injects the `const { theme } = useTheme(); const t = get<P>Tokens(theme);` hook into each
  PascalCase component that references `t.`. ALWAYS run `pnpm --filter @ctf/web run typecheck` after —
  it catches the two unsafe cases (module-scope color aliases; components the detector misses).

#### Deliberately deferred (NOT bugs — need an owner call, see below)
- `workforce-public-shell.tsx` — signed-OUT visitor page. The comic theme only applies to signed-in
  users, so converting it changes nothing visually and only adds risk. Left raw.
- `workforce-admin-shell.tsx` — uses the **shared admin palette** (`#161B27` surface, `#1E2A3A`
  border) that is NOT part of `getPluginShellTokens` and is common to ALL admin shells. This needs its
  own admin token group rather than being folded into a per-plugin helper. New open question Q3.

#### New open question
- **Q3 (admin token group):** Admin shells across plugins share `#161B27`/`#1E2A3A` (matches
  `--ctf-surface`/`--ctf-border` in globals.css). Create a single `getAdminShellTokens(theme)` (or add
  SURFACE/BORDER to the plugin shell tokens) and convert all admin shells together, or leave admin
  chrome as-is? Recommend a dedicated admin token helper.

### Session (2026-07-07) cont. — 4 more plugins converted (gdp, service-credits, skills-hunt, socket-relay)
- Converted all signed-in member-facing components (24 files) to `t.*` chrome tokens via
  `scripts/tokenize-theme.py`. typecheck green; default theme byte-identical.
- Transformer hardened: (a) never rewrites the accent identifier inside import statements and drops it
  from the shared import when it becomes unused; (b) handles multi-line imports; (c) balanced
  paren/brace component detection so params containing `() => void` no longer defeat hook insertion.
- Module-scope color usages the per-component hook cannot reach are left as the original default hex
  (documented residuals — pixel-safe): sc-send-panel input styles, sc-wallet-tab amount color,
  sh-missions-tab colorHex fallback, sr-feed edit button. sh-scout-tab's `fieldBorder` helper was
  refactored to take `t` as a parameter instead.
- Deferred (same reasons as workforce): every `*-admin-shell`, `sca-*`, `sha-*` (admin palette, Q3)
  and every `*-public-shell` (signed-out, comic N/A). gdp-world-map (data-viz) not yet reviewed.
- REMAINING plugins with a shared getter still to sweep: chyme, click-log, contributions,
  gentle-pulse, mood, recurring-activity, skills-taxonomy, trust-transport, unlock,
  weekly-performance (these have slot overrides/custom token fields — verify each shared file's exact
  hex→field map before running the transformer; do NOT assume the standard map). Plus all plugin dirs
  with NO shared getter yet (need a `<p>-shared.ts` created first, workforce-style).

### Session (2026-07-07) cont. — custom-token plugins analyzed (NOT yet converted)
The remaining shared-getter plugins (chyme, click-log, contributions, gentle-pulse, mood,
recurring-activity, skills-taxonomy, trust-transport, unlock, weekly-performance) are a DIFFERENT and
riskier conversion tier — do not run the standard transformer on them:

- Their `*-shared.ts` exports **static named color constants** (e.g. chyme `PRIMARY`/`DARK_BG`/
  `PANEL_BG`/`TITLE`/`BORDER`; click-log `BRAND`/`BG`/`SURFACE`/`BORDER`/`TEXT`/`SUBTLE`/`FAINT`) AND a
  `get<P>Tokens(theme)` that overrides specific slots + adds custom fields (chyme `ACCENT_TINT_*`,
  click-log `BORDER_SOLID`).
- The child components mostly **import those static constants** rather than inlining hex, so they are
  theme-blind today. Converting them means replacing each imported CONSTANT with the matching
  `t.<FIELD>` from `get<P>Tokens(theme)` — a constant→token swap, not a hex→token swap. Requires a
  per-plugin name map and `useTheme()` wiring in every child.
- BLOCKER: some of these constants are the **admin-surface palette** with NO plugin-shell-token
  equivalent (click-log `SURFACE=#161B27`, `BORDER=#1E2A3A`; contributions similar). These are exactly
  the colors in open question **Q3**. A correct conversion needs the Q3 admin/surface-token decision
  first, otherwise these constants must stay static (partial comic theming).

Recommended next-session order once Q3 is answered:
1. Resolve Q3 (add SURFACE/BORDER_SOLID-style slots to the shell tokens, or a `getAdminShellTokens`).
2. Per custom plugin: build the constant→token name map from its `*-shared.ts`, wire `useTheme()` +
   `get<P>Tokens` into each child, replace imported constants with `t.*`, keep status/data-viz raw,
   typecheck. Then sweep the deferred `*-admin-shell` files using the Q3 helper.
3. Plugin dirs with NO shared getter yet: create a `<p>-shared.ts` (workforce-style) first, then use
   scripts/tokenize-theme.py for the standard-map children.

### State at end of session
- Converted + pushed (typecheck green, default byte-identical): **workforce, gdp, service-credits,
  skills-hunt, socket-relay** (member-facing components only).
- PR #1400 open on branch `design/brand-cohesion-theme-token-pass`.
- Tooling committed: `scripts/tokenize-theme.py`.
- Deferred, awaiting owner: all `*-admin-shell` + `*-public-shell`; all custom-token plugins (above);
  data-viz colors (Q1); cross-platform reconciliation (Q2); admin/surface token group (Q3).

### Session (2026-07-08/09) — WEB PASS COMPLETE (owner directive: "100% pixel perfect, cohesive, no gaps")
Owner resumed the pass and directed full cohesion. Everything below is committed and pushed on this
branch; every commit passed the pre-commit typecheck gate and the pre-push lint+typecheck+build gate.

**Corrections to earlier assumptions:**
- **Public shells ARE in scope.** The comic no-flash script runs in the ROOT layout
  (`app/layout.tsx`) unconditionally — a signed-out visitor with `sh-theme=comic` in localStorage
  gets comic CSS variables on public pages. The earlier "signed-out = comic N/A" deferral was wrong;
  all `*-public-shell` files were converted.
- **The hex audit had a blind spot:** files that import static color CONSTANTS from a `*-shared.ts`
  (no inline hex) are theme-blind but invisible to a hex grep. A constant-import sweep found and
  converted 7 such files (click-log-incident-list, su-sidebar, su-cohort-card, wp-comparison-chart,
  wp-empty-main, ww-suggest-guidance, ww-problem-section).
- **CSS modules were outside the original audit.** Themed via `var(--ctf-X, #exactdefault)`
  substitution (byte-identical under default by definition): `comic-review-dashboard.module.css`
  (41 subs), `admin-landing.module.css` (15), `bug-report-modal.module.css` (2),
  `community-shell.module.css` (3 stragglers). `loading.module.css` untouched (spec §11).

**Work landed (chronological commits):**
1. Q3 infra: `SURFACE`/`BORDER_SOLID` slots added to `getPluginShellTokens`; transformer map updated.
2. Batch 1 — workforce, gdp, service-credits (sca-*), skills-hunt (sha-*), socket-relay,
   trust-transport: all admin shells/panels, public shells, remaining member surfaces, world-map chrome.
3. Batch 2 — custom-token tier: chyme, click-log, contributions (was already token-wired via t props),
   recurring-activity, gentle-pulse, mood, skills-taxonomy, unlock, weekly-performance.
4. Batch 3 — foundation (getter lives in `foundation-ui.ts`), lighthouse, peer-programming, skill-up,
   what-works, directory.
5. Batch 4 — new workforce-style getters created for dirs that had none: `beacon-shared.ts`,
   `bug-reports-shared.ts`, `comic-shared.ts`, `safety-shared.ts`, `feed-announcements-shared.ts`,
   `trust-shared.ts`; community-shell stragglers; cross-plugin shared components + server-component
   app pages via `var(--ctf-*)` (server components MUST use vars — `useTheme` throws outside the
   provider; `ui/button.tsx`, `ui/dialog.tsx`, `mobile-screen-header`, `mobile-top-actions`,
   `share-link` were already var-based and needed nothing).
6. Constant-importer sweep (7 files) + CSS modules (above).

**Documented residuals (intentional, all verified raw-by-reason):**
- Status/data-viz palettes everywhere (Q1 answered: spec keeps them identical under comic).
- ADMIN badge indigo triplet (`#6366F1` + rgba tints) on every admin shell.
- Contrast inks on accent fills (`#fff`, `#000`, and the accent-pinned inks in Q6).
- White-alpha values with no token (0.02/0.03/0.05/0.07/0.12/0.15/0.16), role-mismatched
  exact-value cases left raw case-by-case (documented per agent report in PR history).
- `trust-transport` `STATIC_RIDE_TYPES`/`deriveRideTypes` keep `color: COLOR` (#38BDF8) — built in
  `trust-transport-shell.tsx`, flows to tt-sidebar/tt-book-tab as data; needs accent threading.
- skills-hunt `STATUS_OPTIONS` flagged/archived chips stay static `#FBBF24` under comic (part of
  mixed status palettes).
- chyme `#041a0b` CARD_BG + `#16A34A` ACCENT_CYAN constants static (no sanctioned comic value).
- `#38BDF8` in community chat (Q5) and `--ctf-surface-raised` (Q4) await owner calls.
- `app-loading.tsx` + `loading.module.css` (spec §11) and `stream-chat-panel.tsx` (contrast helper)
  untouched by design.

## 10. Mobile pass — COMPLETE (2026-07-10)

The Android/React-Native pass is done and pushed. Every non-loading feature screen and shared
component in `ctf/packages/mobile/src` now reads `makeStyles(tokens, accent)` from `useTheme()`
(idiom exemplar: `features/blocks/BlockedMembers.tsx`), so both themes resolve. Default theme is
byte-identical by construction — `getThemeTokens('default')` returns the shipped palette and
`getAppAccent(slug,'default')` returns the shipped accent. `pnpm --filter @ctf/mobile run typecheck`
green.

- Covered: announcements, chyme, click-log, comic, community, contributions, currency, directory,
  feed, foundation, gdp, gentle-pulse, skill-up, lighthouse, mood, peer-programming,
  recurring-activity, service-credits (incl. the `sc-styles.ts` shared sheet → `makeStyles` factory),
  skills-hunt, skills-taxonomy, socket-relay, trust, trust-transport, unlock, weekly-performance,
  workforce, and shared components (FormField, ShareLink, StreamChatSearch, etc.).
- Added `recurring-activity` to the mobile `PLUGIN_ACCENTS` table (`standard #2DD4BF`,
  `comic #0F5C54`) to match the web table verbatim — it was the one plugin missing from mobile.

**Mobile residuals (intentional, verified raw-by-reason):**
- **`#9CA3AF` and `#E8EAF0` have NO mobile token** (mobile `textSecondary` is `#6B7280` — the exact
  Q2/F4 web↔mobile naming collision). They recur across most screens and stay raw until Q2 is
  decided. This is the single biggest mobile residual and the strongest reason to resolve Q2.
- Status/data-viz palettes, wellbeing mood-scale colors (`mood/Mood.tsx` MOODS), ledger-direction
  greens/reds, ADMIN badge indigo — raw per §F3.
- `#0D0F14` admin-panel surface + `rgba(255,255,255,0.08)` admin border have no mobile token slot
  (mobile has no admin-surface token yet — the mobile analogue of the web Q3 group). Candidate for a
  future mobile `surfaceAdmin`/`borderStrong` slot.
- Accent/status **rgba tints** (`rgba(132,204,22,…)`, `rgba(34,197,94,…)`, etc.) left raw — not
  byte-identical to any `${accent}NN` hex-suffix form. Only pre-existing string-concat composites
  (`COLOR + '20'`) converted cleanly.
- Loading screens (`*Loading.tsx`, `LoadingScreen.tsx`) untouched (spec §11).
- **Two likely copy-paste bugs found, left raw (out of scope for a token pass):**
  `trust-transport/TrustTransportStreamTab.tsx` and `questions/Questions.tsx` each color an
  ActivityIndicator `#F97316` (workforce-orange, not their own accent) and use `color: 'red'` for
  errors. Worth a follow-up fix.
- Hub-level screens `community/Community.tsx` (`#22C55E`) and `announcements/Announcements.tsx`
  (`#84CC16`) keep their accent raw — no slug in `PLUGIN_ACCENTS` (same as web contributions).

## 11. Remaining work (resumable)

The token pass itself is functionally complete on both platforms. What's left is owner decisions and
optional hardening — none blocks the pass:

1. Owner calls: **Q2** (cross-platform value reconciliation — resolving it defines a mobile
   `textSecondary`/`textSubtle` split and clears the biggest mobile residual), **Q4**
   (`--ctf-surface-raised` undefined var), **Q5** (community-chat cyan under comic), **Q6**
   (accent-pinned contrast inks). A mobile admin-surface token (`#0D0F14`/`0.08` group) is the
   mobile sibling of the resolved web Q3 — bundle it with Q2.
2. Two copy-paste spinner bugs (mobile stream/questions `#F97316` + `color: 'red'`) — small fix.
3. Optional CI hardening: a grep gate failing on new raw chrome hex in `web/components/**` and
   `mobile/src/features/**` (the exact-match tables in this doc are the spec). This is what would
   keep the pass from regressing.
