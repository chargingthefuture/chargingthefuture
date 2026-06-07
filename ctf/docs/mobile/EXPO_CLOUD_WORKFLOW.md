# Expo Cloud Workflow

This project uses cloud-first mobile delivery so development can proceed without Android Studio.

There is **one environment: production**. A preview build is just an install channel for reviewers —
it points at the same production backend and the same Clerk sign-in key as a release build. Showing
sample/demo data is a runtime Unleash flag, not a separate deploy environment, so there is no
staging or preview backend.

## Required Secrets

Configure all of these as GitHub **secrets** (Settings → Secrets and variables → Actions → Secrets).
The mobile workflows reuse the **same** secrets the web app already uses, so there is one set of
values to manage.

- `EXPO_TOKEN` — token for EAS CLI auth. The Expo account/owner is taken from this token; there is no
  separate `EXPO_OWNER`.
- `NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY` — Clerk publishable key used for real sign-in.
- `NEXT_PUBLIC_APP_URL` — base URL of the deployed web/API host (https, no trailing slash).
- `NEXT_PUBLIC_AUTH_PROVIDER` — auth provider name (defaults to `clerk` when unset).
- `NEXT_PUBLIC_AUTH_SIGN_IN_URL` — optional hosted Clerk sign-in URL (used by the app's sign-in
  action).
- `EXPO_MOBILE_PROJECT_ID` — Expo project id used by `app.config.ts`.
- `EXPO_MOBILE_UPDATES_URL` — EAS updates URL for the project.

There is **no per-user identity** to configure. The signed-in user is resolved at runtime from a real
Clerk session, and every API call carries an `Authorization: Bearer <token>` the backend verifies.

## Channels

- `main` → `production` channel (over-the-air updates).
- `mobile-v*` tag → signed `production` build attached to a GitHub Release.
- Pull request touching `ctf/packages/mobile/**` → `preview` channel install APK (same production
  backend).

## Workflows

- `.github/workflows/expo-preview.yml`
  - Builds an Android APK with EAS for pull requests (`--profile preview`).
  - Posts/updates a PR comment with the install link (the link is read from the EAS build response,
    so no `EXPO_OWNER` is needed).
  - Fails fast when `EXPO_TOKEN` is missing.

- `.github/workflows/expo-update.yml`
  - Publishes an over-the-air EAS update to the `production` channel on pushes to `main`.
  - Intended for JavaScript/asset-only updates.
  - Fails fast when `EXPO_TOKEN` is missing.

- `.github/workflows/expo-android-release.yml`
  - Builds a signed production APK and publishes it to GitHub Releases on `mobile-v*` tags.
  - Fails fast when `EXPO_TOKEN` is missing.

## When to Use EAS Build vs EAS Update

- Use **EAS Build** for native dependency/configuration changes.
- Use **EAS Update** for JavaScript and asset-only changes compatible with the current runtime
  version.

## Deployment Readiness Checklist

Before shipping additional features, verify these first:

1. **Secrets** are configured (the list above), all as GitHub secrets.

2. **Env contract gate** passes in the Expo workflows:

- `pnpm --dir ctf --filter @ctf/mobile run check:mobile-env`
- Requires a Clerk publishable key, an https app URL, the EAS project id, and the updates URL.

3. **Type safety** passes:

- `pnpm --filter @ctf/mobile typecheck`

4. **Real Clerk sign-in smoke test** on a preview APK:

- Signed-out user can open the hosted Clerk sign-in.
- After signing in, the app holds a Clerk session and API calls succeed (the backend accepts the
  bearer token).
- Signing out clears the session.

5. **Cloud build path** succeeds:

- `preview` build via `.github/workflows/expo-preview.yml`.
- Install and launch the generated APK on an Android device.
