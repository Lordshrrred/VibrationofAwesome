#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const MAILER_PROJECT_ID = "prj_aQxIEPRXWrrXZt9HFjGnMXuznjDl";
const MAIN_PROJECT_ID = "prj_guDrrflKSY3FwVbmFMNyQRZyTwI9";

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : "";
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function runGit(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function changedFilesFromArgs() {
  const filesArg = argValue("--files");
  if (!filesArg) return null;
  return filesArg.split(",").map(s => s.trim()).filter(Boolean);
}

function changedFilesFromGit() {
  const from = argValue("--from") || process.env.VERCEL_GIT_PREVIOUS_SHA || "";
  const to = argValue("--to") || process.env.VERCEL_GIT_COMMIT_SHA || "HEAD";

  if (from && !/^0+$/.test(from)) {
    let out = "";
    try {
      out = runGit(["diff", "--name-only", `${from}...${to}`]);
    } catch (_) {
      try {
        runGit(["fetch", "--depth=100", "origin", "main"]);
        out = runGit(["diff", "--name-only", `${from}...${to}`]);
      } catch (_) {
        out = "";
      }
    }
    if (!out) {
      out = runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", to]);
    }
    return out ? out.split("\n").filter(Boolean) : [];
  }

  try {
    const out = runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", to]);
    return out ? out.split("\n").filter(Boolean) : [];
  } catch (_) {
    return null;
  }
}

function normalize(file) {
  return String(file || "").replace(/^\.\/+/, "").replace(/\\/g, "/");
}

function matchesAny(file, patterns) {
  return patterns.some(pattern => {
    if (pattern.endsWith("/**")) return file.startsWith(pattern.slice(0, -3));
    if (pattern.endsWith("/")) return file.startsWith(pattern);
    if (pattern.includes("*")) {
      const re = new RegExp(`^${pattern.split("*").map(s => s.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")).join(".*")}$`);
      return re.test(file);
    }
    return file === pattern || file.startsWith(`${pattern}/`);
  });
}

const ALWAYS_DEPLOY = [
  "api/",
  "archetypes/",
  "assets/",
  "content/",
  "layouts/",
  "static/",
  "hugo.toml",
  "config.toml",
  "config.yaml",
  "config.yml",
  "vercel.json",
  ".vercelignore",
  "package.json",
  "package-lock.json",
  "scripts/build-blog-index.js",
  "scripts/check-authority-links.js",
  "scripts/generate-authority-engine.js",
  "scripts/generate-legacy-redirects.js",
  "scripts/inject-ai-engine-nudge.js",
  "scripts/internal-linking.js",
  "scripts/lib/internal-linking.js",
  "scripts/lib/orchestration-export.js",
  "scripts/optimize-hero-images.js",
  "scripts/set-page-social-image.js",
  "scripts/update-sitemap.js",
  "scripts/vercel-ignore-build.js",
];

const OPS_ONLY = [
  ".github/",
  ".claude/",
  ".cache/",
  "CLAUDE.md",
  "README.md",
  "HANDOFF.md",
  "MEMORY.md",
  "docs/",
  "reports/",
  "data/ops/",
  "scripts/syndication_log.txt",
  "scripts/.last-autoheal-timestamp",
];

const MAILER_DEPLOY = [
  "api/",
  "vercel.json",
  ".vercelignore",
  "package.json",
  "package-lock.json",
  "scripts/vercel-ignore-build.js",
];

function projectKind() {
  const explicit = argValue("--project");
  if (explicit) return explicit;
  const envName = process.env.VERCEL_PROJECT_NAME || "";
  const envId = process.env.VERCEL_PROJECT_ID || "";
  if (envId === MAILER_PROJECT_ID || envName === "vibrationofawesome-mailer") return "mailer";
  if (envId === MAIN_PROJECT_ID || envName === "vibrationofawesome") return "main";
  return "main";
}

function classify(files, project = projectKind()) {
  const normalized = files.map(normalize).filter(Boolean);
  if (!normalized.length) {
    return { deploy: true, project, reason: "No changed files detected; deploying fail-safe.", files: normalized };
  }

  const deployPatterns = project === "mailer" ? MAILER_DEPLOY : ALWAYS_DEPLOY;
  const deployFiles = normalized.filter(file => matchesAny(file, deployPatterns));
  if (deployFiles.length) {
    return {
      deploy: true,
      project,
      reason: `${project === "mailer" ? "Mailer/API" : "Public site"} impact detected: ${deployFiles.slice(0, 8).join(", ")}${deployFiles.length > 8 ? "..." : ""}`,
      files: normalized,
      deployFiles,
    };
  }

  if (project === "mailer") {
    return {
      deploy: false,
      project,
      reason: "No mailer/API impact detected; Vercel mailer build can be skipped.",
      files: normalized,
    };
  }

  const unknownFiles = normalized.filter(file => !matchesAny(file, OPS_ONLY));
  if (unknownFiles.length) {
    return {
      deploy: true,
      project,
      reason: `Unclassified files changed; deploying fail-safe: ${unknownFiles.slice(0, 8).join(", ")}${unknownFiles.length > 8 ? "..." : ""}`,
      files: normalized,
      deployFiles: unknownFiles,
    };
  }

  return {
    deploy: false,
    project,
    reason: `Only operational/reporting files changed for ${project}; Vercel build can be skipped.`,
    files: normalized,
  };
}

function main() {
  let files = changedFilesFromArgs();
  if (!files) {
    try {
      files = changedFilesFromGit();
    } catch (err) {
      console.log(`[vercel-ignore] Unable to inspect git changes: ${err.message}`);
      console.log("[vercel-ignore] Deploying fail-safe.");
      process.exit(1);
    }
  }

  const result = classify(files || []);
  if (hasFlag("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`[vercel-ignore] project=${result.project}`);
    console.log(`[vercel-ignore] changed=${result.files.length}`);
    console.log(`[vercel-ignore] ${result.reason}`);
  }

  if (hasFlag("--check-only") || hasFlag("--json")) return;
  process.exit(result.deploy ? 1 : 0);
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(SCRIPT_FILE)) {
  main();
}

export { classify };
