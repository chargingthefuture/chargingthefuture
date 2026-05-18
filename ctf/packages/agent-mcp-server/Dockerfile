# syntax=docker/dockerfile:1
# agent-mcp-server — standalone TypeScript MCP server (stdio transport)
# Build context: ctf/packages/agent-mcp-server/

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
# Install deps
COPY package.json ./
RUN npm install --frozen-lockfile
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
RUN npm install --omit=dev --frozen-lockfile
# Copy compiled output
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
