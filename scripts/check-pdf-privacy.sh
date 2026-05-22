#!/usr/bin/env bash
# scripts/check-pdf-privacy.sh
# Audit all PDFs for privacy-unsafe metadata and body text.
# Usage: ./scripts/check-pdf-privacy.sh [file.pdf ...]
#   No args = scan all PDFs under static/
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORBIDDEN_LOCAL="$REPO_ROOT/.privacy-forbidden.local"

# Generic forbidden terms safe to hardcode
GENERIC_FORBIDDEN=(
  "earthlingoflight"
  "gmail"
  "MacBook"
  "/Users/"
  "macOS Quartz"
  "Quartz PDFContext"
  "Pages"
)

ERRORS=0
WARNINGS=0

log()  { echo "[pdf-check] $*"; }
warn() { echo "[pdf-check] WARN: $*" >&2; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[pdf-check] FAIL: $*" >&2; ERRORS=$((ERRORS + 1)); }

command -v exiftool >/dev/null 2>&1 || { echo "[pdf-check] ERROR: exiftool not found." >&2; exit 1; }

load_private_terms() {
  PRIVATE_TERMS=()
  if [[ -f "$FORBIDDEN_LOCAL" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" || "$line" == \#* ]] && continue
      PRIVATE_TERMS+=("$line")
    done < "$FORBIDDEN_LOCAL"
    log "Loaded ${#PRIVATE_TERMS[@]} private term(s) from .privacy-forbidden.local"
  else
    log "No .privacy-forbidden.local found — running generic checks only"
  fi
  PRIVATE_TERMS_COUNT=${#PRIVATE_TERMS[@]}
}

check_one() {
  local pdf="$1"
  local rel="${pdf#$REPO_ROOT/}"
  local ok=true

  log "Checking: $rel"

  local meta
  meta=$(exiftool "$pdf" 2>/dev/null)

  # Strip filesystem path lines from exiftool output before checking metadata fields
  local meta_fields
  meta_fields=$(echo "$meta" | grep -v "^File Name\|^Directory\|^File Modification\|^File Access\|^File Inode\|^File Permissions\|^ExifTool Version")

  # ── Metadata checks ────────────────────────────────────────────────────────

  # Must have safe Author
  local author
  author=$(echo "$meta_fields" | grep -i "^Author" | sed 's/.*: //' || true)
  if [[ -z "$author" ]]; then
    warn "$rel: Author field is empty"
  elif echo "$author" | grep -qiE "anonymous|unspecified"; then
    warn "$rel: Author is placeholder — consider setting to 'Matt EarthStar'"
  fi

  # Check generic forbidden in metadata fields
  for term in "${GENERIC_FORBIDDEN[@]}"; do
    if echo "$meta_fields" | grep -qi "$term"; then
      fail "$rel: metadata contains generic forbidden term: '$term'"
      ok=false
    fi
  done

  # Check private terms in metadata fields (report match without printing the term)
  if [[ $PRIVATE_TERMS_COUNT -gt 0 ]]; then
    local i=1
    for term in "${PRIVATE_TERMS[@]}"; do
      if echo "$meta_fields" | grep -qi "$term"; then
        fail "$rel: metadata contains private forbidden term #$i — scrub required"
        ok=false
      fi
      i=$((i + 1))
    done
  fi

  # ── Body text checks ───────────────────────────────────────────────────────

  if command -v pdftotext >/dev/null 2>&1; then
    local bodytext
    bodytext=$(pdftotext "$pdf" - 2>/dev/null || true)

    for term in "${GENERIC_FORBIDDEN[@]}"; do
      # "Pages" and "/Users/" in body text could be legitimate — warn, don't fail
      if [[ "$term" == "Pages" || "$term" == "/Users/" ]]; then
        if echo "$bodytext" | grep -qi "$term"; then
          warn "$rel: body text contains '$term' — verify it is not a private path/tool reference"
        fi
      else
        if echo "$bodytext" | grep -qi "$term"; then
          fail "$rel: body text contains generic forbidden term: '$term'"
          ok=false
        fi
      fi
    done

    if [[ $PRIVATE_TERMS_COUNT -gt 0 ]]; then
      local j=1
      for term in "${PRIVATE_TERMS[@]}"; do
        if echo "$bodytext" | grep -qi "$term"; then
          fail "$rel: body text contains private forbidden term #$j"
          ok=false
        fi
        j=$((j + 1))
      done
    fi
  else
    warn "pdftotext not available — body text not checked for $rel"
  fi

  if $ok; then
    log "OK: $rel"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────

load_private_terms

if [[ $# -gt 0 ]]; then
  PDFS=("$@")
else
  PDFS=()
  while IFS= read -r f; do PDFS+=("$f"); done < <(find "$REPO_ROOT/static" -name "*.pdf" -not -path "*/.vercel/*" 2>/dev/null)
fi

if [[ ${#PDFS[@]} -eq 0 ]]; then
  log "No PDFs found."
  exit 0
fi

log "Checking ${#PDFS[@]} PDF(s)..."

for pdf in "${PDFS[@]}"; do
  [[ -f "$pdf" ]] || { warn "Not found, skipping: $pdf"; continue; }
  check_one "$pdf"
done

echo ""
log "Results: $ERRORS error(s), $WARNINGS warning(s)"

if [[ $ERRORS -gt 0 ]]; then
  echo "[pdf-check] FAILED — run: npm run pdf:scrub" >&2
  exit 1
fi

log "All PDFs passed privacy check."
