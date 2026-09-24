#!/usr/bin/env bash
# Sets the reader's Render service to the exact image recorded in this repository.
#
# Why
# ───────────────────────────────
# The service was created on the `latest` tag, which means any redeploy — one
# nobody asked for, after a restart or a settings change — could pull a
# different FreshRSS underneath a running reader. The same reasoning already
# pins the ledger's image by digest.
#
# A digest names one exact build and cannot be re-pointed. A tag can: the
# publisher can push a new image to the same tag, and `1.30.0` tomorrow need not
# be `1.30.0` today.
#
# How an upgrade happens
# ───────────────────────────────
# Edit ctf/ops/freshrss/image.txt in a pull request, then run this. The change
# is reviewed, the repository records what is running, and neither can drift
# from the other — which is the part a dashboard edit loses.
#
# This is not a one-shot. It has no schedule, but it is the control for every
# later version move, so it stays in the Actions list.
#
# Inputs (environment variables)
#   RENDER_API_KEY   required — Render API key (rnd_…)
#   SERVICE_NAME     optional — defaults to ctf-freshrss
#   IMAGE_FILE       optional — defaults to ctf/ops/freshrss/image.txt
#
# Nothing secret is printed. The image reference is public by nature.
set -uo pipefail

service="${SERVICE_NAME:-ctf-freshrss}"
image_file="${IMAGE_FILE:-ctf/ops/freshrss/image.txt}"

fail() { echo "::error title=Image not pinned::$1"; exit 1; }

[ -n "${RENDER_API_KEY:-}" ] || fail "RENDER_API_KEY is not set on this run, so the Render API cannot be called."
[ -f "$image_file" ] || fail "No image file at ${image_file}, so there is nothing to pin to."

image=$(tr -d '[:space:]' < "$image_file")
case "$image" in
  *@sha256:*) ;;
  *:*) echo "::warning title=Pinned to a tag::${image} is a tag, not a digest. A publisher can push a new image to the same tag, so this is weaker than the ledger's pin." ;;
  *) fail "'${image}' names no version at all. It must be an image with a digest, or at least a tag." ;;
esac
echo "Pinning to ${image}"

api() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -o /tmp/render.json -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $RENDER_API_KEY" -H 'Content-Type: application/json' \
      -d "$body" "https://api.render.com/v1${path}"
  else
    curl -s -o /tmp/render.json -w '%{http_code}' -X "$method" \
      -H "Authorization: Bearer $RENDER_API_KEY" "https://api.render.com/v1${path}"
  fi
}

status=$(api GET "/services?name=${service}&limit=100" || true)
case "$status" in
  2*) ;;
  401|403) fail "Render refused the API key (HTTP ${status}). Check RENDER_API_KEY is the raw rnd_… value." ;;
  *) fail "Could not list Render services (HTTP ${status:-none})." ;;
esac
service_id=$(jq -r --arg n "$service" 'map(.service) | map(select(.name == $n)) | .[0].id // empty' /tmp/render.json 2>/dev/null || true)
owner_id=$(jq -r --arg n "$service" 'map(.service) | map(select(.name == $n)) | .[0].ownerId // empty' /tmp/render.json 2>/dev/null || true)
[ -n "$service_id" ] || fail "No Render service named '${service}'."
[ -n "$owner_id" ] || fail "Render returned no owner for '${service}', and the image cannot be set without one."

current=$(jq -r 'map(.service) | .[0].imagePath // .[0].serviceDetails.image.imagePath // empty' /tmp/render.json 2>/dev/null || true)
[ -n "$current" ] && echo "Currently: ${current}"

if [ "$current" = "$image" ]; then
  echo "Already pinned to that image. Nothing to deploy."
  {
    echo "### The reader's image"
    echo ""
    echo "Already pinned to \`${image}\`. Nothing changed."
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

payload=$(jq -n --arg o "$owner_id" --arg p "$image" '{ image: { ownerId: $o, imagePath: $p } }')
status=$(api PATCH "/services/${service_id}" "$payload" || true)
case "$status" in
  2*) ;;
  *) fail "Render refused the image (HTTP ${status:-none}). $(jq -r '.message // empty' /tmp/render.json 2>/dev/null) If it will not take a digest, record a version tag in ${image_file} instead and run this again." ;;
esac

api POST "/services/${service_id}/deploys" '{"clearCache":"do_not_clear"}' >/dev/null || true
deploy_id=$(jq -r '.id // empty' /tmp/render.json 2>/dev/null || true)
if [ -z "$deploy_id" ]; then
  api GET "/services/${service_id}/deploys?limit=1" >/dev/null || true
  deploy_id=$(jq -r '.[0].deploy.id // empty' /tmp/render.json 2>/dev/null || true)
fi
[ -n "$deploy_id" ] || fail "The image was set but no deploy started, so the reader is still running the old one. Deploy it from Render and it picks this up."

live=no
waited=0
while [ "$waited" -lt 600 ]; do
  sleep 15
  waited=$((waited + 15))
  api GET "/services/${service_id}/deploys/${deploy_id}" >/dev/null || true
  state=$(jq -r '.status // empty' /tmp/render.json 2>/dev/null || true)
  case "$state" in
    live) echo "  went live after ${waited}s."; live=yes; break ;;
    build_failed|update_failed|canceled|pre_deploy_failed) echo "  ended as ${state} after ${waited}s."; break ;;
    *) echo "  ${state:-unknown} (${waited}s)…" ;;
  esac
done

{
  echo "### The reader's image"
  echo ""
  if [ "$live" = yes ]; then
    echo "Pinned to \`${image}\` and serving."
    echo ""
    echo "A redeploy now pulls that exact build and nothing else. To move version, edit \`${image_file}\` in a pull request and run this again."
  else
    echo "The deploy on \`${image}\` did not come up, so the reader is down or rolled back."
    echo ""
    echo "Put the previous reference back in \`${image_file}\` and run this again to return to what was working."
  fi
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

[ "$live" = yes ] || exit 1
echo "Done."
