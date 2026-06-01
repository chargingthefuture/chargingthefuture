# CTF Authentication Architecture

Date: 2026-04-05
Scope: `ctf/packages/web`

## Overview

Authentication in the CTF web package is a **future implementation**. A provider-agnostic
abstraction layer is in place so that any auth provider (Clerk, Auth0, a custom system, etc.)
can be plugged in without touching consuming components.

---

## Current State

**Clerk is the wired provider.** `app/layout.tsx` mounts `<ClerkProvider>`, `middleware.ts` runs
`clerkMiddleware` (and translates the Clerk session into the generic `x-ctf-*` identity headers),
and `lib/auth/client-context.tsx` derives the client session from Clerk's `useUser()` / `useAuth()`.
When no Clerk env is configured the provider-neutral layer still resolves to the anonymous state, so
the abstraction below remains intact.

---

## Hosted Sign-In (Clerk Account Portal)

Sign-in and sign-up are served by **Clerk's hosted Account Portal on Clerk's own domains**
(`https://accounts.<domain>` in production, `https://<slug>.accounts.dev` for a development
instance) — not by a sign-in form rendered on the app's own domain. The app never mounts Clerk's
`<SignIn />` / `<SignUp />` components; it redirects to the Account Portal and Clerk redirects back
after a completed flow.

- `lib/auth/provider-env.ts` resolves the hosted URLs:
  - `getHostedSignInUrl()` — an explicitly external configured sign-in URL wins; otherwise the
    Account Portal origin is **derived from the publishable key** (`deriveAccountPortalOrigin`) and
    `/sign-in` is appended.
  - `getHostedSignUpUrl()` / `getHostedAfterSignOutUrl()` — sign-up on the same portal; after
    sign-out, the configured URL unless it would loop, else the app home page.
- `app/layout.tsx` passes `signInUrl` / `signUpUrl` / `signInFallbackRedirectUrl` /
  `signUpFallbackRedirectUrl` / `afterSignOutUrl` to `<ClerkProvider>`.
- `app/sign-in/[[...sign-in]]/page.tsx` is a thin catch-all that forwards stray in-app `/sign-in`
  links to the hosted portal (or home), and can never redirect to a `/sign-in` path on this host.

**Redirect-loop pitfall (do not reintroduce):** `NEXT_PUBLIC_AUTH_SIGN_IN_URL` must be the Account
Portal URL (e.g. `https://accounts.<domain>/sign-in`). Setting it to `/sign-in` — or any URL on the
app's own host — makes the in-app `/sign-in` page redirect to itself forever
(`ERR_TOO_MANY_REDIRECTS`). A same-host/relative value is ignored at runtime (the app falls back to
the key-derived portal) and is flagged by `scripts/check-auth-env.mjs`.

---

## Files

| File                           | Purpose                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/auth/client-context.tsx`  | Stable client auth contract mounted at the app root. Provider integrations should satisfy this interface without changing consumers.        |
| `hooks/useAuth.ts`             | Stable re-export path for all consumers (`@/hooks/useAuth`). Never changes.                                                                 |
| `lib/auth/provider-env.ts`     | Provider-neutral runtime facade. It resolves the active auth provider configuration while preserving both generic and legacy env contracts. |
| `lib/auth/clerk-env.ts`        | Legacy compatibility wrapper for older Clerk-specific imports. Do not use as the primary abstraction for new auth work.                     |
| `scripts/check-auth-env.mjs`   | Provider-neutral auth env preflight. Validates auth env only when a provider is configured and accepts legacy Clerk fallbacks.              |
| `lib/auth/request-identity.ts` | Server-side identity resolver. Reads `x-ctf-user-*` headers and `ctf_*` cookies set by middleware.                                          |
| `lib/auth/server-authz.ts`     | Server-side authorization evaluator. Used in route handlers and Server Components.                                                          |

---

## Client-Side Usage

```tsx
import { useAuth } from "@/hooks/useAuth";

function MyComponent() {
  const { user, isAuthenticated, signIn, signOut } = useAuth();

  if (!isAuthenticated) {
    return <button onClick={signIn}>Sign in</button>;
  }

  return <span>Hello, {user?.username}</span>;
}
```

`useAuth` must be called inside a component that is a descendant of `<AuthProvider>`.
The root `app/layout.tsx` already wraps the app in `<AuthProvider>`, so provider integrations can
replace the provider implementation without changing route/layout structure.

---

## Swapping Auth Providers

Consumer-facing code should not change when swapping providers. The integration points are:

1. `lib/auth/client-context.tsx` for client session state.
2. `middleware.ts` plus `lib/auth/request-identity.ts` inputs for server-side identity propagation.
3. `lib/auth/provider-env.ts` for provider runtime configuration.
4. `scripts/check-auth-env.mjs` for deployment-time env validation.

The client contract remains:

```ts
interface AuthContextType {
  user: AuthUser | null; // null when not signed in
  isLoading: boolean; // true during provider initialization
  isAuthenticated: boolean;
  signIn: () => Promise<void> | void;
  signOut: () => Promise<void> | void;
}

interface AuthUser {
  id: string;
  username?: string | null;
  email?: string | null;
  isAdmin?: boolean;
  isApproved?: boolean;
}
```

**Steps to plug in Clerk:**

1. Install `@clerk/nextjs`.
2. Replace the `AuthProvider` body in `client-context.tsx` to use `<ClerkProvider>` and
   derive `AuthContextType` from `useUser()` / `useClerk()`.
3. Populate either the provider-neutral auth variables or the existing Clerk compatibility variables in the relevant `.env` file / Railway config.
4. Update `middleware.ts` to translate Clerk session state into the generic `x-ctf-*` headers or `ctf_*` cookies consumed by `request-identity.ts`.
5. Keep route handlers and plugin code unchanged.

---

## Server-Side Auth

Server Components and API route handlers use:

```ts
import { resolveRequestIdentity } from "@/lib/auth/request-identity";

const identity = await resolveRequestIdentity();
// identity.userId — null when unauthenticated
// identity.isAuthenticated, identity.isApproved, identity.role, identity.unlockAccessTier
```

For access policy decisions:

```ts
import { evaluatePluginAccess } from "@/lib/auth/server-authz";

const decision = await evaluatePluginAccess({ requireApprovedUserOrAdmin: true });
if (!decision.allowed) redirect("/sign-in");
```

---

## Deprecated Patterns

| Pattern                            | Status      | Reason Removed                                                                                                                                                                           |
| ---------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_DISABLE_AUTH` env var | **Deleted** | Bypassed auth globally with a mock user, making it impossible to test real unauthenticated flows. The abstraction layer renders it unnecessary — the stub provider IS the no-auth state. |

## Runtime Env Contract

- Generic env names are preferred for new provider work: `NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY`, `AUTH_SECRET_KEY`, `AUTH_SIGN_IN_URL`, `AUTH_AFTER_SIGN_OUT_URL`, and `NEXT_PUBLIC_AUTH_PROVIDER`.
- The provider name is read from a single variable, `NEXT_PUBLIC_AUTH_PROVIDER` (kept consistent with the other `NEXT_PUBLIC_AUTH_*` names). The older `CTF_AUTH_PROVIDER` alias is no longer read — set `NEXT_PUBLIC_AUTH_PROVIDER` instead.
- Legacy Clerk names remain supported as compatibility fallbacks while no concrete provider is wired yet.
- `pnpm --filter @ctf/web run check:auth-env` passes when no auth provider is configured and validates a coherent runtime contract once auth env values are present.

---

## Related Documents

- `CLERK_FOUNDATION_BASELINE_BF01.md` — previous Clerk-specific baseline (reference only)
- `CLERK_USERNAME_ROLLOUT_PLAN.md` — Clerk username rollout plan (reference only)
- Rule `123-environment-configuration-rules.mdc` — environment variable contract
