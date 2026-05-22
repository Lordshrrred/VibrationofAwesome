#!/usr/bin/env bash
# scripts/install-hooks.sh
# Install git pre-commit hook for PDF privacy scrubbing.
# Run once after cloning: ./scripts/install-hooks.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
HOOK_FILE="$HOOKS_DIR/pre-commit"

if [[ ! -d "$HOOKS_DIR" ]]; then
  echo "ERROR: .git/hooks not found — are you in a git repository?" >&2
  exit 1
fi

cat > "$HOOK_FILE" << 'HOOK'
#!/usr/bin/env bash
# pre-commit hook: scrub and check staged PDFs before commit
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRUB="$REPO_ROOT/scripts/scrub-pdf-metadata.sh"
CHECK="$REPO_ROOT/scripts/check-pdf-privacy.sh"

STAGED_PDFS=()
while IFS= read -r f; do
  STAGED_PDFS+=("$REPO_ROOT/$f")
done < <(git diff --cached --name-only | grep -i '\.pdf$' || true)

if [[ ${#STAGED_PDFS[@]} -eq 0 ]]; then
  exit 0
fi

echo "[pre-commit] Found ${#STAGED_PDFS[@]} staged PDF(s) — running privacy scrub..."

if [[ ! -x "$SCRUB" ]]; then
  echo "[pre-commit] ERROR: $SCRUB not found or not executable" >&2
  exit 1
fi

"$SCRUB" "${STAGED_PDFS[@]}"

# Re-stage scrubbed files
for pdf in "${STAGED_PDFS[@]}"; do
  rel="${pdf#$REPO_ROOT/}"
  git add "$rel"
done

if [[ -x "$CHECK" ]]; then
  "$CHECK" "${STAGED_PDFS[@]}"
fi

echo "[pre-commit] PDF privacy check passed."
HOOK

chmod +x "$HOOK_FILE"
echo "Installed pre-commit hook at $HOOK_FILE"

# Make scripts executable
chmod +x "$REPO_ROOT/scripts/scrub-pdf-metadata.sh"
chmod +x "$REPO_ROOT/scripts/check-pdf-privacy.sh"
chmod +x "$REPO_ROOT/scripts/install-hooks.sh"
echo "Scripts marked executable."
