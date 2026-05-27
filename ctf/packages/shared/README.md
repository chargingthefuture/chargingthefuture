# Shared Package

## Purpose
Platform-agnostic shared logic for authentication and mood, used by both web and mobile clients.

## Public API
Exports two main domains:
- **Auth:** `authenticatePluginUser()`, `AuthProvider`, provider-agnostic dispatch (Clerk implemented, others stubbed)
- **Mood:** `MoodCheck`, `MoodEligibility` types, API calls, and React hooks

## Directory Structure
```
auth/
  index.ts
  providers/
mood/
  index.ts
  hooks.ts
```

## Import Guidelines

**Do NOT import hooks via a barrel (e.g., from `mood` or an `index.ts` barrel).** This can cause SSR problems by pulling client-only modules into server bundles, or create circular/hoisting issues.

**Correct pattern:** Always import hooks directly from their file (e.g., `mood/hooks.ts`).

**Incorrect:**
```ts
import { useMood } from "@ctf/shared/mood"; // ❌ Barrel import (may break SSR)
```

**Correct:**
```ts
import { useMood } from "@ctf/shared/mood/hooks"; // ✅ Direct import
```

*Symptom to watch for: server render errors or warnings about client-only hooks being used on the server. Always import hooks directly to avoid these issues.*

## Environment Variables
- `CLERK_SECRET_KEY`
- `STREAM_API_KEY`
- `STREAM_API_SECRET`

## Dependencies
This package does **not** bundle external services like Clerk or GetStream.io. Instead, it provides optional/peer integration points for these services, which must be configured by the consuming app:

- **Clerk** and **GetStream.io** are required only if you use the relevant authentication or messaging features. They are not installed or managed by this package.
- You must provide the following environment variables in your host app:
  - `CLERK_SECRET_KEY` (see [Clerk section](#clerk))
  - `STREAM_API_KEY`, `STREAM_API_SECRET` (see [GetStream.io section](#getstreamio))
- The package exposes interfaces and hooks for Clerk and GetStream.io, but expects the host app to supply valid API keys and, if needed, provider implementations.
- Consumers are responsible for configuring and initializing these services in their own environment.

See the [Clerk](#clerk) and [GetStream.io](#getstreamio) sections below for integration details.

## Usage Example
```ts
import { authenticatePluginUser } from '@ctf/shared/auth';
import { MoodCheck } from '@ctf/shared/mood';
import { useMoodCheck } from '@ctf/shared/mood/hooks'; // ✅ Recommended: direct hook import

// Always import hooks directly from their file (see Import Guidelines above)
```
