#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const TARGETS = [
  "README.md",
  "CLAUDE.md",
  ".github",
  "layouts",
  "netlify",
  "scripts",
  "static",
];

const TEXT_EXTENSIONS = new Set([
  ".csv",
  ".html",
  ".js",
  ".json",
  ".md",
  ".py",
  ".toml",
  ".txt",
  ".yaml",
  ".yml",
]);

const offenders = [];
const EM_DASH = String.fromCharCode(0x2014);

function walk(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      if (entry === "node_modules" || entry === "public" || entry === "resources" || entry === ".git") {
        continue;
      }
      walk(path.join(targetPath, entry));
    }
    return;
  }

  if (!TEXT_EXTENSIONS.has(path.extname(targetPath))) return;

  const text = fs.readFileSync(targetPath, "utf8");
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    if (line.includes(EM_DASH)) {
      offenders.push({
        file: path.relative(ROOT, targetPath),
        line: index + 1,
        excerpt: line.trim().slice(0, 140),
      });
    }
  });
}

for (const target of TARGETS) {
  const targetPath = path.join(ROOT, target);
  if (fs.existsSync(targetPath)) walk(targetPath);
}

if (offenders.length) {
  console.error("Em dash check failed.");
  console.error("We don't take kindly to em dashes around here. Use ~ instead.\n");
  offenders.slice(0, 50).forEach(({ file, line, excerpt }) => {
    console.error(`- ${file}:${line} ${excerpt}`);
  });
  if (offenders.length > 50) {
    console.error(`...and ${offenders.length - 50} more.`);
  }
  process.exit(1);
}

console.log("No em dashes found. Signal stays clean.");
