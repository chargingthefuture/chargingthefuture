# Tomorrow Runbook: Expo Env Setup for Rewrite

Date created: 2026-03-01
Owner: Rewrite team
Scope: `ctf/` rewrite mobile workflows only

---

## Goal

Configure the minimum Expo/GitHub variables and secrets required for rewrite mobile CI workflows:

- `.github/workflows/expo-preview.yml`
- `.github/workflows/expo-update.yml`
- `.github/workflows/expo-android-release.yml`

This runbook keeps legacy production isolated.

---

## Time Budget

- Total: ~25–40 minutes
- Expo account/token: 5–10 min
- EAS project info and values: 5–10 min
- GitHub variables/secrets entry: 10–15 min
- Validation run: 5 min

---

## Safety Rules (Do This First)

1. Do **not** change legacy production secrets.
2. Add rewrite values in rewrite-safe scope (repo or dedicated rewrite environment).
3. Never paste secrets into code or committed files.
4. Use staging values first; production values can be added last.

---

## Required Keys to Configure

### GitHub Secrets

1. `EXPO_TOKEN`
2. `MOBILE_CLERK_PUBLISHABLE_KEY_STAGING`
3. `MOBILE_CLERK_PUBLISHABLE_KEY_PRODUCTION`
4. (Optional) `MOBILE_SENTRY_DSN`

### GitHub Variables

1. `EXPO_MOBILE_PROJECT_ID`
2. `EXPO_MOBILE_UPDATES_URL`
3. `MOBILE_APP_URL`
4. (Optional) `MOBILE_OBSERVABILITY_PROVIDER` (`sentry`, `signoz`, or `noop`)
5. (Optional but recommended) `EXPO_OWNER`

Compatibility fallback variables (only if needed):

- `MOBILE_UPDATES_URL`

---

## Where to Get Each Value

### 1) `EXPO_TOKEN`

- Expo dashboard → Account Settings → Access Tokens → create token.
- Name suggestion: `github-rewrite-mobile-ci`.

### 2) `EXPO_OWNER`

From terminal (logged into Expo):

```bash
cd /workspaces/chargingthefuture/ctf/packages/mobile
npx expo whoami
```

Use that account/org slug as `EXPO_OWNER`.

### 3) `EXPO_MOBILE_PROJECT_ID`

```bash
cd /workspaces/chargingthefuture/ctf/packages/mobile
npx eas-cli project:info
```

Copy `projectId`.

### 4) `EXPO_MOBILE_UPDATES_URL`

Build it from project ID:

```text
https://u.expo.dev/<EXPO_MOBILE_PROJECT_ID>
```

### 5) `MOBILE_APP_URL`

Use rewrite backend base URL (Railway canonical host for rewrite), no trailing slash.

Examples:
- `https://the-comic.com`
- `https://chargingthefuture.com`

### 6) Clerk publishable keys

From Clerk dashboard API Keys for each environment:
- staging Clerk project → `MOBILE_CLERK_PUBLISHABLE_KEY_STAGING`
- production Clerk project → `MOBILE_CLERK_PUBLISHABLE_KEY_PRODUCTION`

---

## GitHub Entry Checklist

Open GitHub repo settings:
- Settings → Secrets and variables → Actions

Then add:

### Secrets tab

- [ ] `EXPO_TOKEN`
- [ ] `MOBILE_CLERK_PUBLISHABLE_KEY_STAGING`
- [ ] `MOBILE_CLERK_PUBLISHABLE_KEY_PRODUCTION`
- [ ] `MOBILE_SENTRY_DSN` (optional)

### Variables tab

- [ ] `EXPO_MOBILE_PROJECT_ID`
- [ ] `EXPO_MOBILE_UPDATES_URL`
- [ ] `MOBILE_APP_URL`
- [ ] `MOBILE_OBSERVABILITY_PROVIDER` (optional)
- [ ] `EXPO_OWNER` (recommended)

---

## Local Validation (Copy/Paste)

Run from repo root:

```bash
cd /workspaces/chargingthefuture/ctf
EXPO_MOBILE_PROJECT_ID=proj_123 \
EXPO_MOBILE_UPDATES_URL=https://u.expo.dev/proj_123 \
MOBILE_APP_URL=https://the-comic.com \
MOBILE_CLERK_PUBLISHABLE_KEY_STAGING=pk_test_staging \
MOBILE_ENV_TARGET=preview \
pnpm --filter @ctf/mobile run check:mobile-env
```

Production-mode validation:

```bash
cd /workspaces/chargingthefuture/ctf
EXPO_MOBILE_PROJECT_ID=proj_123 \
EXPO_MOBILE_UPDATES_URL=https://u.expo.dev/proj_123 \
MOBILE_APP_URL=https://chargingthefuture.com \
MOBILE_CLERK_PUBLISHABLE_KEY_PRODUCTION=pk_live_production \
MOBILE_ENV_TARGET=production \
pnpm --filter @ctf/mobile run check:mobile-env
```

Expected output:
- `Mobile env validation passed for profile: preview`
- `Mobile env validation passed for profile: production`

---

## Optional CI Smoke Test Tomorrow

After saving vars/secrets:

1. Make a tiny mobile-only docs change.
2. Push branch.
3. Confirm workflow behavior:
   - `Expo Preview Build` should run and pass env validation step.
   - `Expo Update` should run and pass env validation step.

---

## Troubleshooting

### Missing env group error

If workflow says missing project/update URL keys:
- Ensure `EXPO_MOBILE_PROJECT_ID` and `EXPO_MOBILE_UPDATES_URL` exist (or fallback keys).

### Missing Clerk key error

- For preview/staging profiles: `MOBILE_CLERK_PUBLISHABLE_KEY_STAGING` required.
- For production profile: `MOBILE_CLERK_PUBLISHABLE_KEY_PRODUCTION` required.

### Expo ownership mismatch

- Ensure `EXPO_TOKEN` belongs to account/org matching `EXPO_OWNER` and EAS project.

---

## Completion Criteria

Mark done when all are true:

- [ ] All required GitHub vars/secrets are entered.
- [ ] Local `check:mobile-env` passes for preview and production modes.
- [ ] Expo Preview workflow passes on next PR/push.
- [ ] No legacy production secrets were modified.

---

## Related Files

- `ctf/packages/mobile/scripts/check-mobile-env.mjs`
- `ctf/packages/mobile/app.config.ts`
- `ctf/packages/mobile/eas.json`
- `.github/workflows/expo-preview.yml`
- `.github/workflows/expo-update.yml`
- `.github/workflows/expo-android-release.yml`
- `ctf/docs/mobile/EXPO_CLOUD_WORKFLOW.md`
