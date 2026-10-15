# Shared Package

## Purpose
Platform-neutral code read by both the web app and the Android app.

## Public API
- **Auth:** `authenticatePluginUser()`, `AuthProvider`, `PluginAuthContext`, `PluginAuthResult`.
  A Clerk token is trusted only when the caller supplies a real verifier; the other providers are
  not implemented.
- **Hosting disclaimer:** `HOSTING_NOT_ENDORSEMENT` and `HOSTING_NOT_ENDORSEMENT_SHORT`, the one
  wording used by TI Radio and Chyme on web and Android.
- **Feature flags:** `SYSTEM_FLAGS`, `UNLOCK_FLAGS`, `FlagKey`, `FeatureFlagContext`.

## Build
The web and Android apps resolve `@ctf/shared` through `dist/` (the package `main`), so `dist/` is
committed. After changing anything under `src/`, run `pnpm --filter @ctf/shared run build` and
commit the regenerated `dist/` files.
