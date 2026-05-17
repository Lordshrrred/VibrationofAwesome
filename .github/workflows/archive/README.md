# .github/workflows/archive/

Disabled or superseded GitHub Actions workflows kept for reference.

| File | What it did | Why archived |
|---|---|---|
| `deploy.yml` | Deployed site to Netlify via Actions | Netlify is no longer in the stack. GitHub Pages hosts the static site (via `hugo.yml`). Vercel hosts `/api/*` functions (auto-deploy via Vercel dashboard). |
