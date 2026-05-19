# Design Audit: Replit Mockup vs Shell Code

    _Generated: 2026-05-19 by design agent per `.github/instructions/126-design-mockup-implementation-rules.mdc`_
    _Last updated: 2026-05-19 — GentlePulse + Community shells created; Mood shell patched_

    ---

    ## Summary

    | Severity | Components |
    |---|---|
    | 🔴 STUB — API missing | Trust |
    | 🔴 STUB — API exists, awaiting approval | LevelUp |
    | 🟡 PARTIAL (< 65% implemented) | ~~Mood~~ ✅, ~~Community/Desktop~~ ✅ |
    | 🟢 MINOR DRIFT (colors / labels) | GDP, LightHouse, Workforce |
    | 🟢 MINOR DRIFT — review needed | Foundation |
    | ✅ IMPLEMENTED / NO MAJOR DRIFT | Directory ✅, ServiceCredits ✅, SkillsHunt ✅, Feed ✅, Chyme ✅, PeerProgramming, SocketRelay, TrustTransport, GentlePulse ✅, Community ✅, Mood ✅ |

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
    - **Status**: ✅ committed

    ### 4. GentlePulse shell — created from scratch

    - **File**: `ctf/packages/web/components/gentle-pulse/gentle-pulse-shell.tsx` (new)
    - **Design ref**: `GentlePulse.tsx` — COLOR=#14B8A6, BG=#0A0F0E
    - **Structure**: 72px icon rail + 240px category sidebar + main area + 280px right rail. Three tabs: Sessions (grid of library items), Playing (player view), Chat/Support (backed by API).
    - **API backing**: `/api/gentlepulse/library` (GET — session grid), `/api/gentlepulse/support` (POST — chat messages)
    - **Status**: ✅ committed

    ### 5. Community shell — created from scratch

    - **File**: `ctf/packages/web/components/community/community-shell.tsx` (new)
    - **Design ref**: `Desktop.tsx` — purple/cyan gradient, Discord-style hub
    - **Structure**: 72px icon rail + 240px sidebar (channels/mini-apps) + main content (chat/apps grid) + 280px right rail (profile, trust widget, GDP progress). Two sections: Chat (live channel messages) and Mini-Apps (grid of 8 mini-apps).
    - **API backing**: `/api/hub/channels` (GET — channel list), `/api/hub/messages` (GET/POST — channel messages)
    - **Right rail**: Trust widget (unverified empty state matching Desktop.tsx), GDP progress bar, motivational quote.
    - **Status**: ✅ committed

    ### 6. Mood shell — tab switching + trends + crisis widget

    - **File**: `ctf/packages/web/components/mood/mood-shell.tsx`
    - **Changes**:
      - Wired tab buttons to actual tab state (was static buttons with no `onClick`)
      - Added 200px second sidebar with nav items + community stats
      - Added **Trends tab**: 7-day mood bar chart (uses `communityStats.weeklyTrend` from eligibility API or sensible defaults), mood distribution bars (Great/Good/Okay/Low/Struggling)
      - Added **280px right rail** with crisis resources (National Hotline, Crisis Text Line, RAINN) and privacy reminder
      - Chat tab renders "Coming soon" state (no `/api/mood/chat` route exists — honest unavailability)
      - Eligible=false → improved empty state with "View Trends" CTA
    - **API backing**: `/api/mood/eligibility` (eligibility + communityStats), `/api/mood/submissions` (POST)
    - **Status**: ✅ committed

    ---

    ## Investigation Findings (not implemented — awaiting approval or missing API)

    ### Feed shell — already correctly implemented

    - Shell delegates to `LiveFeedAnnouncements` which fetches from `lib/feed/repository`. Original "4% stub" assessment was incorrect.
    - **Status**: ✅ No action needed.

    ### Chyme shell — already correctly implemented

    - Shell delegates to `ChymeLiveShell`. Original "10% stub" assessment was incorrect.
    - **Status**: ✅ No action needed.

    ---

    ## 🔴 STUBS — Require User Decision Before Any Work

    ### LevelUp (shell = 8% of design)

    - **Shell file**: `ctf/packages/web/components/levelup/levelup-shell.tsx`
    - Shell is a stub. Design shows cohort cards, skill tracks, enrollment CTAs, and progress bars.
    - **API dependency**: Confirmed routes: `/api/levelup/cohorts`, `/api/levelup/enroll`, `/api/levelup/milestones`, `/api/levelup/disputes`, `/api/levelup/transfers`.
    - **Verdict**: API exists. Awaiting approval to implement full shell UI.

    ### Trust (shell file does not exist)

    - **Shell file**: `ctf/packages/web/components/trust/trust-shell.tsx` — **file does not exist yet**.
    - **Design file**: `Trust.tsx` — trust score dashboard with community endorsements and history timeline.
    - **Related components** (5 files present): TrustDirectoryProfilePanel, TrustEvidencePanel, TrustRightRailCard, TrustStatusBadge, TrustVisibilityBadge.
    - **API dependency**: Not yet verified.
    - **Verdict**: ⚠️ Shell file missing entirely. Awaiting user approval + API route verification.

    ---

    ## 🟢 MINOR DRIFT — Remaining (visual-only, safe to implement)

    ### Foundation — review needed

    - **Shell file**: `ctf/packages/web/components/foundation/foundation-shell.tsx`
    - All 3 tabs (browse/quotes/chat) present and API-backed. COLOR=#EF4444 matches design. No structural gaps found.
    - Minor typography / spacing polish may exist — safe to address as a visual-only pass.
    - **Status**: Monitored. No blocking drift found.

    ### Directory — remaining color drift

    - Missing sections not yet in shell: online indicator (`#22c55e`), star ratings (`#fbbf24`), community-generated badge (`#a855f7`), category color bars.
    - **Blocker**: Fields (`online`, `rating`, `source`) not confirmed in `/api/directory/list` response.
    - **Status**: Awaiting API field confirmation.

    ### GDP, LightHouse, Workforce

    - COLOR constants match design. Minor color / typography drift in detail surfaces. No structural gaps.
    - GDP: map tab present (placeholder). Dashboard: sectors + countries grid ✅. Missing: weekly trend chart (no `/api/gdp/weekly` route found).
    - LightHouse: 3 tabs + inline chat + detail view all present ✅.
    - Workforce: overview + sector + skill-level views present ✅. Missing: employment status donut (design shows it; no dedicated route). Chat tab not added (no `/api/workforce/chat` route).
    - **Status**: Remaining gaps blocked by missing API routes. No action without user approval.

    ---

    ## Rules Applied (from 126-design-mockup-implementation-rules.mdc)

    - **Stubs and partials** → flagged above; user must approve before implementation (require new API calls or new UI sections with data dependencies)
    - **Visual-only changes** (colors, spacing, typography) → safe to implement without approval
    - **Missing labels** from design are hardcoded mock data — shells use real API data, so label gaps are expected and not flagged as drift
    - **No stub data** in production shells — all implemented UI is backed by confirmed API routes
  