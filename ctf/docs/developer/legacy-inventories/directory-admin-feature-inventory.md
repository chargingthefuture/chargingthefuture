# Directory Admin Feature Inventory (Legacy Reference)

## Scope

- Source analyzed (reference-only): `platform/`
- Rewrite target: `ctf/`
- Surface inventoried: `Directory Admin` (`/apps/directory/admin` + `/apps/directory/admin/announcements`)
- Guardrail honored: no edits in `platform/`

---

## Executive Summary

`Directory Admin` is a multi-step operational surface for managing claimed/unclaimed profiles, assignment workflows, selector taxonomy usage, and announcements.

This surface is strongly tied to business rules (claimed vs unclaimed constraints, assign-only behavior, selector caps, geocoding side effects) and should be preserved as a custom in-app admin experience for ctf rewrite.

---

## 1) Feature Inventory

### 1.1 Admin Profile List + Search + Pagination

Evidence:

- `platform/client/src/pages/directory/admin.tsx`
- `platform/client/src/pages/directory/admin/components/DirectoryAdminProfileList.tsx`

Features:

1. List all profiles (claimed and unclaimed).
2. Client-side fuzzy search across profile/user fields.
3. Client-side pagination (50/page).
4. Visual status badges (public/verified/claimed state indicators).
5. Quick open of public profile URLs for public records.

### 1.2 Admin Profile Create/Edit/Delete/Assign

Evidence:

- `platform/client/src/pages/directory/admin.tsx`
- `platform/client/src/pages/directory/admin/hooks/useDirectoryAdminProfiles.ts`
- `platform/server/routes/directory.routes.ts`

Features:

1. Create unclaimed profile (`POST /api/directory/admin/profiles`).
2. Edit profile (`PUT /api/directory/admin/profiles/:id`).
3. Assign unclaimed profile to existing user (`PUT /api/directory/admin/profiles/:id/assign`).
4. Delete unclaimed profile only (`DELETE /api/directory/admin/profiles/:id`).
5. Selection caps and field rules mirror Directory profile constraints.
6. Public profile URL surfaced post-create in success toast when `isPublic = true`.

Important behavior note:

- Current post-create behavior provides a URL string in toast; it is not a dedicated guaranteed copy/open trigger action.

### 1.3 Admin Skills Compatibility View/Actions

Evidence:

- `platform/client/src/pages/directory/admin.tsx`
- `platform/client/src/pages/directory/admin/hooks/useDirectoryAdminSkills.ts`
- `platform/server/routes/directory.routes.ts`
- `platform/server/routes/skills.routes.ts`

Features:

1. Reads flattened skills compatibility feed for Directory admin usage.
2. Supports deletion of underlying shared skills via skills API path.
3. Selector fields for skills/sectors/job titles are fed from shared skills endpoints.

### 1.4 Admin Announcements

Evidence:

- `platform/client/src/pages/directory/admin-announcements.tsx`
- `platform/server/routes/socket-relay.routes.ts`

Features:

1. List/create/update/deactivate announcements for Directory.
2. Announcement types + optional expiry.
3. Query invalidation for both user and admin announcement feeds after writes.

---

## 2) API Surface (Admin-Relevant)

### 2.1 Directory Admin Profile APIs

- `GET /api/directory/admin/profiles`
- `POST /api/directory/admin/profiles`
- `PUT /api/directory/admin/profiles/:id`
- `PUT /api/directory/admin/profiles/:id/assign`
- `DELETE /api/directory/admin/profiles/:id`

### 2.2 Directory Skills/Admin-Compatibility APIs

- `GET /api/directory/admin/skills`
- `GET /api/directory/skills`
- `GET /api/directory/sectors`
- `GET /api/directory/job-titles`

### 2.3 Directory Admin Announcement APIs

- `GET /api/directory/admin/announcements`
- `POST /api/directory/admin/announcements`
- `PUT /api/directory/admin/announcements/:id`
- `DELETE /api/directory/admin/announcements/:id`

---

## 3) Data Dependencies

Evidence:

- `platform/shared/schema/directory/index.ts`
- `platform/shared/schema/skills/index.ts`
- `platform/server/storage/plugins/directory-storage.ts`

Dependencies:

1. `directory_profiles`
2. `directory_announcements`
3. Shared skills hierarchy (`skills_sectors`, `skills_job_titles`, `skills_skills`)
4. Core users table for assignment/claimed profile enrichment

---

## 4) Security and Policy Controls

Evidence:

- `platform/server/routes/directory.routes.ts`
- `platform/server/routes/socket-relay.routes.ts`

Controls:

1. Admin auth required for profile admin endpoints.
2. CSRF enforced on admin write operations.
3. Unclaimed-only deletion guard for admin profile deletes.

---

## 5) UX Complexity and Operator Risk

1. Claim-state branching introduces non-trivial operator workflows (create unclaimed → assign later).
2. Selector limits and compatibility data require careful validation parity.
3. Public URL operational workflows (view/open + post-create URL signaling) are quality-sensitive.
4. Cross-module announcement route placement increases maintenance risk.

---

## 6) Gaps, Ambiguities, and Migration Risks

1. **Route ownership ambiguity:** Directory admin announcement APIs are implemented in `socket-relay.routes.ts`.
2. **Legacy compatibility complexity:** Directory admin still depends on flattened compatibility skill feeds while using shared hierarchy sources.
3. **Post-create URL action nuance:** Existing behavior is toast URL text, not a strict copy/open workflow step.
4. **Policy drift risk:** Claimed/unclaimed guardrails must be preserved exactly in rewrite.

---

## 7) Rewrite Inputs (for ctf planning)

Before implementing ctf Directory Admin, lock these decisions:

1. Move Directory announcement route ownership into Directory module boundaries.
2. Preserve and explicitly test claimed/unclaimed profile rule set.
3. Define explicit post-create public URL UX requirement (toast-only vs action buttons).
4. Define canonical skills-admin compatibility strategy for Directory admin forms.
