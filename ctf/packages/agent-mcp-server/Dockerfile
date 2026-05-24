# syntax=docker/dockerfile:1
# agent-mcp-server — standalone TypeScript MCP server (stdio transport)
# Build context: ctf/packages/agent-mcp-server/

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
# Install deps. No package-lock.json is committed (pnpm monorepo gitignores npm
# lockfiles), so use npm install. The single runtime dep is exactly pinned in
# package.json, keeping the deployed artifact reproducible.
COPY package.json ./
RUN npm install
# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && chmod +x dist/index.js

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
