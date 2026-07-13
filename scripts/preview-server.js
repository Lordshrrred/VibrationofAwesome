#!/usr/bin/env node
/**
 * preview-server.js
 *
 * `hugo server -D` serves an in-memory virtual filesystem and has no concept
 * of Vercel's `cleanUrls: true` (vercel.json) ~ so extensionless production
 * routes like /blog/boom/posts/some-slug (the actual URL shape every post's
 * `url` field uses) 404 locally even though they resolve fine in production.
 * That gap is what made /blog/boom/posts/using-ai-without-losing-what-makes-
 * you-human-a-creators-field-manual look "broken" during local review ~ it
 * was never a bad URL, generator bug, or stale data, just a local routing
 * mismatch.
 *
 * This builds the real production output (`hugo --gc`, matching vercel.json's
 * buildCommand) into public/, then serves it with the same clean-URL
 * fallback Vercel applies, so local preview matches what ships.
 */
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const PORT = process.env.PREVIEW_PORT || 4000;

console.log("Building production site (hugo --gc) ...");
execSync("hugo --gc", { cwd: ROOT, stdio: "inherit" });

const app = express();

// Emulate vercel.json's cleanUrls:true ~ legacy .html requests redirect to the
// clean URL and extensionless requests fall back to the matching .html file.
app.use((req, res, next) => {
  const reqPath = decodeURIComponent(req.path);
  if (reqPath.endsWith(".html")) {
    const candidate = path.join(PUBLIC_DIR, reqPath);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const cleanPath = reqPath.replace(/\.html$/i, "");
      return res.redirect(308, cleanPath + req.url.slice(req.path.length));
    }
  }
  if (reqPath !== "/" && reqPath.endsWith("/")) {
    const candidate = path.join(PUBLIC_DIR, reqPath.replace(/\/$/i, ".html"));
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      req.url = reqPath.replace(/\/$/i, ".html") + req.url.slice(req.path.length);
      return next();
    }
  }
  if (path.extname(reqPath) || reqPath.endsWith("/")) return next();
  const candidate = path.join(PUBLIC_DIR, reqPath + ".html");
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    req.url = reqPath + ".html" + req.url.slice(req.path.length);
  }
  next();
});

app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

app.listen(PORT, () => {
  console.log(`Production-accurate preview running at http://localhost:${PORT}`);
  console.log("Routing matches vercel.json (cleanUrls: true) ~ this is what production actually serves.");
});
