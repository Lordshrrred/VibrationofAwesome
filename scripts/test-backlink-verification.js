import test from "node:test";
import assert from "node:assert/strict";
import { inspectBacklink } from "../api/_backlink-verification.js";
import { selectChecks, recordCheck, verifyExisting } from "./verify-backlinks.js";
import { buildSyndicationBacklogStatus } from "./lib/syndication-backlog.js";

const source = "https://vibrationofawesome.com/blog/boom/posts/a-useful-guide";
const link = `<a href="${source}.html?utm_source=test#read">read the guide</a>`;

test("untracked live posts remain visible without creating blind repost tasks; saved slot profiles are honored", () => {
  const results = [{ slug: "tracked", lane: "boom", syndication: { blogger: { status: "success" }, wordpress_earthstar: { status: "success" }, tumblr_voa: { status: "success" } } }];
  const status = buildSyndicationBacklogStatus(results, { redirects: {}, livePosts: [{ slug: "tracked", lane: "boom" }, { slug: "untracked", lane: "boom" }], publishedHistory: [{ slug: "tracked", syndication_profile: "backlinks-only" }] });
  assert.equal(status.summary.untrackedLivePosts, 1);
  assert.equal(status.untrackedPosts[0].slug, "untracked");
  assert.equal(status.summary.feederMissingUnits, 0);
  assert.equal(status.prioritizedBacklog.length, 0);
});

test("article links count; navigation, metadata, plain text and sibling paths do not", () => {
  assert.equal(inspectBacklink(`<nav>${link}</nav><article><p>Useful text</p></article>`, source).verified, false);
  assert.equal(inspectBacklink(`<article><header>${link}</header>Useful text</article>`, source).verified, false);
  assert.equal(inspectBacklink(`<div class='post-body entry-content'><div>Nested body ${link}</div></div>`, source).verified, true);
  assert.equal(inspectBacklink(`<article>${source}</article>`, source).verified, false);
  assert.equal(inspectBacklink(`<article>${link.replace("a-useful-guide.html", "a-useful-guide-2.html")}</article>`, source).verified, false);
});

test("blocked requests and unrecognized themes are unknown; gone articles are missing", () => {
  for (const status of [401, 403, 429, 500, 503]) assert.equal(inspectBacklink("blocked", source, status).verified, null);
  for (const status of [404, 410]) assert.equal(inspectBacklink("gone", source, status).verified, false);
  assert.equal(inspectBacklink(link, source).verified, null);
});

test("verification is bounded, excludes retired sources and respects recheck cooldowns", () => {
  const now = Date.parse("2026-10-19T00:00:00Z");
  const rows = Array.from({ length: 50 }, (_, i) => ({ slug: `guide-${i}`, syndication: { blogger: { status: "success" } } }));
  rows[2].syndication.blogger = { status: "success", backlink_checked_at: new Date(now - 60000).toISOString() };
  rows[3].syndication.blogger = { status: "success", backlink_confirmed: true, backlink_checked_at: new Date(now - 2 * 86400000).toISOString() };
  const selected = selectChecks(rows, { now, batch: 30, redirects: { "guide-1": "guide-0" } });
  assert.equal(selected.length, 30);
  assert.ok(selected.every(check => !["guide-1", "guide-2", "guide-3"].includes(check.row.slug)));
});

test("unknown verification never changes successful distribution into a repost task", () => {
  const next = recordCheck({ status: "success", url: "https://example.com/post", backfill_attempted_at: "saved" }, { verified: null, reason: "http_403" });
  assert.equal(next.status, "success");
  assert.equal(next.backlink_status, "unknown");
  assert.equal(next.backfill_attempted_at, "saved");
});

test("WordPress verification reads the published article body only", async () => {
  const original = global.fetch;
  global.fetch = async () => ({ status: 200, json: async () => ({ status: "publish", content: "<p>A post without the source link.</p>", sidebar: link }) });
  try {
    const checked = await verifyExisting({ key: "wordpress_earthstar", row: { voa_url: source }, platform: { url: "https://earthstarrisingsun.wordpress.com/2026/10/18/companion/" } });
    assert.equal(checked.verified, false);
    assert.equal(checked.method, "published_article_api");
  } finally { global.fetch = original; }
});
