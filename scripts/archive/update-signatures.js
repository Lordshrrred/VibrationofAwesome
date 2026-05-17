// update-signatures.js
// Replaces all Matt EarthStar blog post signatures with the new standard signature.
// New signature:
//   Matt EarthStar
//   A creator in the unfolding.
//   Empower thyself. Empower the Earth.
//   vibrationofawesome.com

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(ROOT, "static", "blog", "matt", "posts");

const NEW_SIG = `<p>Matt EarthStar<br>\nA creator in the unfolding.<br>\nEmpower thyself. Empower the Earth.<br>\n<a href="/">vibrationofawesome.com</a></p>`;

function gatherHtmlFiles(dir) {
  const results = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".html")) results.push(full);
    }
  }
  walk(dir);
  return results;
}

function updateSignatures(html) {
  let out = html;
  let changed = false;

  // 1. Remove body-level closing: <p>Namaste</p> and/or <p>~Matt</p> and/or standalone <p>Matt EarthStar</p>
  //    These appear as the legacy in-article sign-off
  const bodyClosings = [
    /<p>\s*Namaste\s*<\/p>\s*\n?/gi,
    /<p>\s*~Matt\s*<\/p>\s*\n?/gi,
    // only standalone "Matt EarthStar" paragraphs (not inside <em> or links)
    /<p>\s*Matt EarthStar\s*<\/p>\s*\n?/g,
  ];
  for (const re of bodyClosings) {
    if (re.test(out)) {
      out = out.replace(re, "");
      changed = true;
    }
  }

  // 2. Replace all variations of the footer attribution line with the new signature
  const footerVariants = [
    // Standard archive format with link
    /<p><em>Matt EarthStar ~ musician, digital creator, explorer\. Based at <a href="\/">vibrationofawesome\.com<\/a>\.<\/em><\/p>/g,
    // Why-I-Built format (no link)
    /<p><em>Matt EarthStar ~ musician, digital creator, Forest Temple architect\. Based at vibrationofawesome\.com\.<\/em><\/p>/g,
    // Twenty-years format
    /<p><em>Matt EarthStar runs Vibration of Awesome ~ music, art, and systems for people who are done pretending the mainstream path is the only one\.<\/em><\/p>/g,
    // Catch-all for any remaining <em>Matt EarthStar ~ ...</em> one-liner signature
    /<p><em>Matt EarthStar[^<]*<\/em><\/p>/g,
  ];

  for (const re of footerVariants) {
    if (re.test(out)) {
      out = out.replace(re, NEW_SIG);
      changed = true;
    }
  }

  // 3. Remove comment-section call-to-action paragraphs
  //    The site has no comments section; these are legacy WordPress artifacts.
  const commentPrompts = [
    // Exact known variants
    /<p>If this writing touched you I encourage you to share this with the people you love and feel free to share your own experiences, thoughts and discussion in the comments below\.<\/p>\s*\n?/gi,
    /<p>If you have a story or personal experience you would like to share, please let us hear about it the comments below\.<\/p>\s*\n?/gi,
    /<p>If you feel this article has inspired you in anyway it would be awesome to hear about in the comments below\. You can also make a difference through sharing this with your fellow humans on and stuff\.<\/p>\s*\n?/gi,
    /<p>Thanks for reading! If you have an experience with Ayahuasca you would like to share or have anything to add the comments are below for you to run wild on\.<\/p>\s*\n?/gi,
    // Catch-all: any <p> mentioning "comments below"
    /<p>[^<]*comments below[^<]*<\/p>\s*\n?/gi,
    // Any <p> inviting sharing "in the comments"
    /<p>[^<]*in the comments[^<]*<\/p>\s*\n?/gi,
  ];
  for (const re of commentPrompts) {
    if (re.test(out)) {
      out = out.replace(re, "");
      changed = true;
    }
  }

  // Collapse any triple+ blank lines introduced by removal
  out = out.replace(/\n{3,}/g, "\n\n");

  return { html: out, changed };
}

const files = gatherHtmlFiles(POSTS_DIR);
console.log(`Processing ${files.length} Matt post files...\n`);

let updated = 0;
for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  const { html, changed } = updateSignatures(original);
  if (changed) {
    fs.writeFileSync(file, html, "utf8");
    updated++;
    console.log(`  ✓ ${path.relative(ROOT, file)}`);
  } else {
    console.log(`  · no change: ${path.relative(ROOT, file)}`);
  }
}

console.log(`\nDone. ${updated}/${files.length} files updated.`);
