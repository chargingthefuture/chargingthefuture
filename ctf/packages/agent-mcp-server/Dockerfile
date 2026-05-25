# syntax=docker/dockerfile:1
# agent-mcp-server — standalone TypeScript MCP server (stdio transport)
# Build context: ctf/  (needs access to ctf/agents — set dockerContext: ctf in render.yaml)

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
# Install deps. No package-lock.json is committed (pnpm monorepo gitignores npm
# lockfiles), so use npm install. The single runtime dep is exactly pinned in
# package.json, keeping the deployed artifact reproducible.
COPY packages/agent-mcp-server/package.json ./
RUN npm install
# Copy source and compile
COPY packages/agent-mcp-server/tsconfig.json ./
COPY packages/agent-mcp-server/src ./src
RUN npm run build && chmod +x dist/index.js

# ── Production image ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Install curl for shell utilities (e.g. Formance ledger bootstrap script)
RUN apk add --no-cache curl bash
# Install only production deps
COPY packages/agent-mcp-server/package.json ./
RUN npm install --omit=dev
# Copy compiled output
COPY --from=builder /app/dist ./dist
# Copy agent definitions (loaded at runtime by discoverAgents)
COPY agents ./agents
# Copy scripts directory (includes formanceBootstrap.sh and other utilities)
COPY scripts ./scripts
CMD ["node", "dist/index.js"]
