#!/usr/bin/env bash
# Deploy Infisical to Render via API.
# Required env vars:
#   RENDER_API_KEY           - Render API key
#   RENDER_OWNER_ID          - Render owner/user ID (e.g. usr-xxx)
#   INFISICAL_DB_URI         - Postgres connection string (Neon)
#   INFISICAL_ENCRYPTION_KEY - 32-char hex key: openssl rand -hex 16
#   INFISICAL_AUTH_SECRET    - JWT secret: openssl rand -base64 32
# Optional env vars:
#   RENDER_PROJECT_ID        - Render project ID (e.g. prj-xxx); places service in a project

set -euo pipefail

: "${RENDER_API_KEY:?RENDER_API_KEY is required}"
: "${RENDER_OWNER_ID:?RENDER_OWNER_ID is required}"
: "${INFISICAL_DB_URI:?INFISICAL_DB_URI is required}"
: "${INFISICAL_ENCRYPTION_KEY:?INFISICAL_ENCRYPTION_KEY is required — generate with: openssl rand -hex 16}"
: "${INFISICAL_AUTH_SECRET:?INFISICAL_AUTH_SECRET is required — generate with: openssl rand -base64 32}"

RENDER_API="https://api.render.com/v1"
SERVICE_NAME="infisical"

echo "==> Checking if Infisical service already exists on Render..."
EXISTING=$(curl -s "$RENDER_API/services?name=$SERVICE_NAME&ownerId=$RENDER_OWNER_ID&limit=1" \
  -H "Authorization: Bearer $RENDER_API_KEY" | jq -r '.[0].service.id // empty')

if [ -n "$EXISTING" ]; then
  echo "==> Service already exists: $EXISTING — updating env vars..."
  SERVICE_ID="$EXISTING"

  VARS_PAYLOAD=$(jq -n \
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
    ]')

  UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$RENDER_API/services/$SERVICE_ID/env-vars" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$VARS_PAYLOAD")

  UPDATE_CODE=$(echo "$UPDATE_RESPONSE" | tail -1)
  if [ "$UPDATE_CODE" != "200" ]; then
    echo "WARNING: Failed to update env vars (HTTP $UPDATE_CODE)" >&2
  fi
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

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$RENDER_API/services" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$SERVICE_PAYLOAD")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  RESPONSE_BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" != "201" ]; then
    echo "ERROR: Render API returned HTTP $HTTP_CODE" >&2
    echo "Response: $RESPONSE_BODY" >&2
    exit 1
  fi

  SERVICE_ID=$(echo "$RESPONSE_BODY" | jq -r '.service.id')
  echo "==> Service created: $SERVICE_ID"
fi

echo "==> Triggering deployment..."
DEPLOY=$(curl -s -w "\n%{http_code}" -X POST "$RENDER_API/services/$SERVICE_ID/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}')

DEPLOY_CODE=$(echo "$DEPLOY" | tail -1)
DEPLOY_BODY=$(echo "$DEPLOY" | head -n -1)

if [ "$DEPLOY_CODE" != "201" ] && [ "$DEPLOY_CODE" != "202" ]; then
  echo "ERROR: Failed to trigger deployment (HTTP $DEPLOY_CODE)" >&2
  echo "Response: $DEPLOY_BODY" >&2
  exit 1
fi

DEPLOY_ID=$(echo "$DEPLOY_BODY" | jq -r '.id')
echo "==> Deploy started: $DEPLOY_ID"

echo "==> Waiting for deploy to complete (up to 10 min)..."
for i in $(seq 1 60); do
  STATUS=$(curl -s "$RENDER_API/services/$SERVICE_ID/deploys/$DEPLOY_ID" \
    -H "Authorization: Bearer $RENDER_API_KEY" | jq -r '.status // "unknown"')
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

SERVICE_URL=$(curl -s "$RENDER_API/services/$SERVICE_ID" \
  -H "Authorization: Bearer $RENDER_API_KEY" | jq -r '.serviceDetails.url // .service.serviceDetails.url // empty')
echo ""
echo "==> Infisical is live at: $SERVICE_URL"
echo "SERVICE_ID=$SERVICE_ID" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
echo "SERVICE_URL=$SERVICE_URL" >> "${GITHUB_OUTPUT:-/dev/null}" 2>/dev/null || true
