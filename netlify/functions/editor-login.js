import {
  jsonResponse,
  parseJsonBody,
  signSession,
  verifyPassword,
} from "./_editor-auth.js";

export async function handler(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "";

  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, {}, origin);
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, origin);
  }

  try {
    const body = parseJsonBody(event);
    const password = String(body.password || "");
    if (!password) {
      return jsonResponse(400, { error: "Password is required." }, origin);
    }
    if (!verifyPassword(password)) {
      return jsonResponse(401, { error: "That password did not unlock the editor." }, origin);
    }

    const sessionToken = signSession({ scope: "editor:save" });
    return jsonResponse(200, {
      ok: true,
      sessionToken,
      expiresIn: 12 * 60 * 60,
      branch: process.env.GITHUB_EDITOR_BRANCH || "main",
      repo: process.env.GITHUB_EDITOR_REPO || "Lordshrrred/VibrationofAwesome",
    }, origin);
  } catch (error) {
    return jsonResponse(500, {
      error: error && error.message ? error.message : "Editor login failed.",
    }, origin);
  }
}
