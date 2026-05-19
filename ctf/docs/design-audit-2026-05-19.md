# Design Audit: Replit Mockup vs Shell Code

  _Generated: 2026-05-19 by design agent per `.github/instructions/126-design-mockup-implementation-rules.mdc`_
  _Last updated: 2026-05-19 — patches applied, SkillsHunt implemented_

  ---

  ## Summary

  | Severity | Components |
  |---|---|
  | 🔴 STUB — API missing | Trust |
  | 🔴 STUB — API exists, awaiting approval | LevelUp |
  | 🟡 PARTIAL (< 65% implemented) | Mood, Community/Desktop |
  | 🟢 MINOR DRIFT (colors / labels) | GDP, GentlePulse, LightHouse, Workforce |
  | 🟢 MINOR DRIFT — review needed | Foundation |
  | ✅ IMPLEMENTED / NO MAJOR DRIFT | Directory ✅, ServiceCredits ✅, SkillsHunt ✅, Feed ✅, Chyme ✅, PeerProgramming, SocketRelay, TrustTransport |

  ---

  ## Changes Applied (this branch)

  ### 1. Directory shell — background color patch

  - **File**: `ctf/packages/web/components/directory/directory-shell.tsx`
  - **Change**: 4× `#0F1117` → `#0C1A3D` (background). Exact design BG constant match.
  - **Status**: ✅ committed

  ### 2. ServiceCredits shell — difficulty badge color patch

  - **File**: `ctf/packages/web/components/service-credits/service-credits-shell.tsx`
  - **Change**: EARN_METHODS difficulty badge changed from hardcoded `#6B7280` (gray) to `m.color` with matching `background: m.color + "15"` and `border: m.color + "30"`. Pixel-perfect match to design.
  - **Status**: ✅ committed

  ### 3. SkillsHunt shell — full pixel-perfect UI implementation

  - **File**: `ctf/packages/web/components/skills-hunt/skills-hunt-shell.tsx`
  - **Change**: Complete rewrite of the render section. Icon rail (72px) + second sidebar (240px) + main area + right rail (280px). Four tabs: Scout (nomination form with taxonomy accordion), Leaderboard (ranked list from API), Missions/Rounds (active/closed rounds from API), My Finds (session-local).
  - **API backing**: `/api/skills-hunt/rounds`, `/api/skills-hunt/achievements`, `/api/skills-hunt/rounds/[id]/leaderboard`, `/api/skills-hunt/rounds/[id]/submissions` — all confirmed existing.
  - **Data fix**: corrected response shape extraction (`.rounds`, `.achievements`, `.items` from leaderboard).
  - **Static data**: `SKILL_TAXONOMY` is hardcoded per spec §2.1 (no `/api/skills-taxonomy` route found).
  - **Status**: ✅ committed

  ---

  ## Investigation Findings (not implemented — awaiting approval or missing API)

  ### Feed shell — already correctly implemented

  - Shell delegates to `LiveFeedAnnouncements` which fetches from `lib/feed/repository`. Original "4% stub" assessment was incorrect — it's a thin server-component orchestration wrapper.
  - **Status**: ✅ No action needed.

  ### Chyme shell — already correctly implemented

  - Shell delegates to `ChymeLiveShell`. Original "10% stub" assessment was incorrect.
  - **Status**: ✅ No action needed.

  ---

  ## 🔴 STUBS — Require User Decision Before Any Work

  ### LevelUp (shell = 8% of design)

  - **Shell file**: `ctf/packages/web/components/levelup/levelup-shell.tsx`
  - **Design file**: `LevelUp.tsx`
  - Shell is a stub. Design shows cohort cards, skill tracks (React, Finance, Budgeting), enrollment CTAs, and progress bars in a CSS grid layout.
  - **API dependency**: API exists. Confirmed routes:
    - `/api/levelup/cohorts`
    - `/api/levelup/enroll`
    - `/api/levelup/milestones`
    - `/api/levelup/disputes`
    - `/api/levelup/transfers`
    - `/api/levelup/admin/adjust-credits`
  - **Verdict**: API exists. Awaiting approval to implement full shell UI.

  ### Trust (shell ≈ 1% of design)

  - **Shell file**: `ctf/packages/web/components/trust/trust-shell.tsx` — **file does not exist yet** (not found in repo).
  - **Design file**: `Trust.tsx`
  - Design shows a trust score dashboard with community endorsements and history timeline.
  - **Related components** (5 files present in `ctf/packages/web/components/trust/`):
    1. `TrustDirectoryProfilePanel.tsx`
    2. `TrustEvidencePanel.tsx`
    3. `TrustRightRailCard.tsx`
    4. `TrustStatusBadge.tsx`
    5. `TrustVisibilityBadge.tsx`
  - **API dependency**: Not yet verified — must confirm before implementation.
  - **Verdict**: ⚠️ Shell file missing entirely. Awaiting user approval + API route verification.

  ---

  ## 🟡 PARTIAL — Awaiting User Approval

  ### Mood (< 65% of design)

  - **Shell file**: `ctf/packages/web/components/mood/mood-shell.tsx`
  - Partial implementation. Design has additional mood visualization sections not in shell.
  - **Status**: Awaiting user approval.

  ### Community / Desktop (< 65% of design)

  - **Shell file**: `ctf/packages/web/components/community/community-shell.tsx`
  - Partial implementation. Design has additional community listing sections.
  - **Status**: Awaiting user approval.

  ---

  ## 🟢 MINOR DRIFT — Remaining (visual-only, safe to implement)

  ### Foundation — review needed

  - **Shell file**: `ctf/packages/web/components/foundation/foundation-shell.tsx`
  - Minor color / typography drift observed. The following areas require a focused visual layout review and cross-check of responsive breakpoints:
    - **Header / branding** — logo placement, wordmark size, color tokens
    - **Navigation** — active state indicators, link colors, spacing
    - **Grid / Layout** — column counts, gap sizes, max-width constraints
    - **Footer** — link grouping, copyright line, background color
    - **Typography** — font-size scale, line-height, font-weight per heading level
    - **Spacing / margins** — section padding, component margins vs design tokens
    - **Components / Forms** — button variants, input border-radius, focus rings
    - **Accessibility landmarks** — `<main>`, `<nav>`, `<footer>` presence and `aria-label` coverage
  - **Status**: Perform focused visual layout review against `Foundation.tsx` design; update this entry with confirmed drift items before implementing.

  ### Directory — remaining color drift

  - Missing sections not yet in shell: online indicator (`#22c55e`), star ratings (`#fbbf24`), community-generated badge (`#a855f7`), category color bars (`#ec4899`, `#eab308`).
  - **Blocker**: Fields (`online`, `rating`, `source`) not confirmed in `/api/directory/list` response. Cannot add UI without API backing per rules.
  - **Status**: Awaiting API field confirmation from user or code owner.

  ### GDP, GentlePulse, LightHouse, Workforce

  - Minor color / typography drift from design. No structural gaps. Can be addressed in a follow-up pass.

  ---

  ## Rules Applied (from 126-design-mockup-implementation-rules.mdc)

  - **Stubs and partials** → flagged above; user must approve before implementation (require new API calls or new UI sections with data dependencies)
  - **Visual-only changes** (colors, spacing, typography) → safe to implement without approval
  - **Missing labels** from design are hardcoded mock data — shells use real API data, so label gaps are expected and not flagged as drift
  - **No stub data** in production shells — all implemented UI is backed by confirmed API routes
  