# syntax=docker/dockerfile:1
# pm-mcp-server — TypeScript MCP server for PM feedback workflows (stdio transport)
# Build context: ctf/packages/pm-mcp-server/
#
# NOTE: This image is for local / manual stdio invocation only — it is NOT a
# Render service. A stdio MCP server exits as soon as stdin closes, which always
# happens on a PaaS worker (no client connects via stdin), so it must never be
# deployed as a Render `worker`. See render.yaml and ctf/docs/developer/PM.md.

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
# Install all deps (including devDeps for tsc). No package-lock.json is committed
# (pnpm monorepo gitignores npm lockfiles), so use npm install.
COPY package.json ./
RUN npm install
# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Production image ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Install only production deps
COPY package.json ./
RUN npm install --omit=dev
# Copy compiled output
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
