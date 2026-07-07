# Design Cohesion Pass — Findings & Session Continuity

> Status: **in progress**. Branch `design/brand-cohesion-theme-token-pass`.
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
hex AND consume **no** theme helper, so they render identical greys/surfaces under both themes ⇒
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

- **Q1 (status colors):** Should bright status/data-viz colors (`#EF4444` danger, `#22C55E` success,
  `#F59E0B`, chart palettes) get comic-theme variants (spec has danger/success), or stay raw as the
  shipped `workforce-shell.tsx` does? Current pass keeps them RAW.
- **Q2 (cross-platform reconciliation):** Which side wins the F4 deltas — web `#B91C1C` danger vs
  mobile `#EF4444`; the textSecondary/textSubtle naming; card radius 14 vs 12? Changing either
  touches prod pixels, so it is gated on your call.

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
4 | components/level-up/level-up-public-shell.tsx
1 | components/level-up/lu-achievements.tsx
20 | components/level-up/lu-admin-shell.tsx
3 | components/level-up/lu-browse.tsx
1 | components/level-up/lu-progress.tsx
1 | components/level-up/lu-right-panel.tsx
2 | components/level-up/lu-trainers.tsx
2 | components/level-up/lu-wallet.tsx
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
