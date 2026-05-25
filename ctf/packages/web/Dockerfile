# syntax=docker/dockerfile:1
# Build context: ctf/  (pnpm workspace root — set dockerContext: ctf in render.yaml)

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ── 1. Install all workspace deps ────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
# Root manifest carries the pnpm `overrides`; without it --frozen-lockfile
# reports an overrides mismatch against the lockfile.
COPY package.json tsconfig.base.json ./
# Copy every workspace member's package.json so pnpm can resolve the graph
COPY packages/shared/package.json           packages/shared/package.json
COPY packages/web/package.json              packages/web/package.json
COPY packages/pm-mcp-server/package.json    packages/pm-mcp-server/package.json
COPY packages/economic-models/package.json  packages/economic-models/package.json
COPY packages/education/package.json        packages/education/package.json
COPY packages/eol/package.json              packages/eol/package.json
COPY packages/mobile/package.json           packages/mobile/package.json
RUN pnpm install --frozen-lockfile

# ── 2. Build @ctf/shared + @ctf/web ──────────────────────────────
FROM base AS builder
WORKDIR /repo
# Root manifest (workspace root + pnpm overrides) and tsconfig.base.json, which
# every package's tsconfig.json extends via `../../tsconfig.base.json`.
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
# Bring in node_modules from deps stage
COPY --from=deps /repo/node_modules                      ./node_modules
COPY --from=deps /repo/packages/shared/node_modules      ./packages/shared/node_modules
COPY --from=deps /repo/packages/web/node_modules         ./packages/web/node_modules
# Copy source trees
COPY packages/shared packages/shared
COPY packages/web    packages/web
# Build shared first — web depends on it
RUN pnpm --filter @ctf/shared run build
# Build-time public env vars — passed as --build-arg from GitHub Actions.
# NEXT_PUBLIC_* vars are baked into the client bundle at build time by Next.js.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_AUTH_SIGN_IN_URL
ARG NEXT_PUBLIC_AUTH_AFTER_SIGN_OUT_URL
ARG NEXT_PUBLIC_AUTH_PROVIDER
# Build web (CI mode: skips Sentry build plugin, increases heap)
ENV NEXT_TELEMETRY_DISABLED=1 \
    CTF_SKIP_SENTRY_NEXTJS=1 \
    NODE_OPTIONS="--max-old-space-size=8192" \
    NEXT_PRIVATE_MAX_WORKER_THREADS=1 \
    SENTRY_SUPPRESS_GLOBAL_ERROR_HANDLER_FILE_WARNING=1 \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY=${NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_AUTH_SIGN_IN_URL=${NEXT_PUBLIC_AUTH_SIGN_IN_URL} \
    NEXT_PUBLIC_AUTH_AFTER_SIGN_OUT_URL=${NEXT_PUBLIC_AUTH_AFTER_SIGN_OUT_URL} \
    NEXT_PUBLIC_AUTH_PROVIDER=${NEXT_PUBLIC_AUTH_PROVIDER}
RUN pnpm --filter @ctf/web run build:ci

# ── 3. Production runner ──────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
# Run as a non-root user for least-privilege at runtime
RUN addgroup -S app && adduser -S -G app -h /home/app app
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# Standalone output contains server.js + only the traced runtime deps.
# With outputFileTracingRoot = /repo (workspace root), Next.js places
# server.js at packages/web/server.js inside the standalone directory.
COPY --from=builder --chown=app:app /repo/packages/web/.next/standalone ./
# Static client assets are not included in the standalone output — copy separately.
COPY --from=builder --chown=app:app /repo/packages/web/.next/static     ./packages/web/.next/static
# Public directory (favicons, robots.txt, etc.)
COPY --from=builder --chown=app:app /repo/packages/web/public           ./packages/web/public
EXPOSE 3000
USER app
# HOSTNAME=0.0.0.0 binds to all interfaces inside the container.
# PORT is injected by Render at runtime; server.js reads process.env.PORT.
ENV HOSTNAME=0.0.0.0
CMD ["sh", "-c", "PORT=${PORT:-3000} node packages/web/server.js"]
