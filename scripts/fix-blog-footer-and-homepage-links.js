#!/usr/bin/env node
/**
 * Blog-wide presentation cleanup:
 * - Keep footer meta lines centered across hand-built and generated blog HTML.
 * - Remove homepage-only vibrationofawesome.com links from article copy while
 *   preserving actual CTA links such as Field Guide and AI Engine.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BLOG_DIR = path.join(ROOT, "static", "blog");

const FOOTER_FIX = [
  "",
  "/* Blog footer alignment repair */",
  "footer, .site-footer { text-align: center; width: 100%; }",
  "footer .footer-meta, .site-footer .footer-meta { display: block; width: 100%; margin-left: auto; margin-right: auto; text-align: center; }",
  "footer .footer-brand, .site-footer .footer-brand { margin-left: auto; margin-right: auto; text-align: center; }",
].join("\n");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function addFooterFix(html) {
  if (html.includes("Blog footer alignment repair")) return html;
  return html.replace("</style>", `${FOOTER_FIX}\n</style>`);
}

function cleanHomepageLinks(html) {
  const footerIndex = html.search(/<footer\b/i);
  const head = footerIndex >= 0 ? html.slice(0, footerIndex) : html;
  const tail = footerIndex >= 0 ? html.slice(footerIndex) : "";

  let cleaned = head;
  cleaned = cleaned.replace(/<a href="https:\/\/vibrationofawesome\.com\/?">vibrationofawesome\.com<\/a>/gi, "Vibration of Awesome");
  cleaned = cleaned.replace(/<a href="\/">vibrationofawesome\.com<\/a>/gi, "Vibration of Awesome");
  cleaned = cleaned.replace(/<strong>vibrationofawesome\.com<\/strong>/gi, "Vibration of Awesome");
  cleaned = cleaned.replace(/\bover at vibrationofawesome\.com\b/gi, "inside the Vibration of Awesome archive");
  cleaned = cleaned.replace(/\bat vibrationofawesome\.com\b/gi, "inside Vibration of Awesome");
  cleaned = cleaned.replace(/\bvibrationofawesome\.com has\b/gi, "Vibration of Awesome has");

  return cleaned + tail;
}

let changed = 0;
for (const file of walk(BLOG_DIR)) {
  const before = fs.readFileSync(file, "utf8");
  const after = cleanHomepageLinks(addFooterFix(before));
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    changed++;
    console.log(path.relative(ROOT, file));
  }
}

console.log(`\nBlog footer/link cleanup complete: ${changed} files changed.`);
