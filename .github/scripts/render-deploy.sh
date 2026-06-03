#!/usr/bin/env bash
# Tells Render to deploy the newest pre-built image for one service.
#
# How a deploy reaches production
# ───────────────────────────────
# GitHub Actions builds each image and pushes it to GHCR (…:latest). Render is
# set to pull pre-built images, so it does NOT redeploy on its own when a new
# image is pushed — something has to POST a deploy to the Render API. That is
# what this script does.
#
# Finding the service without a second secret
# ───────────────────────────────
# The Render API needs the service's id (srv-…). Earlier this id lived in its
# own GitHub secret (RENDER_SERVICE_ID_*), and when that secret was missing the
# deploy silently skipped — the image shipped to GHCR but production stayed on
# the old image. To remove that failure mode this script needs only the API
# key: if no explicit id is given, it looks the service up by name. An explicit
# id (RENDER_SERVICE_ID) is still honored as an override when present.
#
# Inputs (environment variables)
#   RENDER_API_KEY        required — Render API key (rnd_…)
#   RENDER_SERVICE_NAME   the service's name in Render, e.g. ctf-web
#   RENDER_SERVICE_ID     optional — explicit srv-… id; skips the name lookup
#
# This never fails the build. The image is already in GHCR and can always be
# deployed by hand (Render dashboard → the service → Manual Deploy → Deploy
# latest reference). Any problem is reported as a GitHub Actions warning so the
# build stays green while still flagging that production was not updated.
set -uo pipefail

name="${RENDER_SERVICE_NAME:-}"
id="${RENDER_SERVICE_ID:-}"
label="${name:-the service}"

if [ -z "${RENDER_API_KEY:-}" ]; then
  echo "RENDER_API_KEY not set — skipping auto-deploy (image is pushed to GHCR; deploy ${label} manually in Render)."
  exit 0
fi

if [ -z "$name" ] && [ -z "$id" ]; then
  echo "Neither RENDER_SERVICE_NAME nor RENDER_SERVICE_ID set — nothing to deploy."
  exit 0
fi

# Look the service id up by name when one was not supplied explicitly. The id
# itself is never printed (treated as opaque), only the human-readable name.
if [ -z "$id" ]; then
  echo "Looking up the Render service id for '${name}'…"
  lookup_status=$(curl -s -o /tmp/render-services.json -w '%{http_code}' \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    "https://api.render.com/v1/services?name=${name}&limit=100" || true)
  case "$lookup_status" in
    2*) ;;
    *)
      echo "::warning title=Render auto-deploy not triggered::Could not list Render services (HTTP ${lookup_status:-none}) to find '${name}'. The image is already pushed to GHCR — deploy it by hand (Manual Deploy → Deploy latest reference) and check RENDER_API_KEY (rnd_…, raw)."
      exit 0
      ;;
  esac
  id=$(jq -r --arg n "$name" 'map(.service) | map(select(.name == $n)) | .[0].id // empty' /tmp/render-services.json 2>/dev/null || true)
fi

if [ -z "$id" ]; then
  echo "::warning title=Render auto-deploy not triggered::No Render service named '${name}' was found with this API key. The image is already pushed to GHCR — deploy it by hand (Manual Deploy → Deploy latest reference)."
  exit 0
fi

# Do NOT use curl -f here (it exits 22 and hides the HTTP error). Capture the
# status code and body so a failed trigger is readable, and never fail the build
# on it — the image is already pushed and can be deployed manually in Render.
deploy_status=$(curl -s -o /tmp/render-deploy.json -w '%{http_code}' -X POST \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://api.render.com/v1/services/${id}/deploys" || true)
echo "Render deploy API responded with HTTP ${deploy_status:-<none>} for ${name}"
case "$deploy_status" in
  2*) echo "Render deploy triggered for ${name}." ;;
  *)
    echo "::warning title=Render auto-deploy not triggered::HTTP ${deploy_status:-none} from Render for ${name}. The image is already pushed to GHCR — deploy it by hand (Manual Deploy → Deploy latest reference) and check RENDER_API_KEY (rnd_…, raw). Response:"
    cat /tmp/render-deploy.json 2>/dev/null || true
    ;;
esac
