#!/usr/bin/env bash
set -euo pipefail

failed=0

while IFS= read -r -d '' file; do
  python3 - <<'PY' "$file" || failed=1
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
data = path.read_bytes()

if not data:
    sys.exit(0)

if not data.endswith(b"\n"):
    print(f"Missing final newline: {path}")
    sys.exit(1)

if re.search(br"\n\n+$", data):
    print(f"Multiple trailing blank lines at EOF: {path}")
    sys.exit(1)

sys.exit(0)
PY
done < <(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.cjs" -o -name "*.json" -o -name "*.css" -o -name "*.yml" -o -name "*.yaml" \) \
  -not -path "./node_modules/*" \
  -not -path "./.next/*" \
  -not -path "./dist/*" \
  -not -path "./build/*" \
  -not -path "./coverage/*" \
  -not -path "./.turbo/*" \
  -not -path "./.pnpm-store/*" \
  -not -path "./design/*" \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/coverage/*" \
  -not -path "*/.turbo/*" \
  -print0)

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "EOF formatting check passed."
