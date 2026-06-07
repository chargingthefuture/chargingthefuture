# Runbook: Expo Env Setup

Scope: `ctf/` mobile workflows only.

---

## Goal

Configure the minimum Expo/GitHub secrets required for the mobile CI workflows:

- `.github/workflows/expo-preview.yml`
- `.github/workflows/expo-update.yml`
- `.github/workflows/expo-android-release.yml`

There is **one environment: production**. The mobile workflows reuse the **same** secrets the web app
already uses — there is no separate staging/preview backend, no per-user identity, and no
`EXPO_OWNER`.

---

## Safety Rules (Do This First)

1. Never paste secrets into code or committed files.
2. Reuse the existing production web secrets; do not create parallel mobile-only copies.

---

## Required Secrets

Set all of these as GitHub **secrets** (Settings → Secrets and variables → Actions → Secrets):

1. `EXPO_TOKEN`
2. `NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY`
3. `NEXT_PUBLIC_APP_URL`
4. `NEXT_PUBLIC_AUTH_PROVIDER`
5. `NEXT_PUBLIC_AUTH_SIGN_IN_URL` (optional)
6. `EXPO_MOBILE_PROJECT_ID`
7. `EXPO_MOBILE_UPDATES_URL`

These are the same names the web app reads, so most are already set.

---

## Where to Get Each Value

### `EXPO_TOKEN`

- Expo dashboard → Account Settings → Access Tokens → create token.
- The Expo account/owner is taken from this token. There is no separate `EXPO_OWNER`.

### `EXPO_MOBILE_PROJECT_ID`

```bash
cd ctf/packages/mobile
npx eas-cli project:info
```

Copy `projectId`.

### `EXPO_MOBILE_UPDATES_URL`

Build it from the project id:

```text
https://u.expo.dev/<EXPO_MOBILE_PROJECT_ID>
```

### `NEXT_PUBLIC_APP_URL`

The deployed web/API base URL, https, no trailing slash (e.g. `https://chargingthefuture.com`).

### Clerk keys

- `NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY` — Clerk publishable key (the web app's production key).
- `NEXT_PUBLIC_AUTH_PROVIDER` — `clerk`.
- `NEXT_PUBLIC_AUTH_SIGN_IN_URL` — your hosted Clerk sign-in page (optional; enables sign-in from the
  app).

---

## Local Validation (Copy/Paste)

Run from the `ctf` directory:

```bash
cd ctf
NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY=pk_live_example \
NEXT_PUBLIC_APP_URL=https://chargingthefuture.com \
EXPO_MOBILE_PROJECT_ID=proj_123 \
EXPO_MOBILE_UPDATES_URL=https://u.expo.dev/proj_123 \
pnpm --filter @ctf/mobile run check:mobile-env
```

Expected output:

- `Mobile env validation passed for profile: preview`

---

## Completion Criteria

- [ ] All required GitHub secrets are entered.
- [ ] Local `check:mobile-env` passes.
- [ ] The Expo Preview workflow passes on the next PR that touches `ctf/packages/mobile/**`.

---

## Related Files

- `ctf/packages/mobile/scripts/check-mobile-env.mjs`
- `ctf/packages/mobile/app.config.ts`
- `ctf/packages/mobile/eas.json`
- `.github/workflows/expo-preview.yml`
- `.github/workflows/expo-update.yml`
- `.github/workflows/expo-android-release.yml`
- `ctf/docs/mobile/EXPO_CLOUD_WORKFLOW.md`
