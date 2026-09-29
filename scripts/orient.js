#!/usr/bin/env node
/**
 * orient.js ~ one-screen startup briefing for a fresh Claude Code / Codex session.
 *
 * Prints live state from small, already-maintained files (never the 1MB JSONs),
 * the hand-written docs/handoff.md, and recent human (non-[automated]) commits.
 * Read-only apart from an optional `git fetch --deepen` on shallow clones.
 *
 * Usage: npm run orient            (Claude runs this on SessionStart)
 *        node scripts/orient.js --no-fetch
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "static", "_data");

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch {
    return null;
  }
}

function git(args) {
  try {
    return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20000 }).trim();
  } catch {
    return "";
  }
}

function humanCommits(limit) {
  return git(["log", "--invert-grep", "--grep=\\[automated\\]", "--no-merges", `-n${limit}`, "--format=%ad %s", "--date=short"]);
}

function recentHumanCommits(limit, allowFetch) {
  let out = humanCommits(limit);
  const shallow = git(["rev-parse", "--is-shallow-repository"]) === "true";
  if (allowFetch && shallow && out.split("\n").filter(Boolean).length < limit) {
    git(["fetch", "--quiet", "--deepen=400", "origin"]);
    out = humanCommits(limit);
  }
  return out || "(none found; history may be shallow ~ try: git fetch --deepen=400 origin)";
}

function age(iso) {
  if (!iso) return "unknown";
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5;
  return hours < 48 ? `${hours.toFixed(1)}h ago` : `${(hours / 24).toFixed(1)}d ago`;
}

function main() {
  const allowFetch = !process.argv.includes("--no-fetch");
  const lines = [];
  const say = (s = "") => lines.push(s);

  say("=== VOA ORIENTATION (npm run orient) ===");
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const dirty = git(["status", "--porcelain"]).split("\n").filter(Boolean).length;
  say(`Branch: ${branch || "?"} | uncommitted files: ${dirty} | BMO_CONTEXT.md: ${fs.existsSync(path.join(ROOT, "BMO_CONTEXT.md")) ? "present (read it)" : "absent (local-only; continue without it)"}`);

  const health = readJson("static/_data/syndication-health.json");
  if (health) {
    say(`Health: ${health.status} ${health.passed}/${health.total} checks passed (${age(health.lastChecked)})`);
    const failed = (health.checks || []).filter((c) => !c.ok);
    for (const c of failed.slice(0, 6)) say(`  FAILING: ${c.name} ~ ${String(c.detail || "").slice(0, 140)}`);
    if (health.topFix) say(`  Top fix: ${String(health.topFix).slice(0, 200)}`);
    if (health.drip) say(`Queue: ${health.drip.status}, ${health.drip.remaining} drafts remaining, ${health.drip.published} published`);
  }

  let draftSlugs = [];
  try {
    draftSlugs = fs.readdirSync(path.join(ROOT, "static/blog/boom/drafts")).filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5));
  } catch {}
  const queued = new Set((readJson("static/_data/drip-queue.json")?.queue || []).map((i) => i.slug));
  say(`Drafts: ${queued.size} queued, ${draftSlugs.length} files on disk (replenish triggers at <=14, targets 22)`);
  const orphans = draftSlugs.filter((s) => !queued.has(s));
  const missing = [...queued].filter((s) => !draftSlugs.includes(s));
  if (orphans.length) say(`  ORPHAN draft files (not in drip-queue.json, will never publish): ${orphans.slice(0, 5).join(", ")}`);
  if (missing.length) say(`  QUEUED without a draft file (will fail to publish): ${missing.slice(0, 5).join(", ")}`);

  const last = readJson("static/_data/drip-last-published.json");
  const lastItem = last?.items?.[last.items.length - 1];
  if (lastItem) say(`Last publish: "${lastItem.title}" [${lastItem.cluster || lastItem.niche}] ${age(lastItem.published_at)}`);

  const seo = readJson("static/_data/seo-intelligence.json");
  if (seo) say(`SEO intelligence: generated ${age(seo.generated_at || seo.generatedAt)} ~ details in reports/seo-intelligence-latest.md`);

  say();
  say("--- docs/handoff.md (in-progress work, open problems, next actions) ---");
  try {
    say(fs.readFileSync(path.join(ROOT, "docs/handoff.md"), "utf8").trim());
  } catch {
    say("(missing ~ create it at the end of your session)");
  }

  const lastHandoff = git(["log", "-1", "--format=%H", "--", "docs/handoff.md"]);
  if (lastHandoff) {
    const since = git(["log", `${lastHandoff}..HEAD`, "--invert-grep", "--grep=\\[automated\\]", "--no-merges", "--format=  %h %ad %s", "--date=short"]);
    if (since) {
      say();
      say("--- Human commits since docs/handoff.md was last updated (not reflected there yet) ---");
      say(since);
    }
  }

  say();
  say("--- Machine readiness ---");
  const envOk = fs.existsSync(path.join(ROOT, ".env"));
  say(`.env: ${envOk ? "present" : "MISSING (see docs/new-machine.md; cloud sessions have none, that is normal)"}`);
  say(`node_modules: ${fs.existsSync(path.join(ROOT, "node_modules")) ? "present" : "MISSING (run npm ci)"}`);

  say();
  say("--- Recent human decisions (non-[automated] commits) ---");
  say(recentHumanCommits(12, allowFetch));

  say();
  say("Next: read only the docs/modules/*.md for your task (index in AGENTS.md). Live GitHub issues may hold open alerts.");
  console.log(lines.join("\n"));
}

import { pathToFileURL as __voaPathToFileURL } from "node:url";
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  try {
    main();
  } catch (err) {
    // Never block session start.
    console.log(`orient: ${err.message}`);
  }
}
