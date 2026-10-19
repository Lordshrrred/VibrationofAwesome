#!/usr/bin/env node
// Read existing companion articles. Never generate, publish or retry a post.
import dotenv from "dotenv";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import minimist from "minimist";
import { inspectBacklink } from "../api/_backlink-verification.js";

dotenv.config({ quiet: true });
const RESULTS = new URL("../static/_data/syndication-results.json", import.meta.url);
const REDIRECTS = new URL("../static/_data/article-redirects.json", import.meta.url);
const PLATFORMS = ["blogger", "wordpress_earthstar", "tumblr_voa"];

export function selectChecks(results, { redirects = {}, batch = 30, now = Date.now(), slugs = null, platforms = PLATFORMS } = {}) {
  return results.filter(row => !redirects[row.slug] && (!slugs || slugs.has(row.slug)))
    .flatMap(row => platforms.map(key => ({ row, key, platform: row.syndication?.[key] })))
    .filter(({ platform }) => {
      if (platform?.status !== "success") return false;
      const age = now - Date.parse(platform.backlink_checked_at || "");
      return !Number.isFinite(age) || age >= (platform.backlink_confirmed === true ? 7 : 1) * 86400_000;
    })
    .sort((a, b) => Number(a.platform.backlink_confirmed === true) - Number(b.platform.backlink_confirmed === true)
      || (Date.parse(a.platform.backlink_checked_at) || 0) - (Date.parse(b.platform.backlink_checked_at) || 0))
    .slice(0, batch);
}

async function fetchPublic(url, json = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: "follow",
    headers: { "User-Agent": "VOA-Backlink-Checker/1.0 (+https://vibrationofawesome.com)" } });
  return { status: response.status, data: json ? await response.json().catch(() => null) : await response.text() };
}

export async function verifyExisting({ row, key, platform }) {
  if (!platform.url || !row.voa_url) return { verified: null, reason: "no_public_url" };
  try {
    const url = new URL(platform.url);
    if (key === "wordpress_earthstar" && url.hostname.endsWith(".wordpress.com")) {
      const slug = url.pathname.split("/").filter(Boolean).at(-1);
      if (!/^\/\d{4}\/\d{2}\/\d{2}\//.test(url.pathname)) return { verified: null, reason: "not_an_article_url" };
      const response = await fetchPublic(`https://public-api.wordpress.com/rest/v1.1/sites/${url.hostname}/posts/slug:${encodeURIComponent(slug)}?fields=content,URL,status`, true);
      // Only the published article's content counts; menus and sidebar links do not.
      if (response.status === 200 && response.data?.status === "publish" && typeof response.data.content === "string") {
        return { ...inspectBacklink(`<article>${response.data.content}</article>`, row.voa_url), method: "published_article_api" };
      }
      return { verified: null, reason: `wordpress_api_${response.status}` };
    }
    if (key === "tumblr_voa") {
      const id = url.pathname.match(/\/post\/(\d+)/)?.[1];
      const apiKey = process.env.VOA_TUMBLR_CONSUMER_KEY || process.env.TUMBLR_CONSUMER_KEY;
      if (id && apiKey && url.hostname.endsWith(".tumblr.com")) {
        const response = await fetchPublic(`https://api.tumblr.com/v2/blog/${url.hostname}/posts?id=${id}&api_key=${encodeURIComponent(apiKey)}`, true);
        const post = response.data?.response?.posts?.find(item => String(item.id_string || item.id) === id);
        if (post && typeof (post.body || post.caption) === "string") {
          return { ...inspectBacklink(`<article>${post.body || post.caption}</article>`, row.voa_url), method: "published_article_api" };
        }
        return { verified: null, reason: `tumblr_api_${response.data?.meta?.status || response.status}` };
      }
    }
    const response = await fetchPublic(url.href);
    return { ...inspectBacklink(response.data, row.voa_url, response.status), method: "article_body" };
  } catch (error) {
    // Fetch errors may contain credential-bearing API URLs. Store the type only.
    return { verified: null, reason: `request_${error.name || "failed"}` };
  }
}

export function recordCheck(platform, result, now = new Date().toISOString()) {
  const next = { ...platform, backlink_checked_at: now, backlink_confirmed: result.verified === true,
    backlink_status: result.verified === true ? "confirmed" : result.verified === false ? "missing" : "unknown",
    backlink_method: result.method || "article_body" };
  if (result.verified === true) {
    next.backlink_last_confirmed_at = now;
    delete next.backlink_error;
  } else next.backlink_error = result.reason;
  return next;
}

async function main() {
  const args = minimist(process.argv.slice(2), { boolean: ["execute"], string: ["slug", "batch", "platforms"] });
  const batch = Number(args.batch || 30);
  if (!Number.isSafeInteger(batch) || batch < 1 || batch > 100) throw new Error("Batch must be 1-100 platform checks");
  const platforms = args.platforms ? args.platforms.split(",") : PLATFORMS;
  if (platforms.some(key => !PLATFORMS.includes(key))) throw new Error("Only Blogger, WordPress and Tumblr companion verification is supported");
  const results = JSON.parse(fs.readFileSync(RESULTS, "utf8"));
  const checks = selectChecks(results, { batch, platforms, redirects: JSON.parse(fs.readFileSync(REDIRECTS, "utf8")),
    slugs: args.slug ? new Set(args.slug.split(",")) : null });
  console.log(`[verify] ${checks.length} existing platform articles; ${args.execute ? "read-only remote verification" : "preview only; add --execute"}. No generation or publishing.`);
  const totals = { confirmed: 0, missing: 0, unknown: 0 };
  for (let start = 0; start < checks.length; start += 3) {
    await Promise.all(checks.slice(start, start + 3).map(async check => {
      if (!args.execute) { console.log(`${check.row.slug} ${check.key}`); return; }
      const result = await verifyExisting(check);
      const next = recordCheck(check.platform, result);
      check.row.syndication[check.key] = next;
      totals[next.backlink_status]++;
      console.log(`${check.row.slug} ${check.key}: ${next.backlink_status} (${result.reason})`);
    }));
  }
  if (args.execute) {
    fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2));
    console.log(`[verify] ${JSON.stringify(totals)}; blocked or missing evidence never triggers a repost.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
