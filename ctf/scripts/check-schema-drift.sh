#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT_DIR" ]]; then
  echo "Must run inside a git repository." >&2
  exit 2
fi
cd "$ROOT_DIR"

mode="default"
ref_range=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref-range)
      mode="ref-range"
      ref_range="${2:-}"
      if [[ -z "$ref_range" ]]; then
        echo "Missing value for --ref-range" >&2
        exit 2
      fi
      shift 2
      ;;
    --all)
      mode="all"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--ref-range <RANGE>|--all]" >&2
      exit 2
      ;;
  esac
done

if [[ "$mode" == "ref-range" ]]; then
  mapfile -d '' -t files < <(git diff --name-only --diff-filter=ACMR -z "$ref_range")
elif [[ "$mode" == "all" ]]; then
  mapfile -d '' -t files < <(git ls-files -z)
else
  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    mapfile -d '' -t files < <(git diff --name-only --diff-filter=ACMR -z "HEAD~1...HEAD")
  else
    mapfile -d '' -t files < <(git ls-files -z)
  fi
fi

db_impacting_changed=false
schema_sql_changed=false
seed_changed=false
contract_changed=false
versioning_note_changed=false
contract_schema_failed=false

validate_contract_file() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    echo "Schema drift gate failed: changed contract file not found: $file" >&2
    contract_schema_failed=true
    return
  fi

  if ! grep -Eq '^[[:space:]]*-?[[:space:]]*pluginId[[:space:]]*:' "$file"; then
    echo "Schema drift gate failed: missing 'pluginId' in contract file: $file" >&2
    contract_schema_failed=true
  fi

  # Accept the canonical per-file version key: command and access-policy
  # contracts use `version` (templates 201/202); audit contracts use
  # `commandVersion` (template 203). `contractVersion` is also tolerated.
  if ! grep -Eq '^[[:space:]]*-?[[:space:]]*(contractVersion|commandVersion|version)[[:space:]]*:' "$file"; then
    echo "Schema drift gate failed: missing 'version' (or 'commandVersion' for audit contracts) in contract file: $file" >&2
    contract_schema_failed=true
  fi

  if [[ "$file" =~ _PLUGIN_COMMAND_CONTRACTS\.ya?ml$ ]]; then
    if ! grep -Eq '^[[:space:]]*-?[[:space:]]*(commandId|command)[[:space:]]*:' "$file"; then
      echo "Schema drift gate failed: missing 'command' in command contract file: $file" >&2
      contract_schema_failed=true
    fi
  fi

  if [[ "$file" =~ _PLUGIN_ACCESS_POLICY_CONTRACTS\.ya?ml$ ]]; then
    if ! grep -Eq '^[[:space:]]*-?[[:space:]]*requiredRoles[[:space:]]*:' "$file"; then
      echo "Schema drift gate failed: missing 'requiredRoles' in access-policy contract file: $file" >&2
      contract_schema_failed=true
    fi
  fi

  if [[ "$file" =~ _PLUGIN_AUDIT_CONTRACTS\.ya?ml$ ]]; then
    if ! grep -Eq '^[[:space:]]*-?[[:space:]]*eventId[[:space:]]*:' "$file"; then
      echo "Schema drift gate failed: missing 'eventId' in audit contract file: $file" >&2
      contract_schema_failed=true
    fi
  fi
}

for file in "${files[@]}"; do
  [[ -z "$file" ]] && continue
  file_lc="$(echo "$file" | tr '[:upper:]' '[:lower:]')"
  keyword_db_eligible=true

  if [[ ! "$file" =~ ^ctf/ ]]; then
    keyword_db_eligible=false
  fi
  if [[ "$file" =~ ^ctf/docs/ ]] || [[ "$file" =~ ^ctf/scripts/ ]] || [[ "$file" =~ ^ctf/packages/mobile/ ]] || [[ "$file" =~ ^ctf/packages/web/ ]]; then
    keyword_db_eligible=false
  fi

  if [[ "$file" == "ctf/schema.sql" ]]; then
    db_impacting_changed=true
    schema_sql_changed=true
  fi

  if [[ "$keyword_db_eligible" == true && "$file_lc" =~ schema|migration|drizzle|sql ]]; then
    db_impacting_changed=true
  fi

  if [[ "$file" =~ ^ctf/server/ ]] || [[ "$file" =~ ^ctf/packages/shared/ ]]; then
    if [[ ! "$file" =~ (^|/)(docs?|tests?|__tests__|testing)(/|$) ]]; then
      db_impacting_changed=true
    fi
  fi

  if [[ "$file" =~ ^ctf/scripts/ ]] && [[ "$file_lc" =~ seed ]]; then
    seed_changed=true
  fi
  if [[ "$file" =~ ^ctf/docs/ ]] && [[ "$file_lc" =~ seed ]]; then
    seed_changed=true
  fi

  if [[ "$file" =~ ^ctf/packages/ ]] && [[ "$file_lc" =~ contract|schema|command|access-policy|audit ]]; then
    contract_changed=true
  fi
  if [[ "$file" =~ ^ctf/docs/contracts/.*_PLUGIN_(COMMAND|ACCESS_POLICY|AUDIT)_CONTRACTS\.ya?ml$ ]]; then
    contract_changed=true
    validate_contract_file "$file"
  fi
  if [[ "$file" =~ ^\.github/instructions/20[0-9].*\.mdc$ ]]; then
    contract_changed=true
  fi

  if [[ "$file" =~ ^ctf/docs/developer/ ]]; then
    versioning_note_changed=true
  fi
  if [[ "$file" == ".github/instructions/122-schema-drift-predeployment-rules.mdc" ]]; then
    versioning_note_changed=true
  fi
done

failed=0

if [[ "$db_impacting_changed" == true && "$schema_sql_changed" != true ]]; then
  echo "Schema drift gate failed: DB-impacting changes detected without an accompanying change to ctf/schema.sql." >&2
  failed=1
fi

if [[ "$seed_changed" == true && "$schema_sql_changed" != true && "$versioning_note_changed" != true ]]; then
  echo "Schema drift gate failed: seed-related changes require an accompanying change to ctf/schema.sql, or versioning evidence (ctf/docs/developer/**, .github/instructions/122-schema-drift-predeployment-rules.mdc) when the seed change carries no schema impact (seed/schema blocker policy)." >&2
  failed=1
fi

if [[ "$contract_changed" == true && "$schema_sql_changed" != true && "$versioning_note_changed" != true ]]; then
  echo "Schema drift gate failed: contract/schema command or policy changes require versioning evidence (ctf/docs/developer/**, .github/instructions/122-schema-drift-predeployment-rules.mdc, or a ctf/schema.sql change)." >&2
  failed=1
fi

if [[ "$contract_schema_failed" == true ]]; then
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  echo "Summary: db_impacting_changed=$db_impacting_changed schema_sql_changed=$schema_sql_changed seed_changed=$seed_changed contract_changed=$contract_changed versioning_note_changed=$versioning_note_changed" >&2
  exit 1
fi

echo "Schema drift gate passed: db_impacting_changed=$db_impacting_changed schema_sql_changed=$schema_sql_changed seed_changed=$seed_changed contract_changed=$contract_changed versioning_note_changed=$versioning_note_changed"
