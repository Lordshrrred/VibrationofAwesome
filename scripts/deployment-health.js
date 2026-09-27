#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { classify } from "./vercel-ignore-build.js";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_FILE = path.join(ROOT, "static", "_data", "deployment-health.json");

function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    }).trim();
  } catch (err) {
    return "";
  }
}

function gitSha(ref) {
  return run("git", ["rev-parse", ref]);
}

// Preferred: every deploy stamps its commit into /build-info.json
// (scripts/write-build-info.js), so no Vercel credentials are needed.
async function fetchBuildInfo(target) {
  try {
    const resp = await fetch(`https://${target}/build-info.json?t=${Date.now()}`, {
      signal: AbortSignal.timeout(15000),
      headers: { "cache-control": "no-cache" },
    });
    if (!resp.ok) return null;
    const info = await resp.json();
    if (!info?.commit) return null;
    return {
      target,
      status: "ready",
      commit: info.commit,
      builtAt: info.builtAt || null,
      url: `https://${target}`,
      checkedAt: new Date().toISOString(),
      source: "build-info",
    };
  } catch {
    return null;
  }
}

// A deployment is current when it serves origin/main, or when every commit
// since the deployed one is something Vercel intentionally skips (ops data,
// docs, reports). Uses the same classifier as vercel-ignore-build.js.
function deploymentFreshness(deployedSha, originSha, project) {
  if (!deployedSha || !originSha) return { current: false, reason: "Deployed commit unknown." };
  if (originSha.startsWith(deployedSha) || deployedSha.startsWith(originSha)) return { current: true, reason: "Serving origin/main." };
  const diff = run("git", ["diff", "--name-only", deployedSha, originSha]);
  if (!diff && !run("git", ["cat-file", "-t", deployedSha])) {
    return { current: false, reason: "Deployed commit not in local history." };
  }
  const result = classify(diff.split("\n").filter(Boolean), project);
  return result.deploy
    ? { current: false, reason: `Behind: ${result.reason}` }
    : { current: true, reason: "Only non-deploying changes since this deploy." };
}

function inspectDeployment(target) {
  const result = spawnSync("vercel", ["inspect", target, "--logs"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120000,
  });
  const text = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  if (!text) {
    return {
      target,
      status: "unknown",
      commit: null,
      url: target.startsWith("http") ? target : `https://${target}`,
      checkedAt: new Date().toISOString(),
      note: "Vercel inspect unavailable in this environment.",
    };
  }

  const commit = text.match(/Commit:\s*([0-9a-f]{7,40})/i)?.[1] ||
    text.match(/Commit:\s*([0-9a-f]{7,40})\)/i)?.[1] ||
    text.match(/Branch:\s*main,\s*Commit:\s*([0-9a-f]{7,40})/i)?.[1] ||
    null;
  const status = /Ready/i.test(text) ? "ready" : (/Error|Failed/i.test(text) ? "error" : "unknown");
  const url = text.match(/https:\/\/[^\s]+/i)?.[0] || `https://${target}`;

  return {
    target,
    status,
    commit,
    url,
    checkedAt: new Date().toISOString(),
  };
}

function short(sha) {
  return sha ? sha.slice(0, 7) : null;
}

async function main() {
  const head = gitSha("HEAD");
  const origin = gitSha("origin/main") || head;
  const main = (await fetchBuildInfo("vibrationofawesome.com")) || inspectDeployment("vibrationofawesome.com");
  const mailer = (await fetchBuildInfo("vibrationofawesome-mailer.vercel.app")) || inspectDeployment("vibrationofawesome-mailer.vercel.app");
  const mainFresh = deploymentFreshness(main.commit, origin, "main");
  const mailerFresh = deploymentFreshness(mailer.commit, origin, "mailer");

  const data = {
    generatedAt: new Date().toISOString(),
    repo: {
      branch: run("git", ["branch", "--show-current"]) || "main",
      head,
      headShort: short(head),
      originMain: origin,
      originMainShort: short(origin),
    },
    deployments: {
      main: {
        ...main,
        commitShort: short(main.commit),
        currentWithOrigin: mainFresh.current,
        freshness: mainFresh.reason,
      },
      mailer: {
        ...mailer,
        commitShort: short(mailer.commit),
        currentWithOrigin: mailerFresh.current,
        freshness: mailerFresh.reason,
      },
    },
    policy: {
      ignoredBuilds: true,
      mainDeploysOn: "public site, content indexes, Hugo/layout, API, package, and Vercel config changes",
      mailerDeploysOn: "API, package, and Vercel config changes",
      operationsSkipped: "reports, workflow-only updates, data/ops, docs, syndication_log.txt, empty merge commits, and volatile dashboard/status JSON",
      dashboardFreshData: "operator dashboards fetch latest volatile JSON from origin/main raw GitHub with deployed JSON fallback",
    },
  };

  if (process.argv.includes("--write")) {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`Wrote ${path.relative(ROOT, OUT_FILE)}`);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See AGENTS.md (CLI guard) ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch((err) => {
    console.error(`deployment-health: ${err.message}`);
    process.exit(1);
  });
}
export { deploymentFreshness };
