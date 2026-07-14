#!/usr/bin/env node
import { classify } from "./vercel-ignore-build.js";

const cases = [
  ["blog post publishes", ["static/blog/boom/posts/new-post.html", "static/_data/boom-posts.json", "static/sitemap.xml"], "main", true],
  ["hub page changes", ["static/hubs/ai-creator-workflows/index.html"], "main", true],
  ["tool page changes", ["static/tools/digital-attention-audit/index.html"], "main", true],
  ["dashboard code changes", ["static/dashboard/index.html"], "main", true],
  ["API changes", ["api/analytics.js"], "main", true],
  ["content index changes", ["static/_data/boom-posts.json"], "main", true],
  ["authority metadata changes", ["static/_data/authority-assets.json"], "main", true],
  ["backlink bookkeeping only", ["static/_data/syndication-results.json", "static/_data/syndication-log.json"], "main", false],
  ["backlink dashboard snapshots only", ["static/_data/syndication-backlog-status.json", "static/_data/seo-strategy.json"], "main", false],
  ["health snapshot only", ["static/_data/syndication-health.json"], "main", false],
  ["deployment health only", ["static/_data/deployment-health.json"], "main", false],
  ["tool syndication state only", ["static/_data/experience-syndication.json", "data/ops/experience-companion-cache.json"], "main", false],
  ["watchdog log only", ["scripts/syndication_log.txt"], "main", false],
  ["watchdog heal state only", ["static/_data/heal-log.json", "scripts/.last-autoheal-timestamp"], "main", false],
  ["workflow only", [".github/workflows/voa-watchdog.yml"], "main", false],
  ["empty merge commit", [], "main", false],
  ["mixed public plus bookkeeping", ["static/blog/boom/posts/new-post.html", "static/_data/syndication-results.json"], "main", true],
  ["mailer ignores blog", ["static/blog/boom/posts/new-post.html"], "mailer", false],
  ["mailer ignores VOA static data", ["static/_data/syndication-results.json"], "mailer", false],
  ["mailer deploys API", ["api/capture-email.js"], "mailer", true],
];

let failed = 0;
for (const [name, files, project, expected] of cases) {
  const result = classify(files, project);
  const ok = result.deploy === expected;
  console.log(`${ok ? "ok" : "FAIL"} ${name}: deploy=${result.deploy} project=${project} :: ${result.reason}`);
  if (!ok) failed++;
}

process.exit(failed ? 1 : 0);
