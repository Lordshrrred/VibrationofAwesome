#!/usr/bin/env bash
# scripts/scrub-pdf-metadata.sh
# Scrub and set safe metadata on PDF files before commit.
# Usage: ./scripts/scrub-pdf-metadata.sh [file.pdf ...]
#   No args = find all PDFs in the repo.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
METADATA_CONFIG="$REPO_ROOT/config/pdf-metadata.json"
FORBIDDEN_LOCAL="$REPO_ROOT/.privacy-forbidden.local"

SAFE_AUTHOR="Matt EarthStar"
SAFE_CREATOR="Vibration of Awesome"
SAFE_PRODUCER="Vibration of Awesome"

# Generic forbidden terms safe to hardcode (not private identifiers)
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

log() { echo "[pdf-scrub] $*"; }
warn() { echo "[pdf-scrub] WARN: $*" >&2; }
fail() { echo "[pdf-scrub] FAIL: $*" >&2; ERRORS=$((ERRORS + 1)); }

command -v exiftool >/dev/null 2>&1 || { echo "[pdf-scrub] ERROR: exiftool not found. Install with: brew install exiftool" >&2; exit 1; }

# Load private forbidden terms without printing them
load_private_terms() {
  PRIVATE_TERMS=()
  if [[ -f "$FORBIDDEN_LOCAL" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" || "$line" == \#* ]] && continue
      PRIVATE_TERMS+=("$line")
    done < "$FORBIDDEN_LOCAL"
    log "Loaded ${#PRIVATE_TERMS[@]} private term(s) from .privacy-forbidden.local"
  fi
  PRIVATE_TERMS_COUNT=${#PRIVATE_TERMS[@]}
}

# Look up per-file metadata from config/pdf-metadata.json
get_metadata_field() {
  local pdf_rel="$1" field="$2"
  if [[ -f "$METADATA_CONFIG" ]]; then
    val=$(jq -r --arg p "$pdf_rel" --arg f "$field" '.[$p][$f] // empty' "$METADATA_CONFIG" 2>/dev/null || true)
    echo "$val"
  fi
}

scrub_one() {
  local pdf="$1"
  local rel="${pdf#$REPO_ROOT/}"

  log "Scrubbing: $rel"

  # Resolve per-file overrides from config
  local title subject keywords
  title=$(get_metadata_field "$rel" "Title")
  subject=$(get_metadata_field "$rel" "Subject")
  keywords=$(get_metadata_field "$rel" "Keywords")

  [[ -z "$title" ]]    && title="Vibration of Awesome"
  [[ -z "$subject" ]]  && subject="Content from Vibration of Awesome"
  [[ -z "$keywords" ]] && keywords="Vibration of Awesome, EarthStar Rising"

  exiftool \
    -Author="$SAFE_AUTHOR" \
    -Creator="$SAFE_CREATOR" \
    -Producer="$SAFE_PRODUCER" \
    -Title="$title" \
    -Subject="$subject" \
    -Keywords="$keywords" \
    -overwrite_original \
    "$pdf" >/dev/null 2>&1

  # Verify metadata after scrub
  local meta
  meta=$(exiftool "$pdf" 2>/dev/null)

  # Strip file path lines from exiftool output before checking (path is not embedded metadata)
  local meta_fields
  meta_fields=$(echo "$meta" | grep -v "^File Name\|^Directory\|^File Modification\|^File Access\|^File Inode\|^File Permissions\|^ExifTool Version")

  # Check generic forbidden terms in metadata fields only
  for term in "${GENERIC_FORBIDDEN[@]}"; do
    if echo "$meta_fields" | grep -qi "$term"; then
      fail "$rel: generic forbidden term still present in metadata after scrub (term: $term)"
    fi
  done

  # Check private terms in metadata fields without printing them
  if [[ $PRIVATE_TERMS_COUNT -gt 0 ]]; then
    local i=1
    for term in "${PRIVATE_TERMS[@]}"; do
      if echo "$meta_fields" | grep -qi "$term"; then
        fail "$rel: private forbidden term #$i still present in metadata after scrub"
      fi
      i=$((i + 1))
    done
  fi

  # Check body text if pdftotext is available
  if command -v pdftotext >/dev/null 2>&1; then
    local bodytext
    bodytext=$(pdftotext "$pdf" - 2>/dev/null || true)

    for term in "${GENERIC_FORBIDDEN[@]}"; do
      if echo "$bodytext" | grep -qi "$term"; then
        warn "$rel: generic term '$term' found in body text (may be intentional — review manually)"
      fi
    done

    if [[ $PRIVATE_TERMS_COUNT -gt 0 ]]; then
      local j=1
      for term in "${PRIVATE_TERMS[@]}"; do
        if echo "$bodytext" | grep -qi "$term"; then
          fail "$rel: private forbidden term #$j found in body text"
        fi
        j=$((j + 1))
      done
    fi
  fi

  log "Done: $rel"
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

log "Scrubbing ${#PDFS[@]} PDF(s)..."

for pdf in "${PDFS[@]}"; do
  [[ -f "$pdf" ]] || { warn "Not found, skipping: $pdf"; continue; }
  scrub_one "$pdf"
done

if [[ $ERRORS -gt 0 ]]; then
  echo "[pdf-scrub] FAILED with $ERRORS error(s). Review output above." >&2
  exit 1
fi

log "All PDFs scrubbed successfully."
