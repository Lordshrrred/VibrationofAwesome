# PDF Privacy Workflow

## Why this exists

PDF files created by desktop apps (Apple Pages, Microsoft Word, Google Docs, macOS Print to PDF) embed metadata automatically. This metadata can include the OS account name, email address, machine hostname, software name, and other identifiers that may not be intended for public release.

This repo scrubs that metadata before any PDF is committed or deployed.

## What gets scrubbed

Every PDF in `static/` is processed with `exiftool` to:

- Set `Author` to the public brand identity
- Set `Creator` and `Producer` to `Vibration of Awesome`
- Remove macOS/Pages/Word tool fingerprints
- Apply per-file `Title`, `Subject`, and `Keywords` from `config/pdf-metadata.json`

## Private forbidden terms

Generic terms (`earthlingoflight`, `MacBook`, `macOS Quartz`, etc.) are hardcoded into the check scripts.

Private identifiers (legal name, personal email, machine name, old usernames) belong in a local file that is never committed:

```
.privacy-forbidden.local
```

### First-time setup

```bash
cp .privacy-forbidden.example .privacy-forbidden.local
# Edit .privacy-forbidden.local — add one private term per line
```

This file is gitignored. It will never be committed. When a term matches, the scripts report the file name but do not print the term itself.

## Adding metadata for a new PDF

Edit `config/pdf-metadata.json` and add an entry keyed by the repo-relative path:

```json
"static/downloads/my-new-file.pdf": {
  "Title": "My New Guide",
  "Subject": "A short description of the content",
  "Keywords": "Vibration of Awesome, EarthStar Rising, relevant terms"
}
```

If no entry exists for a file, safe generic defaults are applied automatically.

## Running checks manually

```bash
# Scrub all PDFs
npm run pdf:scrub

# Check all PDFs (metadata + body text)
npm run pdf:check

# Scrub a specific file
bash scripts/scrub-pdf-metadata.sh static/downloads/my-file.pdf

# Check a specific file
bash scripts/check-pdf-privacy.sh static/downloads/my-file.pdf
```

## Pre-commit hook

Install the git pre-commit hook once after cloning:

```bash
bash scripts/install-hooks.sh
```

After that, any time you `git commit` with a PDF staged, the hook:

1. Runs `scrub-pdf-metadata.sh` on each staged PDF
2. Re-stages the scrubbed file
3. Runs `check-pdf-privacy.sh` to verify
4. Blocks the commit if anything fails

Claude Code also runs the scrub automatically via `.claude/settings.json`.

## CI

The GitHub Actions workflow `.github/workflows/pdf-privacy-check.yml` runs on every push or pull request that touches a PDF. It installs `exiftool` and `poppler-utils` and runs the generic check.

To extend CI with private forbidden terms, add a repository secret named:

```
PDF_PRIVACY_FORBIDDEN_TERMS
```

Set the value to a newline-separated list of private terms. The workflow writes this to `.privacy-forbidden.local` temporarily during the run and does not print the contents.

## Allowed public identifiers

These are safe to appear anywhere in committed files:

- `Matt EarthStar`
- `Vibration of Awesome`
- `EarthStar Rising`
- `vibrationofawesome.com`
- `Matty BoomBoom` (where contextually correct)
