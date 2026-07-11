#!/usr/bin/env node
/**
 * Import curated VOA expansion ideas into static/_data/topic-queue.json.
 * Accepts TXT, CSV, or JSON. No model/API calls.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import minimist from "minimist";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "static/_data/topic-queue.json");

const argv = minimist(process.argv.slice(2), {
  string: ["file", "niche", "topic"],
  boolean: ["dry-run"],
});

if (!argv.file) {
  console.error("Usage: node scripts/import-curated-keywords.js --file curated.txt [--niche ai-creator-tools] [--topic 'New tool cluster']");
  process.exit(1);
}

function normalizeKeyword(text) {
  return String(text || "").replace(/^\[\d+\]\s*/, "").replace(/\s+/g, " ").trim();
}

function titleFromKeyword(keyword) {
  return keyword.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function readRows(file) {
  const ext = path.extname(file).toLowerCase();
  const text = fs.readFileSync(file, "utf8");
  if (ext === ".json") {
    const data = JSON.parse(text);
    const rows = Array.isArray(data) ? data : data.keywords || [];
    return rows.map(item => typeof item === "string" ? { keyword: item } : item);
  }
  if (ext === ".csv") {
    const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const cols = header.split(",").map(s => s.trim());
    return lines.map(line => {
      const vals = line.split(",");
      const row = {};
      cols.forEach((col, i) => row[col] = vals[i]);
      return row;
    });
  }
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(keyword => ({ keyword }));
}

const rows = readRows(path.resolve(ROOT, argv.file))
  .map(row => ({
    keyword: normalizeKeyword(row.keyword || row.query || row.title),
    search_intent: row.search_intent || "curated_expansion",
    suggested_title: row.suggested_title || row.title || titleFromKeyword(normalizeKeyword(row.keyword || row.query || row.title)),
    opportunity: row.opportunity || "Curated strategic expansion candidate.",
    h2_outline: Array.isArray(row.h2_outline) ? row.h2_outline : [],
  }))
  .filter(row => row.keyword);

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
const seen = new Set();
for (const item of existing) {
  for (const group of Object.values(item.keywords || {})) {
    if (Array.isArray(group)) group.forEach(row => seen.add(normalizeKeyword(row.keyword).toLowerCase()));
  }
}
const unique = rows.filter(row => !seen.has(row.keyword.toLowerCase()));

console.log(`Curated VOA keywords read: ${rows.length}`);
console.log(`New unique keywords: ${unique.length}`);
if (argv["dry-run"]) {
  unique.slice(0, 25).forEach(row => console.log(`- ${row.keyword}`));
  process.exit(0);
}

existing.push({
  date: new Date().toISOString().slice(0, 10),
  topic: argv.topic || "Curated strategic expansion",
  niche: argv.niche,
  keywords: {
    curated_expansion: unique,
  },
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(existing, null, 2), "utf8");
console.log(`Appended curated expansion to ${path.relative(ROOT, OUT)}`);
