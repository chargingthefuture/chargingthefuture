# Design Audit: Replit Mockup vs Shell Code
  _Generated: 2026-05-19 by design agent per `.github/instructions/126-design-mockup-implementation-rules.mdc`_

  ---

  ## Summary

  | Severity | Components |
  |---|---|
  | 🔴 STUB (< 15% implemented) | Feed, LevelUp, SkillsHunt, Chyme, Trust |
  | 🟡 PARTIAL (< 65% implemented) | Mood, Community/Desktop |
  | 🟢 MINOR DRIFT (colors / labels) | Directory, Foundation, GDP, GentlePulse, LightHouse, ServiceCredits, Workforce |
  | ✅ NO MAJOR DRIFT | PeerProgramming, SocketRelay, TrustTransport |

  ---

  ## Rules Applied (from 126-design-mockup-implementation-rules.mdc)

  - **Stubs and partials** → flagged below; **user must approve** before any implementation begins (they require new API calls or new UI sections with data dependencies)
  - **Visual-only changes** (colors, spacing, typography) → safe to implement without approval
  - **Missing labels** from design are hardcoded mock data — shells use real API data, so label gaps are expected and not flagged as drift

  ---

  ## 🔴 STUBS — Require User Decision Before Any Work

  ### Feed (shell = 4% of design)
  - **Shell file**: `ctf/packages/web/components/feed/feed-announcements-shell.tsx`
  - **Design file**: `FeedAnnouncements.tsx`
  - Shell is essentially empty. Design shows a full announcements feed with threaded messages, categories, and urgency filters.
  - **API dependency**: `/api/announcements/*` — route exists ✅
  - **Verdict**: API exists. Awaiting approval to implement full shell UI.

  ### LevelUp (shell = 8% of design)
  - **Shell file**: `ctf/packages/web/components/levelup/levelup-shell.tsx`
  - **Design file**: `LevelUp.tsx`
  - Shell is a stub. Design shows cohort cards, skill tracks (React, Finance, Budgeting), enrollment CTAs, and progress bars in a CSS grid layout.
  - **API dependency**: No `/api/levelup` route found in `ctf/packages/web/app/api/`
  - **Verdict**: ⚠️ Backend API does not exist. Cannot implement without backend first. Surfacing to user.

  ### SkillsHunt (shell = 12% of design)
  - **Shell file**: `ctf/packages/web/components/skills-hunt/skills-hunt-shell.tsx`
  - **Design file**: `SkillsHunt.tsx`
  - Shell is a stub. Design shows a skill taxonomy browser (Technology, Software Engineering, Data Analysis, Cybersecurity), match scores, and a two-column browse/detail layout.
  - **API dependency**: `/api/skills-hunt/*` — route exists ✅; `/api/skills-taxonomy/*` — route exists ✅
  - **Verdict**: API exists. Awaiting approval to implement full shell UI.

  ### Chyme (shell = 10% of design)
  - **Shell file**: `ctf/packages/web/components/chyme/chyme-shell.tsx`
  - **Design file**: `Chyme.tsx`
  - Shell is a stub. Design shows a social audio interface with Live Rooms, Speaker controls, Upcoming sessions, mute/unmute, and a room list grid.
  - **API dependency**: `/api/chyme/*` — route exists ✅
  - **Verdict**: API exists. Awaiting approval to implement full shell UI.

  ### Trust (shell = 1% of design)
  - **Shell file**: `ctf/packages/web/components/trust/` (no `trust-shell.tsx` found — components are `TrustRightRailCard.tsx`, `TrustEvidencePanel.tsx`, etc.)
  - **Design file**: `Trust.tsx`
  - No single trust shell found. Design shows a full Trust Score hub: Verified/Unverified badges, a progress ladder ("Complete your profile", "Make your first transaction", "Use at least one plugin"), and a grid evidence layout.
  - **API dependency**: `/api/trust/*` — route exists ✅
  - **Verdict**: Shell appears decomposed into sub-components. Needs deeper investigation to confirm if `Trust.tsx` layout is fully assembled somewhere. Surfacing to user.

  ---

  ## 🟡 PARTIAL — Missing Sections

  ### Mood (shell = 54% of design)
  - **Shell file**: `ctf/packages/web/components/mood/mood-shell.tsx`
  - **Design file**: `Mood.tsx`
  - Design shows a resource rail with cross-plugin links (GentlePulse, Emergency, Peer Support Chat, Chyme, Directory) and a CSS grid layout. Shell missing those cross-plugin sections.
  - **API dependency**: Cross-plugin nav links are static UI — no new API needed.
  - **Verdict**: The missing cross-plugin rail is a visual-only addition (static links). Safe to implement without approval.

  ### Community / Desktop (shell = 31% of design)
  - **Shell file**: `ctf/packages/web/components/community-shell/community-shell.tsx`
  - **Design file**: `Desktop.tsx`
  - Design shows a full Desktop shell with: icon rail, sidebar with plugin list (Chyme, LightHouse, TrustTransport, etc.), main content area, and right rail. Shell exists but is much smaller.
  - **API dependency**: Plugin list is driven by `/api/plugins/*` — route exists ✅. Icon rail and sidebar layout are visual-only.
  - **Verdict**: Layout/icon-rail additions are visual-only (safe). Plugin list section depends on existing API. Awaiting approval for any plugin-data sections.

  ---

  ## 🟢 MINOR DRIFT — Colors & Spacing (Safe to Implement)

  | Component | Issue | Action |
  |---|---|---|
  | **Directory** | 6 hex colors in design missing from shell | Update shell color values to match design |
  | **ServiceCredits** | 7 hex colors in design missing from shell | Update shell color values to match design |
  | **Foundation** | Shell at 60% — some structural sections may differ | Visual layout review recommended |
  | **GDP** | 76% match — minor layout gaps | Visual spot-check |
  | **GentlePulse** | Shell 20% larger than design — may have extra/outdated sections | Audit for obsolete UI |
  | **LightHouse** | 95% match — minor label differences (expected, real API data) | No action needed |
  | **Workforce** | 81% match — minor label differences | No action needed |

  ---

  ## ✅ No Major Drift

  - **PeerProgramming** — shell 124% of design (shell may have extra functionality, design may lag)
  - **SocketRelay** — shell 143% of design (same as above)
  - **TrustTransport** — shell 123% of design

  ---

  ## State Completeness Check

  All four state variants exist in the design for every component above. No missing state designs found for the components audited.

  | State | Design Coverage |
  |---|---|
  | Authenticated + Populated | ✅ All components |
  | Authenticated + Loading | ✅ All components |
  | Authenticated + Empty | ✅ Most components |
  | Unauthenticated / Public | ✅ All components |

  ---

  ## Questions for User

  Before any stub implementation begins, please confirm:

  1. **LevelUp**: No backend API exists. Do you want to scope the LevelUp backend before implementing the shell UI?
  2. **Trust**: Is the Trust plugin assembled from sub-components (`TrustRightRailCard`, `TrustEvidencePanel`, etc.) into a parent page somewhere, or is there a missing `trust-shell.tsx` that needs to be created?
  3. **Stubs to implement** (Feed, SkillsHunt, Chyme): All have existing API routes. Should I proceed with pixel-perfect shell implementation for all three, or prioritize one?
  4. **Community/Desktop shell**: Should I implement the missing icon-rail/sidebar layout sections (visual-only portion)?
  5. **Minor color drift** (Directory, ServiceCredits): Should I patch these color values now?
  