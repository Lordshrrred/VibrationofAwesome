import {
  getBearerToken,
  jsonResponse,
  parseJsonBody,
  saveFileToGitHub,
  verifySessionToken,
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
    const token = getBearerToken(event);
    if (!token) {
      return jsonResponse(401, { error: "Missing editor session token." }, origin);
    }
    verifySessionToken(token);

    const body = parseJsonBody(event);
    const path = String(body.path || "");
    const html = String(body.html || "");
    const message = String(body.message || "").trim() || "Update Forest Temple post";

    if (!path) {
      return jsonResponse(400, { error: "Missing file path." }, origin);
    }
    if (!html.trim()) {
      return jsonResponse(400, { error: "Updated HTML is required." }, origin);
    }

    const saved = await saveFileToGitHub(path, html, message);
    return jsonResponse(200, {
      ok: true,
      branch: saved.branch,
      path: saved.path,
      sha: saved.sha,
      commitUrl: saved.commitUrl,
      htmlUrl: saved.htmlUrl,
      downloadUrl: saved.downloadUrl,
    }, origin);
  } catch (error) {
    const message = error && error.message ? error.message : "Editor save failed.";
    const statusCode = /session/i.test(message) ? 401 : 500;
    return jsonResponse(statusCode, { error: message }, origin);
  }
}
