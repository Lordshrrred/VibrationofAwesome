// api/editor-login.js ~ VOA Post Studio session token issuer
// POST { password }

import { sendJson, signSession, verifyPassword } from "./_editor-auth.js";

export default async function handler(req, res) {
  const origin = req.headers?.origin || "";
  if (req.method === "OPTIONS") { sendJson(res, 204, {}, origin); return; }
  if (req.method !== "POST") { sendJson(res, 405, { error: "Method not allowed." }, origin); return; }

  try {
    const { password = "" } = req.body || {};
    if (!password) { sendJson(res, 400, { error: "Password is required." }, origin); return; }
    if (!verifyPassword(password)) { sendJson(res, 401, { error: "That password did not unlock the editor." }, origin); return; }

    const sessionToken = signSession({ scope: "editor:save" });
    sendJson(res, 200, {
      ok: true, sessionToken, expiresIn: 43200,
      branch: process.env.GITHUB_EDITOR_BRANCH || "main",
      repo: process.env.GITHUB_EDITOR_REPO || "Lordshrrred/VibrationofAwesome",
    }, origin);
  } catch (err) {
    sendJson(res, 500, { error: err?.message || "Editor login failed." }, origin);
  }
}
