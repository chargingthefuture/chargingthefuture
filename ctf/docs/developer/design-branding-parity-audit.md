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

### Quick wins

- [ ] **QW1 — add `beacon` to web `PLUGIN_ACCENTS`.** File `packages/web/lib/theme/theme-tokens.ts`.
  Add `beacon: { standard: '#F59E0B', comic: '#7A4A05' }` (matches mobile + the web `BEACON_COLOR`).
- [ ] **QW2 — plugin-name casing `Lighthouse` → `LightHouse` on mobile** to match web's camelCase
  compound convention (ServiceCredits/TrustTransport/SkillsHunt). Grep mobile for the `Lighthouse`
  display string (screen header/nav label) and align. Do NOT change the slug `lighthouse`.
- [ ] **QW3 — fill web `PLUGIN_VISUALS` emoji gaps** in `packages/web/components/community-shell/shell-plugin-config.ts`.
  Add: `gdp` (alias of gross-domestic-product 🗺️), `level-up` 🎯, `what-works` 🧰, `beacon` 📡,
  `contributions` 🎁, `recurring-activity` 🔁, `trust` 🛡️, `unlock` 🔓. Use each plugin's accent for
  `color` (from PLUGIN_ACCENTS) and its shipped card `bg`. (Chosen emojis are defaults — owner may retune.)
- [ ] **QW4 — add `controlRadius` to mobile tokens** `packages/mobile/src/theme/theme-tokens.ts`
  (default 10 / comic 0) mirroring web `--ctf-control-radius`. (Applying it to buttons/inputs is E5.)

### Everything else (bigger, ordered by impact)

- [ ] **E1 — ship Inter on both platforms.**
  - Web: self-host via `next/font/local` (add Inter .woff2 to `packages/web`) or `@fontsource/inter`;
    wire in `app/layout.tsx` and set the CSS var/`font-family` to the loaded family. Keep the existing
    stack as fallback.
  - Mobile: `@expo-google-fonts/inter` + `useFonts` in `App.tsx` (block render until loaded), and set a
    default `fontFamily` — either a `<Text>` wrapper/default or a `fontFamily` token in `ThemeTokens`
    consumed by the shared primitives (E5).
- [ ] **E2 — mobile branded shell.** Re-skin `App.tsx` home into a branded launcher: the "SH" logo chip
  (gradient via `expo-linear-gradient`), brand gradient accent, and a grid of per-plugin emoji tiles
  (reuse web's emoji↔accent map). Preserve the existing `featureOrder` → screen routing; this is a
  re-skin of the launcher, not an IA change.
- [ ] **E3 — comic signature treatments on mobile.** Extend mobile `ThemeTokens` with the comic look:
  a shadow field (`elevationShadow`: default soft `{0,4,12,0.3}`; comic hard offset `3px 3px 0 #d4c49a`
  → RN `shadowColor/Offset/Opacity/Radius` + `elevation`), a dot-texture flag/asset (RN has no CSS
  dot-gradient — use a tiled `ImageBackground` or an SVG dot pattern component behind comic surfaces),
  and CTA tokens (`ctaBg/ctaBorder/ctaText`: default gradient marker + white; comic `#141414`/`#d4c49a`/
  `#d4c49a`). Apply to shared card/CTA primitives (depends on E5).
- [ ] **E4 — brand token on mobile.** Add `brand` (default `#e91e8c` / comic `#c8a84b`) + `brandText`
  (`#ffffff` / `#0d0d0d`) to mobile `ThemeTokens`, and a CTA gradient helper (expo-linear-gradient
  `#7c3aed→#0ea5e9`) for the logo/CTA. Consumed by E2/E5.
- [ ] **E5 — shared mobile primitives + type scale.** Create `src/components/ui/`: `Button` (variants
  incl. brand-gradient CTA), `Badge`, `Card`, mirroring web `components/ui/*`. Add a shared typography
  scale module (title/heading/body/label/button sizes+weights+tracking) matching web's values; adopt
  Inter (E1). Repoint control elements to `controlRadius` (QW4). Migrate high-traffic screens onto the
  primitives (incremental).
- [ ] **E6 — icon system reconciliation (owner decision).** Web uses lucide; mobile uses Ionicons +
  emoji. Full unification touches ~220 web files or the whole mobile icon approach — too large to do
  silently. RECOMMENDATION: standardize on `lucide-react-native` for mobile chrome icons (keep emoji
  for plugin tiles on both, since those are a deliberate brand device). Flag for owner before a mass
  migration; until then, at least use the same glyph *concepts* per action.

## 4. Progress log

- 2026-07-11: Audit run (3 parallel agents: tokens, typography, brand/components). Findings recorded
  above. Doc created. Starting quick wins.
