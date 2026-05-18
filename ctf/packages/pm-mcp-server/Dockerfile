# syntax=docker/dockerfile:1
# pm-mcp-server — TypeScript MCP server for PM feedback workflows (stdio transport)
# Build context: ctf/packages/pm-mcp-server/

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
# Install all deps (including devDeps for tsc)
COPY package.json ./
RUN npm install --frozen-lockfile
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
RUN npm install --omit=dev --frozen-lockfile
# Copy compiled output
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
