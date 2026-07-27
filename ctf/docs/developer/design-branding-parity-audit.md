# Web ↔ Mobile Branding Parity — Audit & Execution Plan

> Status: **in progress.** Branch `feat/web-mobile-branding-parity` (off `main`).
> Goal (owner, 2026-07-11): the web and mobile apps should present the **same branding / experience**.
> Web is the reference (per the Q2 decision in `design-cohesion-pass-session-continuity.md`).
> This doc is the resumable source of truth: findings + exact fix recipes + a status checklist.
> A future session resumes from §3 (checklist) — do the first unchecked item.

## 1. What already matches (do NOT re-do)

- **Color palette** — every surface/text/border/danger/success/gold token is identical in BOTH
  default and comic themes (web `app/globals.css` ↔ mobile `src/theme/theme-tokens.ts`). Q2 aligned it.
- **Per-plugin accent table** — 24 shared slugs match verbatim (standard + comic), plus `FALLBACK`.
  One exception: `beacon` (see §3 QW1).
- **Card + chip radius**; comic sharp-0 corners.
- **Loading screen** — "Exit Their Economy / Exit The Psyop", one shared component per platform,
  deliberately not theme-toggled. Fully aligned (web `components/shared/app-loading.tsx` ↔ mobile
  `src/components/shared/LoadingScreen.tsx`). Leave as-is.
- **Comic token set + theme sync** (`sh-theme` key via `/api/account/ui-preferences`).

## 2. Findings — where branding diverges (ranked by impact)

1. **Mobile has no brand mark; web does.** Web shell: "SH" logo chip with the purple→cyan gradient
   `linear-gradient(135deg,#7C3AED,#0EA5E9)`, glowing icon rail, grid of colored emoji app-tiles
   (`components/community-shell/shell-icon-rail.tsx`, `shell-plugin-config.ts`, `community-shell.module.css`).
   Mobile home (`App.tsx`) is a plain-text "ChargingTheFuture Mobile" + a row of text pills — no logo,
   no gradient, no tiles.
2. **Brand font (Inter) is never actually shipped.** Web declares `Inter` everywhere but loads no
   webfont (no `next/font`, no `@font-face`) → falls to system-ui unless the OS has Inter. Mobile never
   requests Inter → renders OS default (SF/Roboto). No shared typeface guaranteed.
3. **Comic signature look is 3/4 missing on mobile.** Web comic adds: (a) halftone dot texture
   (`--ctf-dot-bg: radial-gradient(#d4c49a1a 1px,transparent 1px)`, `--ctf-dot-size 8px 8px`),
   (b) hard offset cream shadow (`--ctf-elevation-shadow: 3px 3px 0 #d4c49a`), (c) sharp corners,
   (d) flat-ink CTA panel (`--ctf-cta-bg #141414`, `--ctf-cta-border #d4c49a`, `--ctf-cta-text #d4c49a`).
   Mobile carries only (c). No shadow/dot/cta fields exist in mobile `ThemeTokens`.
4. **Brand pink `#e91e8c` + purple→cyan CTA gradient** — no mobile token at all.
5. **No per-plugin emoji/icon tiles on mobile** — web gives each app a colored glyph; mobile is
   text-label + accent only.
6. **Different icon systems** — web lucide-react (~220 files); mobile `@expo/vector-icons` (Ionicons,
   ~20 files) + emoji. Glyphs don't match shape-for-shape.
7. **No shared mobile UI primitives** (Button/Badge/Card) and **no shared type scale** on either side.
   Type has drifted: titles 700(web)/800(mobile); buttons 13/15px; hero number 56/48px; letter-spacing
   `em`(web) vs raw points(mobile).
8. **Small data mismatches:** `LightHouse`(web)/`Lighthouse`(mobile) casing; web emoji map missing
   ~8 slugs (grey 🔌 fallback) + GDP keyed only under `gross-domestic-product`; web accent table
   missing `beacon`; mobile has no `control-radius` (10px) so controls are 14px (too round vs web).

## 3. Execution checklist (resumable — do the first unchecked item)

Quick wins first (small, low-risk), then everything else. Commit + push per item; keep both
`pnpm --filter @ctf/web run typecheck` and `pnpm --filter @ctf/mobile run typecheck` green.

### Quick wins — ALL DONE (commit 93a240a)

- [x] **QW1 — add `beacon` to web `PLUGIN_ACCENTS`.** File `packages/web/lib/theme/theme-tokens.ts`.
  Add `beacon: { standard: '#F59E0B', comic: '#7A4A05' }` (matches mobile + the web `BEACON_COLOR`).
- [x] **QW2 — plugin-name casing `Lighthouse` → `LightHouse` on mobile** to match web's camelCase
  compound convention (ServiceCredits/TrustTransport/SkillsHunt). Grep mobile for the `Lighthouse`
  display string (screen header/nav label) and align. Do NOT change the slug `lighthouse`.
- [x] **QW3 — fill web `PLUGIN_VISUALS` emoji gaps** in `packages/web/components/community-shell/shell-plugin-config.ts`.
  Add: `gdp` (alias of gross-domestic-product 🗺️), `level-up` 🎯, `what-works` 🧰, `beacon` 📡,
  `contributions` 🎁, `recurring-activity` 🔁, `trust` 🛡️, `unlock` 🔓. Use each plugin's accent for
  `color` (from PLUGIN_ACCENTS) and its shipped card `bg`. (Chosen emojis are defaults — owner may retune.)
- [x] **QW4 — add `controlRadius` to mobile tokens** `packages/mobile/src/theme/theme-tokens.ts`
  (default 10 / comic 0) mirroring web `--ctf-control-radius`. (Applying it to buttons/inputs is E5.)

### Everything else — status

Delivered on `feat/web-mobile-branding-parity` (PR): E1, E2, E3, E4, E5-primitives. Remaining:
E5-adoption (incremental screen migration onto the primitives/typeScale) and E6 (owner decision).

- [x] **E1 — ship Inter on both platforms.** Web: `@fontsource/inter` imported in `app/layout.tsx`
  (family registers as `Inter`, so every existing `font-family: Inter` declaration now renders it;
  build-verified, no build-time network). Mobile: `@expo-google-fonts/inter` loaded via `useFonts`
  in `App.tsx` (loading screen until ready); the shared `typeScale` pins the matching Inter family
  per weight (RN needs the weight in the family name), so primitives + the launcher render real Inter.
  Un-migrated screens keep the OS default until they adopt `typeScale` (no regression).
- [x] **E2 — mobile branded launcher.** `App.tsx` now shows the "SH" gradient brand chip
  (`react-native-svg`, purple→cyan default / flat-ink cream comic) + a "Charging The Future" wordmark,
  and every nav pill carries its plugin emoji + the plugin accent on the active state. Routing/IA
  unchanged.
- [x] **E3 — comic signature treatments on mobile.** Delivered via the `Card` primitive: hard offset
  cream shadow (absolutely-positioned sibling View — RN can't box-shadow-offset), halftone dot texture
  (`DotTexture` via `react-native-svg`), sharp corners. `CtaButton` carries the comic flat-ink panel.
  (These live in the primitives; screens get them as they adopt `Card`/`CtaButton` — see E5-adoption.)
- [x] **E4 — brand tokens on mobile.** `brand` (#E91E8C / comic #C8A84B) + `brandText` added to
  `ThemeTokens`; the purple→cyan CTA gradient lives in `Button`(variant `brand`)/`CtaButton` and the
  launcher `BrandMark`.
- [~] **E5 — shared mobile primitives + type scale.** DONE: `src/components/ui/` (`Card`, `Button`,
  `CtaButton`, `Badge`, `DotTexture`, `typeScale`) + `src/theme/plugin-visuals.ts`. REMAINING
  (incremental, non-blocking): migrate existing feature screens off their hand-rolled `StyleSheet`
  font sizes/buttons/cards onto `typeScale` + the primitives so every screen renders Inter at the
  web-matched scale and gets the comic treatments. Do this plugin-by-plugin in follow-up PRs.
- [x] **E6 — icon system reconciliation. DONE (2026-07-20, owner-approved).** Scoped to the Android
  keep-list (see §3b). Added `lucide-react-native` (renders via the already-present `react-native-svg`)
  and swapped the emoji *action/chrome* glyphs to the matching lucide vectors web uses — Chyme
  (Radio, Mic/MicOff, Hand, MessageSquare, Phone, Lock, Coins, Send), account-data (Trash2, Lock,
  CheckCircle, X, AlertTriangle), blocks (ShieldOff, UserX, Ban, X), bug-reporting (CheckCircle,
  AlertCircle, Clock, X). Emoji kept for plugin-tile identity (launcher pills) and where web keeps it
  (Chyme 🎙️ wordmark, ✋ tile, 🔴 Live). Branch `feat/android-lucide-icons`.
  FOLLOW-UP (small, optional): a handful of emoji are embedded *inside label strings* (e.g. the
  "⚠️ Danger Zone" tab, "🚫 Block member" trigger) — converting them needs an icon+text row
  restructure, left as emoji for now to avoid layout changes on sensitive surfaces (account deletion,
  blocking).

## 3a. Scope update (2026-07-20) — Android is Chyme-only

Main has since narrowed the native Android app to a small **keep-list** (rule 105): `FeatureKey` in
`App.tsx` is now just `chyme | account-data | blocked-members | bug-report`; everything else is served
by the **web app**, which is now an installable **PWA** covering the whole product on phones. The
product also rebranded — at the time of this audit to "TI Skills Economy (TSE)", and since then (commit
`bb0aa50`) to **"Skills Economy" / "SE"** with the Stack mark (see `app/layout.tsx` metadata).

Consequences for E5-adoption:
- **E5 is scoped to the Android keep-list screens** (Chyme + account-data + blocked-members +
  bug-reporting) — migrating the other, now web-only, mobile feature screens would be wasted.
- **Approach for these screens:** render **Inter** at their existing, mockup-tuned sizes by adding
  `fontFamily: interFamily(<weight>)` to each text style (helper in `components/ui/typography.ts`),
  rather than re-scaling onto `typeScale` or forcing the generic `Card`/gradient-`CtaButton`
  primitives — Chyme has an intentional deep-green identity and is already fully theme-aware, so a
  blanket primitive swap would regress it. The brand-font adoption is the concrete "same branding" win.
- **RESOLVED — brand-name reconciliation.** Settled by the owner in commit `bb0aa50`: the one product
  name is **Skills Economy** (short form **SE**) with the Stack mark. The old "TI Skills Economy (TSE)"
  name and the mobile launcher's "SH" gradient chip are both retired.

## 4. Progress log

- 2026-07-11: Audit run (3 parallel agents: tokens, typography, brand/components). Findings recorded
  above. Doc created.
- 2026-07-11: Quick wins QW1–QW4 shipped. Then E1–E5(primitives) shipped on
  `feat/web-mobile-branding-parity`: brand/brandText/controlRadius tokens; shared UI primitives
  (`Card`/`Button`/`CtaButton`/`Badge`/`DotTexture`) + `typeScale` + `plugin-visuals`; comic
  signature treatments (offset shadow, dot texture, flat-ink CTA) in the primitives; branded launcher
  (SH gradient logo + emoji pills); Inter shipped on web (`@fontsource/inter`) and mobile
  (`@expo-google-fonts/inter`). Web build verified; both packages typecheck green.
- REMAINING: **E5-adoption** — migrate feature screens onto `typeScale` + the `Card`/`Button`
  primitives (plugin-by-plugin, follow-up PRs) so every screen (not just the launcher/primitives)
  renders Inter at the web-matched scale and picks up the comic treatments. **E6** — icon-system
  unification is an owner decision (see the E6 recommendation above); not done silently.
- 2026-07-20: Scope narrowed — Android is now a Chyme-only keep-list (§3a). E5-adoption re-scoped to
  those screens; delivering brand-font (Inter) adoption on the Chyme + keep-list screens via
  `interFamily` (no re-scaling / no primitive swap, to preserve Chyme's bespoke design). Branch
  `feat/chyme-primitives-adoption`. Brand-name reconciliation (TSE vs "SH"/"Charging The Future")
  raised to owner.
