# Runbook: Expo Env Setup

Scope: `ctf/` mobile workflows only.

---

## Goal

Configure the secrets required for the mobile CI workflows:

- `.github/workflows/expo-preview.yml`
- `.github/workflows/expo-update.yml`
- `.github/workflows/expo-android-release.yml`

There is **one environment: production**. The mobile workflows reuse the **same** app secrets the web
app already uses — there is no separate staging/preview backend, no per-user identity, and no
`EXPO_OWNER`.

Secrets come from **two places**:

- **Infisical** (the single source of truth for app secrets) holds the Clerk keys, the app URL, and
  the Expo project id/updates URL. Each Expo workflow pulls them at run time with an "Inject secrets
  from Infisical" step that loads them into the job environment for the build steps.
- **GitHub Actions secrets** hold only the bootstrap credentials the workflow needs *before* it can
  reach Infisical, plus the EAS token: `EXPO_TOKEN`, `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`,
  `INFISICAL_PROJECT_SLUG`, `INFISICAL_URL`.

---

## Safety Rules (Do This First)

1. Never paste secrets into code or committed files.
2. Reuse the existing production web secrets; do not create parallel mobile-only copies.

---

## Required Secrets

### GitHub Actions secrets (bootstrap only)

Set these as GitHub **secrets** (Settings → Secrets and variables → Actions → Secrets). They are the
credentials the workflow needs before it can reach Infisical, plus the EAS token:

1. `EXPO_TOKEN` — EAS CLI login.
2. `INFISICAL_CLIENT_ID`
3. `INFISICAL_CLIENT_SECRET`
4. `INFISICAL_PROJECT_SLUG`
5. `INFISICAL_URL`

These four `INFISICAL_*` values are the same ones the other Infisical-backed workflows already use, so
they are likely already set.

### Infisical app secrets (the `prod` environment)

These live in the Infisical `prod` environment, **not** as GitHub secrets. The Expo workflows load
them at run time. The owner must make sure each one exists in Infisical `prod`:

1. `NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY`
2. `NEXT_PUBLIC_APP_URL`
3. `NEXT_PUBLIC_AUTH_PROVIDER`
4. `NEXT_PUBLIC_AUTH_SIGN_IN_URL` (optional)
5. `EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID` (for native sign-in)
6. `EXPO_MOBILE_PROJECT_ID`
7. `EXPO_MOBILE_UPDATES_URL`

The first four are the same names the web app reads, so they are likely already in Infisical `prod`.
The three Expo-specific ones — `EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID`, `EXPO_MOBILE_PROJECT_ID`, and
`EXPO_MOBILE_UPDATES_URL` — may need to be added to Infisical `prod` if they are not there yet.

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

- `NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY` — Clerk publishable key (the web app's production key). The app
  derives the Clerk Frontend API sign-in host from this key, so no separate endpoint URL is needed.
- `NEXT_PUBLIC_AUTH_PROVIDER` — `clerk`.
- `NEXT_PUBLIC_AUTH_SIGN_IN_URL` — kept for reference; the native app no longer needs it for sign-in.

### `EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID` (mobile sign-in)

The mobile app signs in with an OAuth 2.0 authorization-code flow with PKCE (a way to do OAuth safely
from an app that cannot keep a secret) against Clerk acting as an OpenID Connect provider — it does
**not** bundle `@clerk/clerk-js`. One-time Clerk Dashboard setup:

1. Clerk Dashboard → **OAuth Applications** → create an application. Copy its **client id** into
   `EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID`.
2. Allow the `openid`, `profile`, and `email` scopes on it.
3. Add these **redirect URIs** to the OAuth application (must match exactly):
   - `ctf://oauth-callback` (release/standalone build), and
   - the Expo development proxy URL printed by `expo start` (for Expo Go testing).
4. Clerk Dashboard → **Sessions → Customize session token**: add the claims the backend reads
   (`username`, `first_name`, `last_name`, `role` or `metadata.role`, and `is_approved` or
   `metadata.is_approved`). The backend trusts these claims from the verified token only — never from
   request headers — so admin/approval gating on mobile depends on them being present.

The full reasoning and verification flow is in
[`EXPO_CLOUD_WORKFLOW.md`](EXPO_CLOUD_WORKFLOW.md#mobile-sign-in-clerk-oauthopenid-connect-setup).

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
