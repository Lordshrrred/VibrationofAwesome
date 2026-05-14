// api/editor-save.js ~ VOA Post Studio file saver (GitHub-backed)
// POST { path, html, message? } with Authorization: Bearer <sessionToken>

import { getBearerToken, saveFileToGitHub, sendJson, verifySessionToken } from "./_editor-auth.js";

export default async function handler(req, res) {
  const origin = req.headers?.origin || "";
  if (req.method === "OPTIONS") { sendJson(res, 204, {}, origin); return; }
  if (req.method !== "POST") { sendJson(res, 405, { error: "Method not allowed." }, origin); return; }

  try {
    const token = getBearerToken(req);
    if (!token) { sendJson(res, 401, { error: "Missing editor session token." }, origin); return; }
    verifySessionToken(token);

    const { path = "", html = "", message = "" } = req.body || {};
    if (!path) { sendJson(res, 400, { error: "Missing file path." }, origin); return; }
    if (!String(html).trim()) { sendJson(res, 400, { error: "Updated HTML is required." }, origin); return; }

    const saved = await saveFileToGitHub(path, html, String(message).trim() || "Update Forest Temple post");
    sendJson(res, 200, { ok: true, ...saved }, origin);
  } catch (err) {
    const msg = err?.message || "Editor save failed.";
    sendJson(res, /session|expired/i.test(msg) ? 401 : 500, { error: msg }, origin);
  }
}
