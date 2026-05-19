#!/usr/bin/env bash
# Deploy Infisical to Render via API.
# Required env vars:
#   RENDER_API_KEY       - Render API key
#   RENDER_OWNER_ID      - Render owner/user ID (e.g. usr-xxx)
#   INFISICAL_DB_URI     - Postgres connection string (Neon)
# Optional env vars:
#   RENDER_PROJECT_ID        - Render project ID (e.g. prj-xxx); places service in a project
#   INFISICAL_ENCRYPTION_KEY - 32-char hex encryption key (auto-generated if not set)
#   INFISICAL_AUTH_SECRET    - JWT auth secret (auto-generated if not set)

set -euo pipefail

: "${RENDER_API_KEY:?RENDER_API_KEY is required}"
: "${RENDER_OWNER_ID:?RENDER_OWNER_ID is required}"
: "${INFISICAL_DB_URI:?INFISICAL_DB_URI is required}"

RENDER_API="https://api.render.com/v1"
SERVICE_NAME="infisical"

# Auto-generate secrets if not provided
if [ -z "${INFISICAL_ENCRYPTION_KEY:-}" ]; then
  INFISICAL_ENCRYPTION_KEY=$(openssl rand -hex 16)
  echo "==> Generated INFISICAL_ENCRYPTION_KEY (save this): $INFISICAL_ENCRYPTION_KEY"
  echo "INFISICAL_ENCRYPTION_KEY=$INFISICAL_ENCRYPTION_KEY" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
fi

if [ -z "${INFISICAL_AUTH_SECRET:-}" ]; then
  INFISICAL_AUTH_SECRET=$(openssl rand -base64 32)
  echo "==> Generated INFISICAL_AUTH_SECRET (save this): $INFISICAL_AUTH_SECRET"
  echo "INFISICAL_AUTH_SECRET=$INFISICAL_AUTH_SECRET" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
fi

echo "==> Checking if Infisical service already exists on Render..."
EXISTING=$(curl -sf "$RENDER_API/services?name=$SERVICE_NAME&ownerId=$RENDER_OWNER_ID&limit=1" \
  -H "Authorization: Bearer $RENDER_API_KEY" | jq -r '.[0].service.id // empty')

if [ -n "$EXISTING" ]; then
  echo "==> Service already exists: $EXISTING — updating env vars..."
  SERVICE_ID="$EXISTING"

  curl -sf -X PUT "$RENDER_API/services/$SERVICE_ID/env-vars" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg db "$INFISICAL_DB_URI" \
      --arg enc "$INFISICAL_ENCRYPTION_KEY" \
      --arg auth "$INFISICAL_AUTH_SECRET" \
      '[
        {"key":"DB_CONNECTION_URI","value":$db},
        {"key":"ENCRYPTION_KEY","value":$enc},
        {"key":"AUTH_SECRET","value":$auth},
        {"key":"NODE_ENV","value":"production"},
        {"key":"TELEMETRY_ENABLED","value":"false"},
        {"key":"PORT","value":"8080"}
      ]')" > /dev/null
  echo "==> Env vars updated."
else
  echo "==> Creating Infisical service on Render..."

  # Build the service payload, optionally including projectId
  SERVICE_PAYLOAD=$(jq -n \
    --arg name "$SERVICE_NAME" \
    --arg owner "$RENDER_OWNER_ID" \
    --arg project "${RENDER_PROJECT_ID:-}" \
    --arg db "$INFISICAL_DB_URI" \
    --arg enc "$INFISICAL_ENCRYPTION_KEY" \
    --arg auth "$INFISICAL_AUTH_SECRET" \
    '{
      type: "web_service",
      name: $name,
      ownerId: $owner,
      image: {
        ownerId: $owner,
        imagePath: "docker.io/infisical/infisical:latest-postgres"
      },
      serviceDetails: {
        env: "image",
        plan: "starter",
        region: "ohio",
        healthCheckPath: "/api/status",
        numInstances: 1,
        pullRequestPreviewsEnabled: "no"
      },
      envVars: [
        {key: "DB_CONNECTION_URI", value: $db},
        {key: "ENCRYPTION_KEY", value: $enc},
        {key: "AUTH_SECRET", value: $auth},
        {key: "NODE_ENV", value: "production"},
        {key: "TELEMETRY_ENABLED", value: "false"},
        {key: "PORT", value: "8080"}
      ]
    } | if $project != "" then . + {projectId: $project} else . end')

  RESPONSE=$(curl -sf -X POST "$RENDER_API/services" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$SERVICE_PAYLOAD")

  SERVICE_ID=$(echo "$RESPONSE" | jq -r '.service.id')
  echo "==> Service created: $SERVICE_ID"
fi

echo "==> Triggering deployment..."
DEPLOY=$(curl -sf -X POST "$RENDER_API/services/$SERVICE_ID/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}')
DEPLOY_ID=$(echo "$DEPLOY" | jq -r '.id')
echo "==> Deploy started: $DEPLOY_ID"

echo "==> Waiting for deploy to complete (up to 10 min)..."
for i in $(seq 1 60); do
  STATUS=$(curl -sf "$RENDER_API/services/$SERVICE_ID/deploys/$DEPLOY_ID" \
    -H "Authorization: Bearer $RENDER_API_KEY" | jq -r '.status')
  echo "    [$i/60] status: $STATUS"
  if [ "$STATUS" = "live" ]; then
    echo "==> Deploy succeeded."
    break
  elif [ "$STATUS" = "deactivated" ] || [ "$STATUS" = "build_failed" ] || [ "$STATUS" = "update_failed" ]; then
    echo "ERROR: Deploy failed with status: $STATUS" >&2
    exit 1
  fi
  sleep 10
done

SERVICE_URL=$(curl -sf "$RENDER_API/services/$SERVICE_ID" \
  -H "Authorization: Bearer $RENDER_API_KEY" | jq -r '.serviceDetails.url // .service.serviceDetails.url // empty')
echo ""
echo "==> Infisical is live at: $SERVICE_URL"
echo "SERVICE_ID=$SERVICE_ID" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
echo "SERVICE_URL=$SERVICE_URL" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
