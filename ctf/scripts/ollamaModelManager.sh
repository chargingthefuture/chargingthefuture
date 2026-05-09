#!/usr/bin/env bash
# Manage models on the Railway-hosted Ollama service.
#
# Infisical stores OLLAMA_BASE_URL as the private Railway hostname
# (http://ollama.railway.internal:11434) which only resolves inside the
# Railway runtime. When running from Codespaces, override with the public URL:
#
#   OLLAMA_BASE_URL=https://ollama-<hash>.up.railway.app \
#     bash ./scripts/ollamaModelManager.sh list
#
# Or inject from Infisical and override in one command:
#   infisical run --env=staging -- env \
#     OLLAMA_BASE_URL=https://ollama-<hash>.up.railway.app \
#     bash ./scripts/ollamaModelManager.sh list
set -euo pipefail

if [[ -z "${OLLAMA_BASE_URL:-}" ]]; then
  echo "ERROR: OLLAMA_BASE_URL is not set."
  echo ""
  echo "Either inject from Infisical:"
  echo "  infisical run --env=staging -- bash ./scripts/ollamaModelManager.sh list"
  echo ""
  echo "Or set it directly (use the public Railway URL when running from Codespaces):"
  echo "  OLLAMA_BASE_URL=https://ollama-<hash>.up.railway.app bash ./scripts/ollamaModelManager.sh list"
  exit 1
fi

COMMAND="${1:-list}"
MODEL="${2:-}"
BASE_URL="${OLLAMA_BASE_URL%/}"

if [[ "${BASE_URL}" == *".railway.internal"* ]]; then
  hostname="${BASE_URL#http://}"
  hostname="${hostname#https://}"
  hostname="${hostname%%:*}"
  if ! getent hosts "${hostname}" >/dev/null 2>&1; then
    echo "ERROR: OLLAMA_BASE_URL is set to a Railway private hostname (${BASE_URL})."
    echo "       Private hostnames only resolve inside the Railway runtime."
    echo ""
    echo "From Codespaces, override with the public Railway URL:"
    echo "  OLLAMA_BASE_URL=https://ollama-<hash>.up.railway.app bash ./scripts/ollamaModelManager.sh ${COMMAND}${MODEL:+ ${MODEL}}"
    echo ""
    echo "Find the public URL: Railway dashboard → Ollama service → Settings → Domains."
    exit 1
  fi
fi

case "${COMMAND}" in
  list)
    echo "[ollama] Listing installed models at ${BASE_URL}"
    curl -sS "${BASE_URL}/api/tags" | (command -v jq >/dev/null 2>&1 && jq '.' || cat)
    echo
    ;;

  pull)
    if [[ -z "${MODEL}" ]]; then
      echo "Usage: ollamaModelManager.sh pull <model-name>"
      echo "Example: OLLAMA_BASE_URL=https://... bash ./scripts/ollamaModelManager.sh pull llama3.2"
      exit 1
    fi
    echo "[ollama] Pulling model '${MODEL}' from ${BASE_URL} (may take several minutes for large models)"
    pull_status="$(curl -sS -o /tmp/ollama-pull-response.json -w "%{http_code}" \
      --max-time 600 \
      -X POST \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"${MODEL}\",\"stream\":false}" \
      "${BASE_URL}/api/pull")"
    pull_body="$(cat /tmp/ollama-pull-response.json 2>/dev/null || true)"
    if [[ "${pull_status}" != "200" ]]; then
      echo "Pull failed with HTTP ${pull_status}"
      echo "${pull_body}"
      exit 1
    fi
    echo "Model '${MODEL}' pulled successfully."
    echo "${pull_body}" | (command -v jq >/dev/null 2>&1 && jq '.' || cat)
    echo
    echo "[ollama] Verifying — listing installed models:"
    curl -sS "${BASE_URL}/api/tags" | (command -v jq >/dev/null 2>&1 && jq '.' || cat)
    echo
    ;;

  delete)
    if [[ -z "${MODEL}" ]]; then
      echo "Usage: ollamaModelManager.sh delete <model-name>"
      echo "Example: OLLAMA_BASE_URL=https://... bash ./scripts/ollamaModelManager.sh delete llama3.2"
      exit 1
    fi
    echo "[ollama] Deleting model '${MODEL}' from ${BASE_URL}"
    delete_status="$(curl -sS -o /tmp/ollama-delete-response.json -w "%{http_code}" \
      -X DELETE \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"${MODEL}\"}" \
      "${BASE_URL}/api/delete")"
    if [[ "${delete_status}" != "200" ]]; then
      echo "Delete failed with HTTP ${delete_status}"
      cat /tmp/ollama-delete-response.json
      exit 1
    fi
    echo "Model '${MODEL}' deleted."
    ;;

  *)
    echo "Unknown command: ${COMMAND}"
    echo "Available commands: list | pull <model> | delete <model>"
    exit 1
    ;;
esac
