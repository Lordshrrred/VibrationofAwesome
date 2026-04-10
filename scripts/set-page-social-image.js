#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const filePath = path.join(ROOT, "content/posts/first-transmission.md");
const imagePath = "/images/posts/first-transmission/post-img-1.png";

const original = fs.readFileSync(filePath, "utf8");
if (original.includes("social_image:")) {
  console.log("social_image already present");
  process.exit(0);
}

const next = original.replace("draft: false\n---", `draft: false\nsocial_image: "${imagePath}"\n---`);
fs.writeFileSync(filePath, next, "utf8");
console.log(`updated ${path.relative(ROOT, filePath)}`);
