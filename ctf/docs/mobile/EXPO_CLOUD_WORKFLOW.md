# Expo Cloud Workflow

This project uses cloud-first mobile delivery so development can proceed without Android Studio.

There is **one environment: production**. A preview build is just an install channel for reviewers —
it points at the same production backend and the same Clerk sign-in key as a release build. Showing
sample/demo data is a runtime Unleash flag, not a separate deploy environment, so there is no
staging or preview backend.

## Required Secrets

Secrets come from **two places**. The app secrets live in Infisical (the single source of truth); the
GitHub Actions secrets are only the bootstrap credentials the workflow needs before it can reach
Infisical, plus the EAS token. The mobile workflows reuse the **same** app secret values the web app
already uses, so there is one set of values to manage.

### GitHub Actions secrets (bootstrap only)

Configure these as GitHub **secrets** (Settings → Secrets and variables → Actions → Secrets):

- `EXPO_TOKEN` — token for EAS CLI auth. The Expo account/owner is taken from this token; there is no
  separate `EXPO_OWNER`.
- `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `INFISICAL_PROJECT_SLUG`, `INFISICAL_URL` — the
  credentials the "Inject secrets from Infisical" step uses to read the app secrets at run time. These
  are the same four values the other Infisical-backed workflows already use, so they are likely
  already set.

### Infisical app secrets (the `prod` environment)

These live in the Infisical `prod` environment, **not** as GitHub secrets. Each Expo workflow loads
them into the job environment at run time with an "Inject secrets from Infisical" step. The owner must
make sure each one exists in Infisical `prod`:

- `NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY` — Clerk publishable key. The app derives the Clerk Frontend API
  host (the OAuth sign-in server) from this key, so no separate URL is needed for the endpoints.
- `EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID` — the client id of the Clerk OAuth application the mobile app
  signs in against (see "Mobile sign-in: Clerk OAuth/OpenID Connect setup" below).
- `APP_URL` — base URL of the deployed web/API host (https, no trailing slash). The mobile app and the
  Expo workflows read this Infisical value at run time. The **web** app reads a separately-stored
  `NEXT_PUBLIC_APP_URL` **GitHub Actions secret** that is baked into its image at build time (Next.js
  only inlines `NEXT_PUBLIC_*` into the browser bundle, so the web client must use that name). The two
  are different names in different systems but **must hold the same production URL** — if you change
  the app's URL, update both `APP_URL` in Infisical `prod` and the `NEXT_PUBLIC_APP_URL` GitHub Actions
  secret, or web and mobile will point at different hosts.
- `NEXT_PUBLIC_AUTH_PROVIDER` — auth provider name (defaults to `clerk` when unset).
- `NEXT_PUBLIC_AUTH_SIGN_IN_URL` — optional hosted Clerk sign-in URL (kept for reference; the native
  app no longer needs it for sign-in).
- `EXPO_MOBILE_PROJECT_ID` — Expo project id used by `app.config.ts`.
- `EXPO_MOBILE_UPDATES_URL` — EAS updates URL for the project.

The Clerk/auth names (`NEXT_PUBLIC_AUTH_*`) are the same ones the web app reads, so they are likely
already in Infisical `prod`. `APP_URL` holds the same production URL the web app uses, under a
different name (see the note above). The Expo-specific ones — `EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID`,
`EXPO_MOBILE_PROJECT_ID`, and `EXPO_MOBILE_UPDATES_URL` — may need to be added to Infisical `prod` if
they are not there yet.

There is **no per-user identity** to configure. The signed-in user is resolved at runtime by an OAuth
sign-in against Clerk, and every API call carries an `Authorization: Bearer <token>` the backend
verifies.

## Mobile sign-in: Clerk OAuth/OpenID Connect setup

The mobile app does **not** bundle `@clerk/clerk-js` / `@clerk/clerk-expo` (that pulls a large Web3
wallet dependency tree). Instead it signs in with the standard OAuth 2.0 authorization-code flow with
PKCE (a way to do OAuth safely from an app that cannot keep a secret) using `expo-auth-session`, with
**Clerk acting as an OpenID Connect provider**. The flow returns a Clerk-signed OpenID Connect
`id_token` (a JWT). That token is stored in the device keychain (`expo-secure-store`) and sent on
every backend call as `Authorization: Bearer <id_token>`. The backend verifies it with
`@clerk/backend`'s `verifyToken` — the same signing keys as a web session token — so the verifier is
unchanged.

The owner must configure Clerk once:

1. **Create an OAuth application** in the Clerk Dashboard → **OAuth Applications** (a Clerk instance
   acting as an OAuth/OpenID Connect provider). Note its **client id** and set it as
   `EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID`.
2. **Allow the `openid`, `profile`, and `email` scopes** on that OAuth application (the app requests
   these so the `id_token` carries the user id and profile/email claims).
3. **Register the redirect URIs.** The app uses its URL scheme `ctf`. Add:
   - `ctf://oauth-callback` (standalone / release build), and
   - the Expo development proxy URL Expo prints when you run `expo start` (for Expo Go testing).
   These must match exactly or Clerk rejects the sign-in.
4. **Customize the session/id token claims** in Clerk Dashboard → **Sessions → Customize session
   token** so the verified token carries the same claims the web middleware reads. Add at least:
   - `username`, `first_name`, `last_name`,
   - `role` (or `metadata.role`), and
   - `is_approved` (or `metadata.is_approved`).
   The backend reads role/approval **only** from the verified token claims, never from request
   headers, so these claims must be present for admin/approval gating to work on mobile.

If `EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID` or the publishable key is missing, the app shows a clear
"sign in not configured" message instead of attempting a broken flow.

## Channels

- `main` → `production` channel (over-the-air updates).
- `mobile-v*` tag → signed `production` build attached to a GitHub Release.
- Pull request touching `ctf/packages/mobile/**` → `preview` channel install APK (same production
  backend).
- Three times a week (Mon/Wed/Fri) → an automatic `preview` test APK, quota permitting (see below).

## Free-tier quota — hands-free, no numbers to remember

The Expo free plan gives a small, fixed monthly allotment. The numbers live in ONE file,
`ctf/packages/mobile/expo-free-tier-quota.json`, and every Expo workflow reads them through the guard
script `ctf/scripts/check-expo-build-quota.mjs`. If the plan ever changes, edit that JSON and the
workflows follow — no one has to remember the limits.

The three limits and how each is handled:

| Free-tier limit | Spent by | How it is kept safe |
|---|---|---|
| **15 Android builds / month** | every `eas build` for Android (preview test builds + signed releases) | **Enforced.** The 3×/week cron is capped to an automated budget (`scheduledBuildBudgetPerMonth`, default 12) that sits below 15, so manual releases always have room. On-demand preview builds block only at the real ceiling of 15. The guard reads how many Android builds ran this calendar month from EAS and skips cleanly when the budget is hit. |
| **60 min EAS CI/CD Workflows / month** | EAS Workflows (Expo's own CI product) | **Not used → stays at zero.** This repo orchestrates from GitHub Actions and only calls `eas build` / `eas update`; there is no `.eas/workflows` dir. Do not add one without re-checking this budget. |
| **1,000 update MAUs / month** | monthly active users who pull an OTA update | Tracked in the JSON for awareness; not controllable from CI. Watch it on the Expo dashboard as the user base grows. |

To spend a build on purpose past the guard, run a workflow from the Actions tab with the **force**
input enabled.

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
  - Reports this month's build count against the free-tier limits (informational; never blocks a
    deliberate release).
  - Fails fast when `EXPO_TOKEN` is missing.

- `.github/workflows/expo-android-scheduled-build.yml`
  - Runs on its own three times a week (Mon/Wed/Fri 08:00 UTC) — the hands-free path. You do not have
    to remember how to deploy the Android app; this builds a `preview` test APK for you.
  - Checks the free-tier quota first and skips cleanly when this month's automated build budget is
    used up, so it never pushes you past the free allotment.
  - If the build **fails**, a Claude agent (`anthropics/claude-code-action`) diagnoses it, opens a
    descriptive `fix/expo-android-build-*` branch, and files a pull request with the smallest fix —
    low-risk fixes auto-merge after CI; risky ones wait for owner review (the two-lane rule in
    CLAUDE.md).
  - Manual "Run workflow" has a **force** input to build even when the budget is reached.

## Cutting an Android Release (runbook)

**Yes — every native Android release needs a new `mobile-v*` tag.** That is the only
trigger for `expo-android-release.yml`; it has no manual "Run workflow" button. Pushing a
new tag *is* the release. (This is settled; do not re-litigate it.)

You do **not** tag for JavaScript/asset-only changes — those ship automatically as an
over-the-air update via `expo-update.yml` the moment they land on `main`. Tag only when you
need a brand-new signed build users install (native dependency/config change, or a real
version bump you want on a Release page).

Steps to release:

1. **Bump the version** in `ctf/packages/mobile/app.config.ts` (and `package.json`) and let it
   merge to `main`. The tag is the version of record — the release name and APK filename come
   from the tag (`github.ref_name`) — so keep the app version and the tag in step.
2. **Create and push the tag against `main`** (the deployed commit):

   ```
   git fetch origin main
   git tag -a mobile-v<X.Y.Z> origin/main -m "Android release v<X.Y.Z>"
   git push origin mobile-v<X.Y.Z>
   ```

3. **Watch Actions → "Expo Android Release."** It builds the signed APK in EAS, then creates
   the `mobile-v<X.Y.Z>` GitHub Release with the APK attached. A green run leaves a downloadable
   signed APK on that release.

**Do NOT create/publish the GitHub Release by hand in the UI first.** The workflow creates the
release and attaches the APK itself (via `softprops/action-gh-release`). **Immutable Releases are
enabled on this repo**, so a release you publish manually is locked the instant you publish it —
the workflow then can't add the APK to it, the upload step fails, and you are left with an empty
release. Let the workflow own the release.

Other rules that fall out of immutable releases:

- **Every tag/version must be new and unique.** You cannot re-publish or overwrite a
  `mobile-v*` release; bump the version for every attempt, even a retry of a failed build.
- **Release notes can't be edited after publish.** The workflow publishes with an empty body,
  so there is nowhere to add notes after the fact. If notes matter for a release, add them to
  the workflow's release step (a `body:`/`body_path:` input on `action-gh-release`) before
  tagging — not in the UI afterward.
- **Tag creation needs a human (or a token with tag permission).** `mobile-v*` tags are
  protected; the Claude Code session token can push branches but is blocked (HTTP 403) from
  pushing release tags, so the owner runs the `git push origin mobile-v<X.Y.Z>` step.

## When to Use EAS Build vs EAS Update

A **build** (EAS Build) compiles the whole native Android app — native code, native dependencies, the
app icon, permissions, and the JavaScript bundle — into the `.apk` you install on a phone. It is the
thing that spends one of your **15 monthly Android builds**. Use it for native dependency or
configuration changes, a new permission, a runtime-version bump, or any signed release.

An **OTA update** (EAS Update) ships only the JavaScript bundle and assets over the air to apps that
are **already installed**; it does not recompile native code, and an installed app picks it up on next
launch. It does **not** spend an Android build — it counts toward the **1,000 monthly active users**
limit instead. Use it for JavaScript/asset-only changes that are compatible with the current runtime
version. It cannot add a native permission, change a native dependency, or bump the native runtime —
those need a new build.

Rule of thumb: changed only JavaScript/assets → OTA update (free against the build cap, automatic on
`main`). Changed anything native, or cutting a release users install → a build.

- Use **EAS Build** for native dependency/configuration changes.
- Use **EAS Update** for JavaScript and asset-only changes compatible with the current runtime
  version.

## Deployment Readiness Checklist

Before shipping additional features, verify these first:

1. **Secrets** are configured (the list above): the bootstrap credentials and `EXPO_TOKEN` as GitHub
   secrets, and the app secrets in the Infisical `prod` environment.

2. **Env contract gate** passes in the Expo workflows:

- `pnpm --dir ctf --filter @ctf/mobile run check:mobile-env`
- Requires a Clerk publishable key, an https app URL, the EAS project id, and the updates URL.

3. **Type safety** passes:

- `pnpm --filter @ctf/mobile typecheck`

4. **Real sign-in smoke test** on a preview APK:

- Signed-out user taps sign-in and the OAuth browser tab opens Clerk's sign-in.
- After signing in, the browser returns to the app via `ctf://oauth-callback`, the app exchanges the
  code for a Clerk `id_token`, stores it, and API calls succeed (the backend accepts the bearer
  token).
- Signing out clears the stored session.

5. **Cloud build path** succeeds:

- `preview` build via `.github/workflows/expo-preview.yml`.
- Install and launch the generated APK on an Android device.
