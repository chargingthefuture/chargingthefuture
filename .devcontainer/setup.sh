#!/usr/bin/env bash
set -e

FAST_MODE="${CTF_CODESPACES_FAST_MODE:-0}"

# Install/update Snyk CLI
echo "Checking for Snyk CLI..."
if ! command -v snyk &> /dev/null; then
  npm install -g snyk
else
  echo "Snyk CLI already installed."
fi

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

# Always install/update Railway CLI to latest globally
echo "Installing/Updating Railway CLI globally..."
npm install -g @railway/cli@latest --force

# Install/update Vercel CLI
echo "Checking for Vercel CLI..."
if ! command -v vercel &> /dev/null; then
  npm install -g vercel
else
  echo "Vercel CLI already installed."
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

# Apply schema.sql and run startup builds only when fast mode is disabled.
if [ "$FAST_MODE" != "1" ] && [ -n "$DATABASE_URL" ]; then
  echo "Applying ctf/schema.sql to Neon DB at DATABASE_URL..."
  if command -v psql &> /dev/null; then
    PGPASSWORD="$(echo $DATABASE_URL | sed -n 's/.*:.*:\/\/(.*):(.*)@.*/\2/p')" \
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

# Ensure pre-commit hook is executable if present
if [ -f /workspaces/chargingthefuture/.git/hooks/pre-commit ]; then
  chmod +x /workspaces/chargingthefuture/.git/hooks/pre-commit
  echo "Set pre-commit hook as executable."
else
  echo "No pre-commit hook found to set as executable."
fi

# Configure repo-level Husky hooks path for ctf rewrite workspace
if [ -d /workspaces/chargingthefuture/.git ] && [ -d /workspaces/chargingthefuture/ctf/.husky ]; then
  git -C /workspaces/chargingthefuture config core.hooksPath ctf/.husky
  chmod +x /workspaces/chargingthefuture/ctf/.husky/pre-commit || true
  chmod +x /workspaces/chargingthefuture/ctf/.husky/pre-push || true
  echo "Configured git hooksPath to ctf/.husky"
fi

# Prompt for login if needed
echo "If you need to log in to GitHub, Railway, or Vercel, run:"
echo "  gh auth login"
echo "  railway login"
echo "  vercel login"
