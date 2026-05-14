import { checkBacklinksEvent } from "./_backlinks-core.js";

function normalizeBody(body) {
  if (!body) return "";
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

export default async function handler(req, res) {
  const result = await checkBacklinksEvent({
    httpMethod: req.method,
    queryStringParameters: req.query || {},
    body: normalizeBody(req.body),
  });

  for (const [key, value] of Object.entries(result.headers || {})) {
    res.setHeader(key, value);
  }
  res.status(result.statusCode || 200).send(result.body || "");
}
