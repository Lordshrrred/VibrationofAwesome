#!/usr/bin/env node
/**
 * Cloud Publer delivery monitor.
 *
 * Runs in GitHub Actions, checks every failed post plus TikTok authorization,
 * deduplicates through a closed state issue, and sends email through Gmail SMTP.
 * A run is successful only when Gmail explicitly accepts every recipient.
 */

const PUBLER_BASE = "https://app.publer.com/api/v1";
const STATE_TITLE = "[automation state] Publer delivery monitor";
const ALERT_TO = process.env.ALERT_EMAIL || "earthlingoflight@gmail.com";
const WATCHED_TIKTOK_NAMES = new Set(["EarthStarRising", "LumiVale"]);
const required = [
  "PUBLER_API_KEY",
  "PUBLER_WORKSPACE_ID",
  "GMAIL_ADDRESS",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GITHUB_TOKEN",
  "GITHUB_REPOSITORY",
];

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
  const result = await fetchJson(
    `${PUBLER_BASE}/posts?${query.toString()}`,
    { headers: publerHeaders },
    "Publer failed posts",
  );
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  return {
    accounts,
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

async function sendEmail(subject, body) {
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
    await sendEmail(
      "✅ Publer failure email monitor is live",
      [
        "The cloud Publer monitor successfully queried Publer and Gmail accepted this test message.",
        "",
        ...watched.map(
          (account) =>
            `${account.name}: ${account.permissions?.can_access === true ? "authorized" : "NOT AUTHORIZED"}`,
        ),
        "",
        "Checks run every 15 minutes, even when the EarthStar Mac is asleep.",
      ].join("\n"),
    );
  }

  const currentFailureIds = truth.failures.map((failure) => failure.id);
  const currentInaccessible = watched
    .filter((account) => account.permissions?.can_access !== true)
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
      account.permissions?.can_access !== true && !previouslyInaccessible.has(account.id),
  );
  const recovered = watched.filter(
    (account) =>
      account.permissions?.can_access === true && previouslyInaccessible.has(account.id),
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
    await sendEmail(
      `🚨 Publer: ${newFailures.length + newlyInaccessible.length} new delivery problem(s)`,
      sections.join("\n"),
    );
  }

  if (recovered.length) {
    await sendEmail(
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

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
