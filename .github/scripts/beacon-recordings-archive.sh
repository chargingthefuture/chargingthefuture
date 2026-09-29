#!/usr/bin/env bash
# Keeps this project's own copy of every Beacon recording.
#
# Stream hosts each broadcast's recording, and its copy can expire or be
# deleted. This asks the app which recordings have no copy yet, downloads each
# one, and publishes it as an asset on the `beacon-recordings` release of this
# repository, named <eventId>.mp4. Then it tells the app where the copy is, and
# from then on the public recording address, the blog's streams page and the
# podcast feed play the copy.
#
# A release asset must be under 2 GiB. A recording at or over the limit below
# is re-encoded to 540p first; one still too large after that is reported and
# left on Stream's copy.
#
# The download address the app hands over is a signed file address. It is
# never printed.
#
# Inputs (environment variables)
#   APP_URL       required — the app's base address
#   CRON_SECRET   required — must match the app's CRON_SECRET
#   GH_TOKEN      required — a token that can write releases in this repository
#   GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY — set by Actions
set -uo pipefail

release=beacon-recordings
limit_bytes=2000000000
prefix="https://github.com/${GITHUB_REPOSITORY}/releases/download/${release}"

fail() { echo "::error title=Recording copy failed::$1"; echo "Failed: $1" >> "$GITHUB_STEP_SUMMARY"; exit 1; }

[ -n "${APP_URL:-}" ] || fail "NEXT_PUBLIC_APP_URL is not set in GitHub Actions secrets."
[ -n "${CRON_SECRET:-}" ] || fail "CRON_SECRET is not set in GitHub Actions secrets."
base="${APP_URL%/}/api/internal/beacon/recordings-archive"

code=$(curl -sS -o /tmp/pending.json -w '%{http_code}' -H "Authorization: Bearer ${CRON_SECRET}" "$base" || true)
[ "$code" = "200" ] || fail "The app answered HTTP ${code:-none} for the list of recordings to copy. Check CRON_SECRET matches the app and the route is deployed."

count=$(jq '.pending | length' /tmp/pending.json)
echo "### Beacon recordings" >> "$GITHUB_STEP_SUMMARY"
if [ "$count" = "0" ]; then
  echo "Nothing to copy: every recording already has a copy here." | tee -a "$GITHUB_STEP_SUMMARY"
  exit 0
fi

if ! gh release view "$release" >/dev/null 2>&1; then
  gh release create "$release" --latest=false --title "Beacon recordings" \
    --notes "Every recorded Beacon broadcast, one file per broadcast, named by event id. Written by the beacon-recordings-archive workflow. Listed at https://chargingthefuture.github.io/chargingthefuture/streams." \
    || fail "Could not create the ${release} release."
fi

failures=0
for i in $(seq 0 $((count - 1))); do
  id=$(jq -r ".pending[$i].id" /tmp/pending.json)
  title=$(jq -r ".pending[$i].title" /tmp/pending.json)
  url=$(jq -r ".pending[$i].downloadUrl" /tmp/pending.json)
  file="/tmp/${id}.mp4"
  echo "Copying ${id} (${title})"

  if ! curl -sSfL -o "$file" "$url"; then
    echo "::warning::${id}: the download from Stream failed. It stays on Stream's copy and is tried again next run."
    echo "- ${title}: download failed, tried again next run." >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1)); continue
  fi

  size=$(stat -c %s "$file")
  if [ "$size" -ge "$limit_bytes" ]; then
    echo "${id}: ${size} bytes is over the release limit; re-encoding to 540p."
    if ! ffmpeg -loglevel error -y -i "$file" -vf scale=-2:540 -c:v libx264 -preset veryfast -crf 28 \
         -c:a aac -b:a 96k -movflags +faststart "/tmp/${id}.small.mp4"; then
      echo "::warning::${id}: re-encoding failed."
      echo "- ${title}: too large and re-encoding failed; stays on Stream's copy." >> "$GITHUB_STEP_SUMMARY"
      failures=$((failures + 1)); rm -f "$file"; continue
    fi
    mv "/tmp/${id}.small.mp4" "$file"
    size=$(stat -c %s "$file")
    if [ "$size" -ge "$limit_bytes" ]; then
      echo "::warning::${id}: still ${size} bytes after re-encoding."
      echo "- ${title}: still over 2 GB after re-encoding; stays on Stream's copy." >> "$GITHUB_STEP_SUMMARY"
      failures=$((failures + 1)); rm -f "$file"; continue
    fi
  fi

  if ! gh release upload "$release" "$file" --clobber; then
    echo "::warning::${id}: the upload to the release failed."
    echo "- ${title}: upload failed, tried again next run." >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1)); rm -f "$file"; continue
  fi
  rm -f "$file"

  body=$(jq -n --arg e "$id" --arg u "${prefix}/${id}.mp4" '{ eventId: $e, archivedUrl: $u }')
  code=$(curl -sS -o /tmp/record.json -w '%{http_code}' -X POST "$base" \
    -H "Authorization: Bearer ${CRON_SECRET}" -H 'Content-Type: application/json' -d "$body" || true)
  if [ "$code" != "200" ]; then
    echo "::warning::${id}: uploaded, but the app answered HTTP ${code:-none} when told where the copy is: $(jq -r '.message // empty' /tmp/record.json 2>/dev/null)"
    echo "- ${title}: uploaded, but the app did not record it; tried again next run." >> "$GITHUB_STEP_SUMMARY"
    failures=$((failures + 1)); continue
  fi
  echo "- ${title}: copied (${size} bytes)." >> "$GITHUB_STEP_SUMMARY"
done

[ "$failures" = "0" ] || fail "${failures} of ${count} recordings were not copied; see the lines above."
