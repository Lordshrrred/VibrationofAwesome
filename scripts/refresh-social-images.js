#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const BASE = "https://vibrationofawesome.com";

const TARGETS = [
  "static/blog/boom/posts",
  "static/blog/boom/drafts",
  "static/blog/matt/posts",
];

const EXCLUDED_IMAGE_PATTERNS = [
  /StarLogo\.png/i,
  /field-guide-cover\.png/i,
  /photo-rotator/i,
  /ebook-cta/i,
  /signature/i,
  /^data:/i,
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

function toAbsoluteUrl(rawUrl) {
  if (!rawUrl) return null;
  rawUrl = rawUrl.trim();
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith("/")) return `${BASE}${rawUrl}`;
  return null;
}

function isAllowedImage(rawUrl) {
  if (!rawUrl) return false;
  const url = rawUrl.trim();
  return !EXCLUDED_IMAGE_PATTERNS.some((pattern) => pattern.test(url));
}

function getArticleBody(html) {
  const match = html.match(
    /<(article|div)\s+class="post-body"[^>]*>([\s\S]*?)(?:<div class="voa-photo-rotator"|<div data-ebook-cta|<div class="voa-ebook-cta"|<\/article>|<\/div>\s*<div class="post-footer")/i
  );
  return match ? match[2] : html;
}

function findFirstMatchingImage(fragment, extensionPattern = null) {
  const imageRegex = /<img[^>]+src="([^"]+)"/gi;
  let match;
  while ((match = imageRegex.exec(fragment)) !== null) {
    const candidate = match[1].trim();
    if (!isAllowedImage(candidate)) continue;
    if (extensionPattern && !extensionPattern.test(candidate)) continue;
    return candidate;
  }
  return null;
}

function getBestImage(html) {
  const preloadMatch = html.match(/<link[^>]+rel="preload"[^>]+as="image"[^>]+href="([^"]+)"/i);
  if (preloadMatch && isAllowedImage(preloadMatch[1])) return preloadMatch[1];

  const heroMatch = html.match(/background:[^;]*url\(['"]?([^)'"\s]+)['"]?\)\s+center\/cover\s+no-repeat/i);
  if (heroMatch && isAllowedImage(heroMatch[1])) return heroMatch[1];

  const articleBody = getArticleBody(html);
  const svgImage = findFirstMatchingImage(articleBody, /\.svg(?:$|\?)/i);
  if (svgImage) return svgImage;

  const contentImage = findFirstMatchingImage(articleBody);
  if (contentImage) return contentImage;

  return null;
}

function getDimensions(absoluteUrl) {
  if (!absoluteUrl.startsWith(BASE)) return null;

  const relativePath = absoluteUrl.slice(BASE.length);
  const localPath = path.join(ROOT, "static", relativePath.replace(/^\//, ""));
  if (!fs.existsSync(localPath)) return null;

  const result = spawnSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", localPath], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;

  const width = result.stdout.match(/pixelWidth:\s+(\d+)/);
  const height = result.stdout.match(/pixelHeight:\s+(\d+)/);
  if (!width || !height) return null;

  return { width: width[1], height: height[1] };
}

function replaceMeta(html, imageUrl, dimensions) {
  let next = html
    .replace(/(<meta property="og:image" content=")[^"]*(")/i, `$1${imageUrl}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/i, `$1${imageUrl}$2`)
    .replace(/("image":")[^"]*(")/i, `$1${imageUrl}$2`);

  if (dimensions) {
    next = next
      .replace(/(<meta property="og:image:width" content=")\d+(")/i, `$1${dimensions.width}$2`)
      .replace(/(<meta property="og:image:height" content=")\d+(")/i, `$1${dimensions.height}$2`);
  }

  return next;
}

let updatedCount = 0;
for (const target of TARGETS) {
  const files = walk(path.join(ROOT, target));
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    const bestImage = toAbsoluteUrl(getBestImage(html));
    if (!bestImage || bestImage === `${BASE}/images/StarLogo.png`) continue;

    const next = replaceMeta(html, bestImage, getDimensions(bestImage));
    if (next !== html) {
      fs.writeFileSync(file, next, "utf8");
      updatedCount += 1;
      console.log(`updated ${path.relative(ROOT, file)} -> ${bestImage}`);
    }
  }
}

console.log(`updated ${updatedCount} files`);
