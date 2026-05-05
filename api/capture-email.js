import crypto from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function send(res, status, body) {
  for (const [key, value] of Object.entries(CORS)) {
    res.setHeader(key, value);
  }
  res.status(status).json(body);
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getMailerLiteApiKey() {
  return (process.env.MAILERLITE_API_KEY || process.env.ML_API_KEY || "").trim();
}

function getMailerLiteGroupId(list) {
  if (list === "user_manual_waitlist") {
    return process.env.MAILERLITE_USER_MANUAL_WAITLIST_GROUP_ID ||
      process.env.MAILERLITE_WAITLIST_GROUP_ID ||
      process.env.ML_USER_MANUAL_WAITLIST_GROUP_ID ||
      "";
  }
  return process.env.MAILERLITE_FIELD_GUIDE_GROUP_ID ||
    process.env.MAILERLITE_GROUP_ID ||
    process.env.ML_GROUP_ID ||
    "";
}

function getMailerLiteGroupName(list) {
  if (list === "user_manual_waitlist") {
    return process.env.MAILERLITE_USER_MANUAL_WAITLIST_GROUP_NAME ||
      process.env.MAILERLITE_WAITLIST_GROUP_NAME ||
      "VOA User Manual Waiting List";
  }
  return process.env.MAILERLITE_FIELD_GUIDE_GROUP_NAME || "VOA Field Guide";
}

async function resolveMailerLiteGroupId(apiKey, list) {
  const configured = getMailerLiteGroupId(list);
  if (configured) return configured;

  const targetName = getMailerLiteGroupName(list).trim().toLowerCase();
  const resp = await fetch("https://connect.mailerlite.com/api/groups?limit=1000", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`MailerLite groups: ${resp.status} ${data.message || ""}`.trim());

  const groups = Array.isArray(data.data) ? data.data : [];
  const match = groups.find(group => String(group.name || "").trim().toLowerCase() === targetName);
  if (!match?.id) throw new Error(`MailerLite: group not found: ${getMailerLiteGroupName(list)}`);
  return String(match.id);
}

async function saveMailerLite(email, meta) {
  const apiKey = getMailerLiteApiKey();
  if (!apiKey) throw new Error("MailerLite: missing API key");
  const groupId = await resolveMailerLiteGroupId(apiKey, meta.list);

  const resp = await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email,
      groups: [groupId],
      fields: {
        source_page: meta.source_page,
        cta_placement: meta.cta_placement,
        blog_slug: meta.blog_slug,
        voa_offer: meta.list,
      },
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`MailerLite subscriber: ${resp.status} ${data.message || ""}`.trim());
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    for (const [key, value] of Object.entries(CORS)) {
      res.setHeader(key, value);
    }
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, { error: "Method not allowed" });
    return;
  }

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const {
    email,
    source_page = "",
    cta_placement = "",
    blog_slug = "",
    list,
    offer,
  } = body;

  if (!email || !isValidEmail(email)) {
    send(res, 400, { error: "Valid email address required" });
    return;
  }

  const signupList = list || offer || (
    source_page.includes("/user-manual/") ||
    (cta_placement || "").includes("waitlist")
      ? "user_manual_waitlist"
      : "field_guide"
  );
  const token = generateToken();
  const meta = { source_page, cta_placement, blog_slug, list: signupList };

  try {
    await saveMailerLite(email, meta);
  } catch (err) {
    console.error("Provider error:", err.message);
    send(res, 502, { error: err.message || "Email provider error", list: signupList });
    return;
  }

  const fieldGuidePath = process.env.FIELD_GUIDE_DOWNLOAD_PATH || "/downloads/voa-field-guide.pdf";
  send(res, 200, {
    success: true,
    token,
    list: signupList,
    download_url: signupList === "field_guide" ? fieldGuidePath : "/field-guide/",
    analytics_events: ["ebook_optin_submit", "ebook_optin_success"],
  });
}
