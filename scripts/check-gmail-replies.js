#!/usr/bin/env node
/**
 * check-gmail-replies.js
 *
 * Reads the last N days of Gmail inbox (earthlingoflight@gmail.com) for subscriber
 * replies and saves them to static/_data/gmail-subscriber-replies.json so the
 * dashboard can display them without using a Vercel function.
 *
 * Expects in env:
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *   GMAIL_REFRESH_TOKEN
 *
 * Output schema (array, newest first, max 50 entries):
 * [
 *   {
 *     id, threadId, from, subject, snippet, date,
 *     labels, isRead, isStarred, hasReplyFromMe
 *   }
 * ]
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const ROOT      = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE  = path.join(ROOT, "static/_data/gmail-subscriber-replies.json");
const DAYS_BACK = parseInt(process.env.GMAIL_DAYS_BACK || "7", 10);
const MAX_MSGS  = 50;

// ── HTTP helper ────────────────────────────────────────────────────────────────
function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Token refresh ──────────────────────────────────────────────────────────────
async function getAccessToken() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error("Missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN");
  }

  const body = new URLSearchParams({
    client_id:     GMAIL_CLIENT_ID,
    client_secret: GMAIL_CLIENT_SECRET,
    refresh_token: GMAIL_REFRESH_TOKEN,
    grant_type:    "refresh_token",
  }).toString();

  const resp = await httpsRequest({
    hostname: "oauth2.googleapis.com",
    path:     "/token",
    method:   "POST",
    headers:  { "Content-Type": "application/x-www-form-urlencoded" },
  }, body);

  if (resp.status !== 200 || !resp.body.access_token) {
    throw new Error(`Token refresh failed (${resp.status}): ${JSON.stringify(resp.body)}`);
  }
  return resp.body.access_token;
}

// ── Gmail API helpers ──────────────────────────────────────────────────────────
async function gmailGet(token, path_) {
  const resp = await httpsRequest({
    hostname: "gmail.googleapis.com",
    path:     path_,
    method:   "GET",
    headers:  { Authorization: `Bearer ${token}` },
  });
  if (resp.status !== 200) throw new Error(`Gmail ${path_}: ${resp.status} ${JSON.stringify(resp.body)}`);
  return resp.body;
}

function headerVal(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const token = await getAccessToken();
  console.log("  Gmail token acquired");

  // Date cutoff
  const since = new Date();
  since.setDate(since.getDate() - DAYS_BACK);
  const afterEpoch = Math.floor(since.getTime() / 1000);

  // List messages in INBOX received after cutoff (exclude our own sends)
  const query  = `in:inbox after:${afterEpoch}`;
  const listUrl = `/gmail/v1/users/me/messages?maxResults=${MAX_MSGS}&q=${encodeURIComponent(query)}`;
  const listData = await gmailGet(token, listUrl);
  const msgList  = listData.messages || [];

  console.log(`  Found ${msgList.length} inbox messages (last ${DAYS_BACK} days)`);

  const results = [];
  for (const { id, threadId } of msgList) {
    try {
      const msg = await gmailGet(token, `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
      const hdrs     = msg.payload?.headers || [];
      const from     = headerVal(hdrs, "From");
      const subject  = headerVal(hdrs, "Subject");
      const dateStr  = headerVal(hdrs, "Date");
      const labels   = msg.labelIds || [];
      const isRead   = !labels.includes("UNREAD");
      const isStarred = labels.includes("STARRED");

      results.push({
        id,
        threadId,
        from,
        subject,
        snippet: msg.snippet || "",
        date:    dateStr,
        dateMs:  msg.internalDate ? parseInt(msg.internalDate, 10) : 0,
        labels,
        isRead,
        isStarred,
      });
    } catch (err) {
      console.warn(`  Skipping message ${id}: ${err.message}`);
    }
  }

  // Sort newest first, drop internal dateMs from output
  results.sort((a, b) => b.dateMs - a.dateMs);
  const output = results.map(({ dateMs: _, ...r }) => r);

  fs.writeFileSync(OUT_FILE, JSON.stringify({
    updatedAt: new Date().toISOString(),
    daysBack: DAYS_BACK,
    count: output.length,
    messages: output,
  }, null, 2), "utf8");

  console.log(`  Wrote ${output.length} messages → ${OUT_FILE}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
