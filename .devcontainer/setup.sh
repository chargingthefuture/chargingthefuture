#!/usr/bin/env bash
set -e

FAST_MODE="${CTF_CODESPACES_FAST_MODE:-0}"

# Install/update GitHub CLI
echo "Checking for GitHub CLI (gh)..."
if ! command -v gh &> /dev/null; then
  sudo apt-get update && sudo apt-get install -y gh
else
  echo "GitHub CLI already installed."
fi

# Install ripgrep for fast recursive search used by agent workflows.
echo "Checking for ripgrep (rg)..."
if ! command -v rg &> /dev/null; then
  sudo apt-get update && sudo apt-get install -y ripgrep
else
  echo "ripgrep already installed."
fi

# Install/update Infisical CLI
echo "Checking for Infisical CLI..."
if ! command -v infisical &> /dev/null; then
  npm install -g @infisical/cli
else
  echo "Infisical CLI already installed."
fi

# Install/update Render CLI (used to open a shell into Render services, e.g. to
# run the one-time Formance ledger bootstrap from inside the private network).
echo "Checking for Render CLI..."
if ! command -v render &> /dev/null; then
  curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh || echo "Warning: Render CLI install failed — run 'curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh' manually."
else
  echo "Render CLI already installed."
fi

echo "Checking for eas-cli..."
if ! command -v eas &> /dev/null; then
  npm install -g eas-cli
else
  echo "eas-cli already installed."
fi

# Ensure pnpm is installed
echo "Checking for pnpm..."
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
else
  echo "pnpm already installed."
fi

# Install system libraries required for Expo/React Native DevTools.
# Skip in fast mode to reduce Codespaces startup CPU/time.
if [ "$FAST_MODE" != "1" ]; then
  echo "Installing system libraries for Expo/React Native DevTools..."
  sudo apt-get update && sudo apt-get install -y libatk1.0-0 libgtk-3-0 libnotify4 libgdk-pixbuf2.0-0 libxss1 libasound2 libnss3 libx11-xcb1
else
  echo "Fast mode enabled: skipping Expo/React Native DevTools system libraries."
fi

# Install dependencies for the root project, ctf workspace, and standalone apps.
echo "Installing root pnpm dependencies..."
pnpm install

echo "Installing ctf workspace dependencies..."
pnpm --dir /workspaces/chargingthefuture/ctf install

# Install dependencies for ctf/packages/web only (monorepo filter)
echo "Installing ctf/packages/web dependencies only..."
pnpm --dir /workspaces/chargingthefuture/ctf/packages/web install

# Build agent MCP server (required for agent discovery in Claude Code, Copilot, ona)
echo "Building agent MCP server for agent discovery..."
pnpm --filter "@ctf/agent-mcp-server" build || {
  echo "Warning: Agent MCP server build failed — agents will not be discoverable.";
  echo "Retry manually: pnpm --filter '@ctf/agent-mcp-server' build"
}

# Apply schema.sql and run startup builds only when fast mode is disabled.
if [ "$FAST_MODE" != "1" ] && [ -n "$DATABASE_URL" ]; then
  echo "Applying ctf/schema.sql to Neon DB at DATABASE_URL..."
  if command -v psql &> /dev/null; then
    PGPASSWORD="$(echo "$DATABASE_URL" | sed -En 's/.*:\/\/[^:]+:([^@]+)@.*/\1/p')" \
    psql "$DATABASE_URL" -f /workspaces/chargingthefuture/ctf/schema.sql || {
      echo "Failed to apply schema.sql to Neon DB. Check your DATABASE_URL and schema file.";
      exit 1;
    }
  else
    echo "psql not found. Please install PostgreSQL client tools in your devcontainer.";
    exit 1;
  fi
  echo "Running Next.js build for ctf/packages/web against Neon DB..."
  pnpm --dir /workspaces/chargingthefuture/ctf --filter @ctf/web run build || {
    echo "Next.js build failed for ctf/packages/web. Check for SQL/runtime errors in your codebase.";
    exit 1;
  }

elif [ "$FAST_MODE" = "1" ]; then
  echo "Fast mode enabled: skipping schema.sql application and startup builds."
else
  echo "Warning: DATABASE_URL is not set. Skipping schema.sql application and build."
fi

echo "Checking for CodeRabbit CLI..."
if ! command -v coderabbit &> /dev/null; then
  curl -fsSL https://cli.coderabbit.ai/install.sh | sh
else
  echo "CodeRabbit CLI already installed."
fi

echo "Checking for Claude CLI..."
if ! command -v claude &> /dev/null; then
  curl -fsSL https://claude.ai/install.sh | bash || echo "Warning: Claude CLI install failed — run 'curl -fsSL https://claude.ai/install.sh | bash' manually."
else
  echo "Claude CLI already installed."
fi

echo "Installing GitHub Copilot CLI (idempotent)..."
curl -fsSL https://gh.io/copilot-install | bash || echo "Warning: GitHub Copilot CLI install failed — run 'curl -fsSL https://gh.io/copilot-install | bash' manually."

# Ensure pre-commit hook is executable if present
if [ -f /workspaces/chargingthefuture/.git/hooks/pre-commit ]; then
  chmod +x /workspaces/chargingthefuture/.git/hooks/pre-commit
  echo "Set pre-commit hook as executable."
else
  echo "No pre-commit hook found to set as executable."
fi

# Configure repo-level Husky hooks path
if [ -d /workspaces/chargingthefuture/.git ] && [ -d /workspaces/chargingthefuture/ctf/.husky ]; then
  git -C /workspaces/chargingthefuture config core.hooksPath ctf/.husky
  chmod +x /workspaces/chargingthefuture/ctf/.husky/pre-commit || true
  chmod +x /workspaces/chargingthefuture/ctf/.husky/pre-push || true
  echo "Configured git hooksPath to ctf/.husky"
fi

# Verify Render API key for MCP server access (.mcp.json uses RENDER_API_KEY to
# authenticate against https://mcp.render.com/mcp — lets agents pull logs, trigger
# deploys, and inspect services without copy-pasting from the dashboard).
echo "Verifying Render MCP access..."
if [ -n "$RENDER_API_KEY" ]; then
  echo "Render MCP: RENDER_API_KEY is set — Render MCP server will be authenticated."
else
  echo "Warning: RENDER_API_KEY not set. Render MCP server will not work."
  echo "Add RENDER_API_KEY as a Codespaces secret (Settings > Secrets > Codespaces) and re-open the Codespace."
  echo "Generate an API key at: https://dashboard.render.com/u/settings#api-keys"
fi

# Prompt for any remaining manual logins
echo "If you need to log in to GitHub, run:"
echo "  gh auth login"
