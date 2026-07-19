#!/usr/bin/env node
/**
 * generate-legacy-redirects.js
 *
 * Creates compatibility redirects for:
 * - archive Matt posts that now live at directory URLs but are still linked as .html
 *   (handled via a vercel.json redirect rule, NOT a physical `{slug}.html` file --
 *   a physical file at that path shadows `{slug}/index.html` under Vercel's cleanUrls
 *   routing, which silently served the redirect stub instead of the real article at
 *   the canonical URL for all 16 archive posts. Discovered via GSC "Excluded by
 *   noindex tag" / "Discovered - currently not indexed" reports 2026-07-18.)
 * - historical root-level archive canonicals from the original site
 * - the old /free-ebook/ CTA path that now lives at /field-guide/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const STATIC_ROOT = path.join(ROOT, "static");
const SITE_ORIGIN = "https://vibrationofawesome.com";
const MATT_POSTS_FILE = path.join(STATIC_ROOT, "_data", "matt-posts.json");
const VERCEL_JSON_FILE = path.join(ROOT, "vercel.json");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeRedirect(filePath, targetPath, title) {
  const destination = targetPath.startsWith("http")
    ? targetPath
    : `${SITE_ORIGIN}${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`;
  const html = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    `  <title>${title}</title>`,
    `  <link rel="canonical" href="${destination}">`,
    '  <meta name="robots" content="noindex, follow">',
    '  <meta http-equiv="refresh" content="0; url=' + destination + '">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    "</head>",
    "<body>",
    `  <p>Redirecting to <a href="${destination}">${destination}</a>...</p>`,
    `  <script>window.location.replace(${JSON.stringify(destination)});</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
  ensureDir(filePath);
  fs.writeFileSync(filePath, html, "utf8");
}

function parseArchiveCanonical(slug) {
  const archiveFile = path.join(STATIC_ROOT, "blog", "matt", "posts", slug, "index.html");
  if (!fs.existsSync(archiveFile)) return null;
  const html = fs.readFileSync(archiveFile, "utf8");
  const match = html.match(/<link rel="canonical" href="([^"]+)"/i);
  if (!match) return null;
  try {
    const url = new URL(match[1]);
    return url.pathname;
  } catch {
    return null;
  }
}

function normalizePath(p) {
  return p.replace(/\/+$/, "/") || "/";
}

function upsertVercelRedirects(newRedirects) {
  if (!newRedirects.length) return 0;
  const config = JSON.parse(fs.readFileSync(VERCEL_JSON_FILE, "utf8"));
  config.redirects = config.redirects || [];
  const existingSources = new Set(config.redirects.map((r) => r.source));
  let added = 0;
  for (const r of newRedirects) {
    if (existingSources.has(r.source)) continue;
    config.redirects.push(r);
    existingSources.add(r.source);
    added += 1;
  }
  if (added > 0) {
    fs.writeFileSync(VERCEL_JSON_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
  }
  return added;
}

function main() {
  const mattPosts = JSON.parse(fs.readFileSync(MATT_POSTS_FILE, "utf8"));
  let written = 0;
  const vercelRedirects = [];

  for (const post of mattPosts) {
    if (!post?.slug || !post?.url) continue;

    if (post.url.endsWith(".html")) {
      const slashVariant = post.url.replace(/\.html$/, "/");
      const slashFile = path.join(STATIC_ROOT, slashVariant.replace(/^\/+/, ""), "index.html");
      writeRedirect(slashFile, post.url, `${post.title} | Redirect`);
      written += 1;
    }

    if (!post.isArchive) continue;

    // Old .html-style links to archive posts now redirect via vercel.json instead of a
    // physical `{slug}.html` file, which would shadow the real `{slug}/index.html` content
    // under Vercel's cleanUrls routing (see file header note).
    vercelRedirects.push({
      source: `/blog/matt/posts/${post.slug}.html`,
      destination: post.url,
      permanent: true,
    });

    const legacyPath = parseArchiveCanonical(post.slug);
    if (legacyPath && legacyPath !== "/" && normalizePath(legacyPath) !== normalizePath(post.url)) {
      const legacyFile = path.join(STATIC_ROOT, legacyPath.replace(/^\/+/, ""), "index.html");
      writeRedirect(legacyFile, post.url, `${post.title} | Redirect`);
      written += 1;
    }
  }

  writeRedirect(
    path.join(STATIC_ROOT, "free-ebook", "index.html"),
    "/field-guide/",
    "Free Ebook | Redirect"
  );
  written += 1;

  const addedRedirects = upsertVercelRedirects(vercelRedirects);

  console.log(`Generated ${written} legacy redirect files, added ${addedRedirects} vercel.json redirects.`);
}

main();
