#!/usr/bin/env node
/**
 * Cloud Publer delivery monitor.
 *
 * Runs in GitHub Actions, checks every failed post plus TikTok authorization,
 * deduplicates through a closed state issue, and sends email through Gmail SMTP.
 * A run is successful only when Gmail explicitly accepts every recipient.
 */

import fs from "node:fs";
import nodemailer from "nodemailer";
const HEALTH_MODE = process.argv.includes("--health");
const PUBLER_BASE = "https://app.publer.com/api/v1";
const STATE_TITLE = HEALTH_MODE ? "[automation state] VOA syndication health" : "[automation state] Publer delivery monitor";
const ALERT_TO = process.env.ALERT_EMAIL || "earthlingoflight@gmail.com";
const WATCHED_TIKTOK_NAMES = new Set(["EarthStarRising", "LumiVale"]);
const required = ["GITHUB_TOKEN", "GITHUB_REPOSITORY", ...(HEALTH_MODE ? [] : ["PUBLER_API_KEY", "PUBLER_WORKSPACE_ID"])];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const publerHeaders = {
  Authorization: `Bearer-API ${process.env.PUBLER_API_KEY}`,
  "Publer-Workspace-Id": process.env.PUBLER_WORKSPACE_ID,
  Accept: "application/json",
};

const githubHeaders = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function fetchJson(url, init = {}, label = url) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

function extractPosts(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.posts)) return value.posts;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.posts)) return value.data.posts;
  return [];
}

async function loadPublerTruth() {
  const accounts = await fetchJson(`${PUBLER_BASE}/accounts`, { headers: publerHeaders }, "Publer accounts");
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const query = new URLSearchParams({ state: "failed", from, to, per_page: "100" });
  const reauthQuery = new URLSearchParams({ state: "scheduled_reauth", from, to, per_page: "100" });
  const [result, reauthResult] = await Promise.all([
    fetchJson(`${PUBLER_BASE}/posts?${query.toString()}`, { headers: publerHeaders }, "Publer failed posts"),
    fetchJson(`${PUBLER_BASE}/posts?${reauthQuery.toString()}`, { headers: publerHeaders }, "Publer reauthorization posts"),
  ]);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  return {
    accounts,
    reauthAccountIds: [...new Set(extractPosts(reauthResult).map((post) => post.account_id).filter(Boolean))],
    failures: extractPosts(result).map((post) => ({
      id: String(post.id),
      accountId: post.account_id,
      accountName: accountById.get(post.account_id)?.name ?? post.account_id,
      provider: accountById.get(post.account_id)?.provider ?? "unknown",
      scheduledAt: post.scheduled_at,
      title: post.title || String(post.text || "").replace(/\s+/g, " ").slice(0, 100),
      error: post.error || "Unknown Publer delivery error",
    })),
  };
}

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const githubBase = `https://api.github.com/repos/${owner}/${repo}`;

function parseState(body) {
  const match = /```json\s*([\s\S]*?)\s*```/.exec(body || "");
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function stateBody(state) {
  return [
    "Machine-owned state for the Publer delivery monitor. Do not edit manually.",
    "",
    "```json",
    JSON.stringify(state, null, 2),
    "```",
  ].join("\n");
}

async function loadStateIssue() {
  const issues = await fetchJson(
    `${githubBase}/issues?state=all&sort=created&direction=desc&per_page=100`,
    { headers: githubHeaders },
    "GitHub issues",
  );
  const issue = issues.find((item) => item.title === STATE_TITLE && !item.pull_request) ?? null;
  return { issue, state: issue ? parseState(issue.body) : null };
}

async function saveState(issue, state) {
  const body = stateBody(state);
  if (issue) {
    await fetchJson(
      `${githubBase}/issues/${issue.number}`,
      {
        method: "PATCH",
        headers: { ...githubHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ body, state: "closed" }),
      },
      "GitHub monitor state update",
    );
    return;
  }
  const created = await fetchJson(
    `${githubBase}/issues`,
    {
      method: "POST",
      headers: { ...githubHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ title: STATE_TITLE, body }),
    },
    "GitHub monitor state creation",
  );
  await fetchJson(
    `${githubBase}/issues/${created.number}`,
    {
      method: "PATCH",
      headers: { ...githubHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ state: "closed" }),
    },
    "GitHub monitor state close",
  );
}

async function createAlertIssue(title, body) {
  const created = await fetchJson(
    `${githubBase}/issues`,
    {
      method: "POST",
      headers: { ...githubHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, assignees: [owner] }),
    },
    "GitHub Publer alert creation",
  );
  console.log(`Created assigned Publer alert: ${created.html_url}`);
  return created;
}

async function sendGmailApi(subject, body) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new Error(`Gmail token refresh failed (${tokenResponse.status}): ${JSON.stringify(tokenBody)}`);
  }
  const raw = [
    `From: ${process.env.GMAIL_ADDRESS}`,
    `To: ${ALERT_TO}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body).toString("base64"),
  ].join("\r\n");
  const sendResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: Buffer.from(raw).toString("base64url"),
      }),
    },
  );
  const result = await sendResponse.json();
  if (!sendResponse.ok || !result.id) {
    throw new Error(`Gmail send failed (${sendResponse.status}): ${JSON.stringify(result)}`);
  }
  console.log(`Gmail API accepted alert ${result.id} for ${ALERT_TO}.`);
}

async function sendEmail(subject, body) {
  // Prefer the existing app-password transport, independent of OAuth test-token expiry.
  if (process.env.GMAIL_ADDRESS && process.env.GMAIL_APP_PASSWORD) {
    try {
      const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true,
        auth: { user: process.env.GMAIL_ADDRESS, pass: process.env.GMAIL_APP_PASSWORD },
        connectionTimeout: 15000, socketTimeout: 20000 });
      const result = await transport.sendMail({ from: process.env.GMAIL_ADDRESS, to: ALERT_TO, subject, text: body });
      if (!result.accepted?.some(address => String(address).toLowerCase() === ALERT_TO.toLowerCase())) throw new Error("SMTP did not accept alert recipient");
      console.log(`Gmail SMTP accepted alert ${result.messageId} for ${ALERT_TO}.`);
      return;
    } catch (err) { console.warn(`SMTP alert failed: ${err.message}; trying Gmail API.`); }
  }
  if (!process.env.GMAIL_ADDRESS || !process.env.GMAIL_REFRESH_TOKEN) throw new Error("Gmail alert credentials missing");
  await sendGmailApi(subject, body);
}

async function healthMain() {
  const health = JSON.parse(fs.readFileSync("static/_data/syndication-health.json", "utf8"));
  if (!Number.isFinite(Date.parse(health.lastChecked)) || Math.abs(Date.now() - Date.parse(health.lastChecked)) > 3600_000) throw new Error("Health snapshot is stale; refusing to report recovery");
  const checks = health.checks || [];
  const blogger = checks.find(c => c.name === "Blogger token refresh");
  const problems = [];
  if (!blogger?.ok) problems.push({ key: "blogger", detail: blogger?.detail || "Blogger check unavailable", action: "Run npm run blogger-token from the VOA repo and finish Google consent. Check OAuth publishing status: Testing tokens expire after seven days." });
  if (health.drip?.status === "active" && health.drip.remaining < 8) problems.push({key:"queue",detail:`Only ${health.drip.remaining} drafts remain (under two days).`,action:"Inspect Publishing Queue Replenishment in GitHub Actions. Successful drafts are preserved; fix the reported provider, topic, or budget blocker."});
  const signature = problems.map(p=>p.key).sort().join(",") || "healthy";
  const {issue, state: prior} = await loadStateIssue();
  const test = process.env.MONITOR_TEST === "true";
  const changed = prior?.signature !== signature;
  const retryEmail = prior?.emailPending && Date.now() - Date.parse(prior.lastEmailAttempt || 0) >= 24 * 3600_000;
  const needsNotice = test || (changed && (problems.length || (prior && prior.signature !== "healthy"))) || retryEmail;
  const next = { ...prior, signature, checkedAt: health.lastChecked };
  if (needsNotice) {
    const subject = test ? "VOA alert email test" : problems.length ? `VOA needs attention: ${problems.map(p=>p.key === "blogger" ? "Blogger reconnect" : "article reserve").join(" + ")}` : "VOA publishing health recovered";
    const body = [test ? "This verifies the email channel for Blogger failures and critically low article inventory." : subject,
      ...problems.map(p=>`${p.detail}\n${p.action}`),
      `Blogger: ${blogger?.ok ? "connected" : "needs attention"}. Drafts: ${health.drip?.remaining ?? "unknown"}.`,
      "Checks run twice daily in GitHub Actions, even when your Mac is asleep. Alerts are sent for new failures and recovery, not every unchanged run.",
      process.env.RUN_URL || `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/workflows/syndication-health.yml`,
    ].join("\n\n");
    if (changed && problems.length) await createAlertIssue(subject, body);
    next.lastEmailAttempt = new Date().toISOString();
    try { await sendEmail(subject, body); next.emailPending = false; next.lastEmailAccepted = new Date().toISOString(); }
    catch (error) {
      next.emailPending = true;
      if (!prior?.emailPending) await createAlertIssue("VOA email alerts need repair", `Email delivery failed: ${error.message}\nBlogger and queue checks still run. Repair Gmail credentials in Actions; this failure is not a successful email delivery.`);
      await saveState(issue, next);
      throw error;
    }
  }
  await saveState(issue, next);
  console.log(`VOA health monitor: ${signature}; ${needsNotice ? "notification accepted" : "unchanged, quiet"}.`);
}

async function sendNotification(subject, body) {
  await createAlertIssue(subject, body);
  try {
    await sendEmail(subject, body);
  } catch (error) {
    // GitHub issue assignment is the guaranteed durable channel. Gmail is a
    // second channel and must never take the monitor itself dark.
    console.warn(`Gmail secondary alert unavailable: ${error instanceof Error ? error.message : error}`);
  }
}

function formatFailure(failure) {
  const when = new Date(failure.scheduledAt).toLocaleString("en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return [
    `${failure.accountName} (${failure.provider})`,
    `Scheduled: ${when} MT`,
    `Post: ${failure.title || "Untitled"}`,
    `Error: ${failure.error}`,
    `Publer post id: ${failure.id}`,
  ].join("\n");
}

async function main() {
  const truth = await loadPublerTruth();
  const { issue, state: prior } = await loadStateIssue();
  const watched = truth.accounts.filter(
    (account) => account.provider === "tiktok" && WATCHED_TIKTOK_NAMES.has(account.name),
  );

  if (process.env.MONITOR_TEST === "true") {
    await sendNotification(
      "✅ Publer delivery monitor is live",
      [
        "The cloud Publer monitor successfully queried Publer and created this assigned GitHub notification.",
        "",
        ...watched.map(
          (account) =>
            `${account.name}: ${account.permissions?.can_access === true ? "authorized" : "NOT AUTHORIZED"}`,
        ),
        "",
        "GitHub requests checks every 15 minutes, even when the EarthStar Mac is asleep. GitHub may delay scheduled runs.",
      ].join("\n"),
    );
  }

  const currentFailureIds = truth.failures.map((failure) => failure.id);
  const reauthAccountIds = new Set(truth.reauthAccountIds);
  const currentInaccessible = watched
    .filter((account) => account.permissions?.can_access !== true || reauthAccountIds.has(account.id))
    .map((account) => account.id);

  if (!prior) {
    await saveState(issue, {
      version: 1,
      initializedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seenFailureIds: currentFailureIds,
      inaccessibleAccountIds: currentInaccessible,
    });
    console.log(`Initialized baseline with ${currentFailureIds.length} recent failures.`);
    return;
  }

  const seen = new Set(prior.seenFailureIds ?? []);
  const previouslyInaccessible = new Set(prior.inaccessibleAccountIds ?? []);
  const newFailures = truth.failures.filter((failure) => !seen.has(failure.id));
  const newlyInaccessible = watched.filter(
    (account) =>
      (account.permissions?.can_access !== true || reauthAccountIds.has(account.id)) &&
      !previouslyInaccessible.has(account.id),
  );
  const recovered = watched.filter(
    (account) =>
      account.permissions?.can_access === true &&
      !reauthAccountIds.has(account.id) &&
      previouslyInaccessible.has(account.id),
  );

  if (newFailures.length || newlyInaccessible.length) {
    const sections = [
      "Publer delivery needs attention.",
      "",
      ...newlyInaccessible.map(
        (account) => `${account.name} (TikTok) no longer reports publishing access. Reauthorize it in Publer.`,
      ),
      ...newFailures.flatMap((failure) => [formatFailure(failure), ""]),
    ];
    await sendNotification(
      `🚨 Publer: ${newFailures.length + newlyInaccessible.length} new delivery problem(s)`,
      sections.join("\n"),
    );
  }

  if (recovered.length) {
    await sendNotification(
      `✅ Publer access recovered: ${recovered.map((account) => account.name).join(", ")}`,
      recovered.map((account) => `${account.name} now reports publishing access again.`).join("\n"),
    );
  }

  await saveState(issue, {
    version: 1,
    initializedAt: prior.initializedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seenFailureIds: [...new Set([...(prior.seenFailureIds ?? []), ...currentFailureIds])].slice(-1000),
    inaccessibleAccountIds: currentInaccessible,
  });
  console.log(
    `Monitor complete: ${newFailures.length} new failures, ${newlyInaccessible.length} access losses, ${recovered.length} recoveries.`,
  );
}

(HEALTH_MODE ? healthMain() : main()).catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
