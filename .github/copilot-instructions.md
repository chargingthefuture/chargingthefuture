# Copilot Instructions

## Project Overview

This is the **Charging the Future** monorepo — a survivor support platform with three main components:

- **`platform/`** — Full-stack TypeScript web app (React frontend + Express backend), the primary codebase
- **`landing-page/`** — Next.js marketing/landing site
- **`chyme-android/`** — Android mobile app (Kotlin/Gradle)

The platform is an invite-only community with mini-apps for survivors: support matching, job skills, transport assistance, directory listings, mental health check-ins, and more.

---

## Platform Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI) |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL via [Neon](https://neon.tech) serverless, Drizzle ORM |
| Auth | Clerk (JWT-based; `@clerk/express`) |
| Testing | Vitest (unit/integration), Playwright (E2E), React Testing Library |
| Bundler | Vite (client), esbuild (server) |

---

## Repository Layout (`platform/`)

```
platform/
├── client/src/          # React frontend (pages, components, hooks)
├── server/              # Express API routes and middleware
│   └── routes/          # One file per feature area (e.g. auth.routes.ts)
├── shared/schema/       # Drizzle ORM table definitions (shared by client + server)
├── test/                # All tests
│   ├── api/             # API route tests (Vitest)
│   ├── client/          # Component tests (Vitest + RTL)
│   ├── integration/     # DB/storage tests (Vitest)
│   ├── security/        # Security-specific tests (Vitest)
│   └── e2e/             # End-to-end flows (Playwright)
└── guides/              # Architecture docs (DESIGN.md, TESTING.md, etc.)
```

---

## Common Commands

All commands run from the `platform/` directory:

```bash
# Development
npm run dev           # Start dev server (http://localhost:5000)

# Checks & build
npm run check         # TypeScript type check
npm run build         # Production build (Vite + esbuild)

# Tests
npm run test:run      # Run all unit/integration tests once (CI mode)
npm run test          # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run test:e2e      # Run Playwright E2E tests

# Database
npm run db:push       # Push schema changes to staging DB
```

---

## Development Guidelines

### Code Style
- **TypeScript everywhere** — avoid `any`; use Zod for runtime validation
- **Drizzle ORM** for all database access — no raw SQL in application code
- **Zod schemas** live in `shared/schema/` alongside Drizzle table definitions
- Use `drizzle-zod` to derive insert/select Zod types from table definitions
- Follow existing file naming: `feature.routes.ts`, `feature.storage.ts`

### API Routes
- Each feature area has its own routes file in `server/routes/`
- All routes are registered in `server/routes/index.ts`
- Use `requireAuth` middleware (Clerk) for protected endpoints
- Validate request bodies with Zod schemas before processing

### Frontend Components
- Use **shadcn/ui** components (in `client/src/components/ui/`) as the base
- Style with **Tailwind CSS** — follow the design system in `guides/DESIGN.md`
- Accessibility is a first-class requirement (WCAG AAA target):
  - Minimum 44×44px touch targets
  - 7:1 contrast ratio for text
  - Full keyboard navigation support
  - Respect `prefers-reduced-motion`
- No parallax or scroll-triggered animations

### Testing
- Tests go in `test/` mirroring the source structure
- Use `describe` blocks and `it('should ...')` naming
- Mock auth using `createMockRequest()` from `test/fixtures/`
- Coverage requirements: **90%+** for auth, CRUD, and admin paths; **70%+** overall
- Write security tests for any user-facing input

### Error Handling
- Server errors are handled by `server/errorHandler.ts` and logged via `server/errorLogger.ts`
- Client errors are reported to Sentry (`client/src/sentry.ts`)
- Use structured error responses matching the patterns in `server/errors.ts`

---

## Environment Variables

Required for local development (copy from `.env.example` if present):

```
DATABASE_URL=          # Neon PostgreSQL connection string
CLERK_SECRET_KEY=      # Clerk backend secret key
VITE_CLERK_PUBLISHABLE_KEY=  # Clerk frontend publishable key
```

Use test/staging Clerk keys (`CLERK_SECRET_KEY_TEST`) during development and CI — never use production keys for tests.

---

## Key Architectural Decisions

- **Shared schema**: `shared/schema/` is imported by both client and server, ensuring type safety end-to-end
- **Mini-apps**: Each mini-app (supportmatch, skills, lighthouse, etc.) has its own schema file in `shared/schema/` and route file in `server/routes/`
- **Invite-only access**: New users require a valid invite code; auth flow handled by Clerk + custom invite validation
- **Rate limiting**: Applied at the route level via `server/rateLimiter.ts`
- **CSRF protection**: Enabled for state-mutating endpoints via `server/csrf.ts`
