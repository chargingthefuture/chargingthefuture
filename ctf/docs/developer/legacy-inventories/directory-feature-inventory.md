# Directory Plugin Feature Inventory (Legacy Reference)

## Scope

- **Source analyzed (reference-only):** `platform/`
- **Rewrite target:** `ctf/`
- **Plugin name to retain:** `Directory`
- **Write boundary observed:** no edits in `platform/` (per `.claude/rules/index.mdc` and `099-agent-scope-guardrails.mdc`)

---

## Executive Summary

`Directory` is a profile-and-discovery plugin for skill exchange. It supports:

- authenticated profile CRUD,
- public profile discovery,
- admin management for unclaimed/claimed profiles,
- announcement publishing,
- privacy and anti-scraping controls,
- shared skills taxonomy integration (skills/sectors/job titles),
- profile geocoding and coordinate backfill tooling.

This document lists **all discovered implemented features** from legacy code and labels migration ambiguities that should be resolved before ctf rewrite.

---

## 1) User-Facing Features

### 1.1 Authenticated Directory Dashboard

Evidence:

- `platform/client/src/pages/directory/dashboard.tsx`
- `platform/server/routes/directory.routes.ts` (`GET /api/directory/profile`, `GET /api/directory/list`)

Features:

1. Landing state when no profile exists (“Welcome to Directory”).
2. “Create Your Profile” CTA to profile form.
3. Public directory URL display + clipboard copy.
4. Open public directory in external dialog flow.
5. Announcement banner integration.
6. If profile exists, dashboard becomes explorer view with:
   - fuzzy search across profile text fields,
   - cards with description, skills, sectors, job titles, location,
   - verified badge,
   - Signal link (authenticated view),
   - link to each public profile page,
   - edit profile CTA.

### 1.2 Authenticated Profile Create/Edit/Delete

Evidence:

- `platform/client/src/pages/directory/profile.tsx`
- `platform/server/routes/directory.routes.ts`
- `platform/shared/schema/directory/index.ts`

Features:

1. Create profile (`POST /api/directory/profile`) with duplicate prevention.
2. Edit existing profile (`PUT /api/directory/profile`).
3. Delete profile (`DELETE /api/directory/profile`) with reason support and cascade deletion path.
4. Description text field with 140-char cap and remaining counter.
5. Skills selector (required, up to 3).
6. Sectors selector (optional, up to 3).
7. Job titles selector (optional, up to 3).
8. Signal URL and Quora URL fields (+ quick open buttons).
9. City + US state + country selectors (country required).
10. Public visibility toggle (`isPublic`).
11. Share public profile URL button when profile is public.
12. Verified status badge display.
13. Announcement banner in profile page.

Validation and constraints:

- Skills min 1, max 3.
- Sectors max 3.
- Job titles max 3.
- Country required.
- Description max 140.
- URL format validation for Signal/Quora.

### 1.3 Public Directory List (Unauthenticated)

Evidence:

- `platform/client/src/pages/directory/public-list.tsx`
- `platform/client/src/routes/public-routes.tsx`
- `platform/server/routes/directory.routes.ts` (`GET /api/directory/public`)

Features:

1. Public route: `/apps/directory/public`.
2. Profile card listing for all public profiles.
3. Privacy behavior: display **first name only** on list cards.
4. Shows description, skills, sectors, job titles, location, verification badge.
5. Quora link visible when present.
6. “View Profile” opens individual public profile.
7. Empty-state CTA and top/bottom sign-up CTAs.

### 1.4 Public Individual Profile (Unauthenticated)

Evidence:

- `platform/client/src/pages/directory/public.tsx`
- `platform/client/src/routes/public-routes.tsx`
- `platform/server/routes/directory.routes.ts` (`GET /api/directory/public/:id`)

Features:

1. Public route: `/apps/directory/public/:id`.
2. Returns 404/“not found” for non-public profiles.
3. Displays first-name-only public identity.
4. Shows description, skills, sectors, job titles, location, verified badge.
5. Quora link may be shown.
6. **Signal intentionally hidden** on public profile.
7. Provides public directory URL copy/open controls.

### 1.5 Directory Announcements (User View)

Evidence:

- `platform/client/src/pages/directory/announcements.tsx`
- `platform/client/src/pages/directory/dashboard.tsx`
- `platform/client/src/pages/directory/profile.tsx`
- `platform/server/routes/socket-relay.routes.ts` (`GET /api/directory/announcements`)

Features:

1. Authenticated announcements page: `/apps/directory/announcements`.
2. Announcement banner shown on dashboard and profile.
3. Displays active, non-expired announcements with type and expiry metadata.

---

## 2) Admin Features

### 2.1 Directory Admin Dashboard

Evidence:

- `platform/client/src/pages/directory/admin.tsx`
- `platform/client/src/pages/directory/admin/components/*`
- `platform/client/src/pages/directory/admin/hooks/*`
- `platform/server/routes/directory.routes.ts`

Features:

1. Admin route: `/apps/directory/admin`.
2. List all profiles (claimed + unclaimed).
3. Client-side fuzzy search on profile fields.
4. Client-side pagination (50/page).
5. Edit profile details inline.
6. Create unclaimed profile.
7. Assign unclaimed profile to existing user.
8. Delete unclaimed profile (guarded; claimed profile deletion blocked here).
9. Public badge and public URL quick open for public profiles.
10. Verified badge rendering.

### 2.2 Admin Profile Create/Edit Rules

Evidence:

- `platform/server/routes/directory.routes.ts`
- `platform/client/src/pages/directory/admin/components/DirectoryAdminProfileForm.tsx`

Features:

1. Create admin profile endpoint with optional `userId`.
2. `isClaimed` set true only when assigned to a user.
3. Editable fields mirror user form plus admin `firstName` for unclaimed entries.
4. Same selection limits: skills/sectors/job titles capped at 3.
5. Country required.

Security controls:

- Auth required.
- Admin role required.
- CSRF validation on write endpoints.
- Admin action logging for create/update/assign/delete.

### 2.3 Admin Skill Operations (Directory Compatibility)

Evidence:

- `platform/client/src/pages/directory/admin/components/DirectoryAdminSkillsSelector.tsx`
- `platform/client/src/pages/directory/admin/hooks/useDirectoryAdminSkills.ts`
- `platform/server/routes/directory.routes.ts` (`GET /api/directory/admin/skills`)
- `platform/server/routes/skills.routes.ts` (`DELETE /api/skills/skills/:id`)

Features:

1. Admin reads flattened skill list for Directory UI compatibility.
2. Admin can delete underlying shared skill entries via skills API.
3. Delete warning notes that existing profiles are not retroactively cleaned in UI workflow.

### 2.4 Admin Announcement Management

Evidence:

- `platform/client/src/pages/directory/admin-announcements.tsx`
- `platform/server/routes/socket-relay.routes.ts` (Directory announcement admin endpoints)

Features:

1. Admin route: `/apps/directory/admin/announcements`.
2. Create announcement (title/content/type/expiresAt).
3. Edit announcement.
4. Delete announcement (implemented as deactivation in storage).
5. Types: `info | warning | maintenance | update | promotion`.
6. List includes created date and expiry date.
7. Invalidate user and admin announcement query caches after writes.

---

## 3) API Surface (Discovered)

### 3.1 Profile + Directory APIs

Evidence: `platform/server/routes/directory.routes.ts`

| Endpoint                                       | Auth | Admin | CSRF | Purpose                                                        |
| ---------------------------------------------- | ---- | ----- | ---- | -------------------------------------------------------------- |
| `GET /api/directory/profile`                   | Yes  | No    | No   | Current user profile with enriched name/verification           |
| `POST /api/directory/profile`                  | Yes  | No    | No   | Create current user profile                                    |
| `PUT /api/directory/profile`                   | Yes  | No    | No   | Update current user profile                                    |
| `DELETE /api/directory/profile`                | Yes  | No    | No   | Delete current user profile with cascade path                  |
| `GET /api/directory/skills`                    | Yes  | No    | No   | Flattened skills for form selectors                            |
| `GET /api/directory/sectors`                   | Yes  | No    | No   | Sector options                                                 |
| `GET /api/directory/job-titles`                | Yes  | No    | No   | Job title options                                              |
| `GET /api/directory/public`                    | No   | No    | No   | Public list (rate-limited, anti-scraping delay, rotated order) |
| `GET /api/directory/public/:id`                | No   | No    | No   | Public profile by id (public-only)                             |
| `GET /api/directory/list`                      | Yes  | No    | No   | Authenticated profile listing                                  |
| `GET /api/directory/admin/profiles`            | Yes  | Yes   | No   | Admin list all profiles                                        |
| `POST /api/directory/admin/profiles`           | Yes  | Yes   | Yes  | Admin create claimed/unclaimed profile                         |
| `PUT /api/directory/admin/profiles/:id/assign` | Yes  | Yes   | Yes  | Assign unclaimed profile to user                               |
| `PUT /api/directory/admin/profiles/:id`        | Yes  | Yes   | Yes  | Admin edit profile                                             |
| `DELETE /api/directory/admin/profiles/:id`     | Yes  | Yes   | Yes  | Admin hard-delete unclaimed profile only                       |
| `GET /api/directory/admin/skills`              | Yes  | Yes   | No   | Admin flattened skills list                                    |

### 3.2 Announcement APIs

Evidence: `platform/server/routes/socket-relay.routes.ts`

| Endpoint                                        | Auth | Admin | CSRF | Purpose                           |
| ----------------------------------------------- | ---- | ----- | ---- | --------------------------------- |
| `GET /api/directory/announcements`              | Yes  | No    | No   | Active, non-expired announcements |
| `GET /api/directory/admin/announcements`        | Yes  | Yes   | No   | All announcements                 |
| `POST /api/directory/admin/announcements`       | Yes  | Yes   | Yes  | Create announcement               |
| `PUT /api/directory/admin/announcements/:id`    | Yes  | Yes   | Yes  | Update announcement               |
| `DELETE /api/directory/admin/announcements/:id` | Yes  | Yes   | Yes  | Deactivate announcement           |

---

## 4) Security, Privacy, and Anti-Scraping Features

Evidence:

- `platform/server/rateLimiter.ts`
- `platform/server/antiScraping.ts`
- `platform/server/dataObfuscation.ts`
- `platform/server/routes/index.ts`
- `platform/server/routes/directory.routes.ts`

Features:

1. Request fingerprinting middleware applied globally before routes.
2. Public listing rate limit: 10 requests / 15 min / IP.
3. Public item rate limit: 50 requests / 15 min / IP.
4. Bot/suspicious request detection by user-agent + missing browser headers.
5. Anti-scraping response delay (higher for suspicious traffic).
6. Public listing order rotation (seeded time-window shuffle every ~5 min).
7. Public privacy posture:
   - first-name-only rendering on public UI,
   - Signal hidden from public individual profile,
   - non-public profile IDs return not found.
8. Admin writes guarded by auth + admin + CSRF.
9. Admin action logs recorded for sensitive admin mutations.

---

## 5) Data Model and Persistence Features

Evidence:

- `platform/shared/schema/directory/index.ts`
- `platform/server/storage/plugins/directory-storage.ts`
- `platform/schema.sql`

### 5.1 Directory Profile Fields

- Primary id (uuid), optional unique `userId`.
- `description` (140 max), arrays for `skills`, `sectors`, `jobTitles`.
- Contact links: `signalUrl`, `quoraUrl`.
- Optional `firstName` for unclaimed profile labeling.
- Location: `city`, `state`, `country`, plus cached `latitude`, `longitude`.
- Flags: `isVerified`, `isPublic`, `isClaimed`.
- `createdAt`, `updatedAt` timestamps.

### 5.2 Announcement Fields

- `title`, `content`, `type`, `isActive`, `expiresAt`, created/updated timestamps.

### 5.3 Storage-layer Behaviors

1. Geocoding on create/update when location changes.
2. Coordinates persisted as numeric strings for DB columns.
3. Defense-in-depth slicing of skills/sectors/job titles to max 3.
4. Public list optimized with LEFT JOIN to users to avoid N+1 queries.
5. Soft deactivation for announcement delete.
6. Claimed-profile delete path logs profile deletion via cascade method.

---

## 6) Operational and Maintenance Features

Evidence:

- `platform/scripts/seedDirectory.ts`
- `platform/scripts/backfillDirectoryCoordinates.ts`
- `platform/scripts/seedAllPlugins.ts`

Features:

1. Directory seed script for profiles, skills table, and announcements.
2. Coordinates backfill script for existing profiles lacking lat/long.
3. Multi-plugin seeding includes Directory.

---

## 7) Route and UI Inventory

### 7.1 Authenticated UI Routes

Evidence: `platform/client/src/routes/plugin-routes.tsx`

- `/apps/directory`
- `/apps/directory/profile`
- `/apps/directory/announcements`
- `/apps/directory/admin`
- `/apps/directory/admin/announcements`

### 7.2 Public UI Routes

Evidence: `platform/client/src/routes/public-routes.tsx`

- `/apps/directory/public`
- `/apps/directory/public/:id`

---

## 8) Test Evidence for Implemented Behaviors

Evidence:

- `platform/test/api/directory.test.ts`
- `platform/test/e2e/directory.spec.ts`
- `platform/test/client/pages/directory/profile.test.tsx`
- `platform/guides/TESTING.md`

Covered/indicated behaviors:

1. Profile CRUD intent and route coverage scaffolding.
2. Public endpoint privacy/rate-limit expectations.
3. Admin profile list expectations for claimed/unclaimed first-name handling.
4. E2E path coverage for profile, dashboard, public listing, admin path.
5. Testing guide includes Directory privacy toggle acceptance criteria.

---

## 9) Ambiguities and Migration Risks to Resolve in ctf Rewrite

1. **Schema SQL inconsistency**
   - `platform/schema.sql` shows malformed `state VARCHAR(50,` and appears out-of-sync.
   - Source of truth should be normalized for ctf migration.

2. **Seed payload mismatch**
   - `platform/scripts/seedDirectory.ts` uses `nickname` and `displayNameType` fields not present in `shared/schema/directory/index.ts`.
   - Decide whether these are legacy leftovers or intended model additions.

3. **Announcement route placement**
   - Directory announcement endpoints are implemented inside `socket-relay.routes.ts`.
   - For ctf rewrite, place Directory endpoints in Directory-specific route/module boundaries.

4. **Admin delete semantics for skills**
   - UI note states deletion will not remove skills from existing profiles.
   - Confirm desired ctf behavior: reference integrity constraints, soft-delete taxonomy, or historical label retention.

5. **Public vs authenticated data exposure contract**
   - Authenticated list includes fields hidden from public views (e.g., Signal behavior differs by page).
   - Define explicit contract/spec in ctf command schema to avoid drift.

6. **Test reliability / selector drift**
   - Some legacy tests appear scaffold-like and may not align with current selectors exactly.
   - ctf rewrite should define authoritative test IDs and update tests accordingly.

---

## 10) Rewrite Boundary Guidance (for ctf)

Per `.claude/rules/index.mdc`:

1. Keep `Directory` as plugin-first flow with shared contracts and web/mobile parity.
2. Treat `platform/` behavior as reference baseline, not direct copy target.
3. Re-implement with explicit command/policy contracts under ctf architecture.
4. Preserve core functional parity:
   - profile CRUD + visibility,
   - public listing/profile views,
   - admin unclaimed workflow + assignment,
   - announcements,
   - anti-scraping and rate limiting,
   - skills/sectors/job title selector model,
   - geocoding and coordinate support.

---

## 11) Source File Index (Primary Evidence)

### Server

- `platform/server/routes/directory.routes.ts`
- `platform/server/routes/socket-relay.routes.ts`
- `platform/server/routes/index.ts`
- `platform/server/rateLimiter.ts`
- `platform/server/antiScraping.ts`
- `platform/server/dataObfuscation.ts`
- `platform/server/storage/plugins/directory-storage.ts`

### Shared/Data

- `platform/shared/schema/directory/index.ts`
- `platform/schema.sql`

### Client

- `platform/client/src/pages/directory/dashboard.tsx`
- `platform/client/src/pages/directory/profile.tsx`
- `platform/client/src/pages/directory/public-list.tsx`
- `platform/client/src/pages/directory/public.tsx`
- `platform/client/src/pages/directory/announcements.tsx`
- `platform/client/src/pages/directory/admin.tsx`
- `platform/client/src/pages/directory/admin-announcements.tsx`
- `platform/client/src/pages/directory/admin/components/DirectoryAdminProfileForm.tsx`
- `platform/client/src/pages/directory/admin/components/DirectoryAdminProfileList.tsx`
- `platform/client/src/pages/directory/admin/components/DirectoryAdminSkillsSelector.tsx`
- `platform/client/src/pages/directory/admin/components/DirectoryAdminSectorsSelector.tsx`
- `platform/client/src/pages/directory/admin/components/DirectoryAdminJobTitlesSelector.tsx`
- `platform/client/src/pages/directory/admin/hooks/useDirectoryAdminProfiles.ts`
- `platform/client/src/pages/directory/admin/hooks/useDirectoryAdminSkills.ts`
- `platform/client/src/routes/plugin-routes.tsx`
- `platform/client/src/routes/public-routes.tsx`

### Scripts/Tests/Guides

- `platform/scripts/seedDirectory.ts`
- `platform/scripts/backfillDirectoryCoordinates.ts`
- `platform/scripts/seedAllPlugins.ts`
- `platform/test/api/directory.test.ts`
- `platform/test/e2e/directory.spec.ts`
- `platform/test/client/pages/directory/profile.test.tsx`
- `platform/guides/TESTING.md`
