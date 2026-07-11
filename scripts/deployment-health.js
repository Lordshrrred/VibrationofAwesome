#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

function main() {
  const head = gitSha("HEAD");
  const origin = gitSha("origin/main") || head;
  const main = inspectDeployment("vibrationofawesome.com");
  const mailer = inspectDeployment("vibrationofawesome-mailer.vercel.app");

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
        currentWithOrigin: !!(main.commit && origin && origin.startsWith(main.commit)),
      },
      mailer: {
        ...mailer,
        commitShort: short(mailer.commit),
        currentWithOrigin: !!(mailer.commit && origin && origin.startsWith(mailer.commit)),
      },
    },
    policy: {
      ignoredBuilds: true,
      mainDeploysOn: "public site, content, Hugo/layout, API, package, and Vercel config changes",
      mailerDeploysOn: "API, package, and Vercel config changes",
      operationsSkipped: "reports, workflow-only updates, data/ops, docs, and syndication_log.txt",
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

main();
