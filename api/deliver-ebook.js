// api/deliver-ebook.js ~ Secure ebook download token validator
// GET ?token=XXXXX&product=free|ai
// "paid" remains an alias for "ai" so old emailed links keep working.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { token = "", product = "free" } = req.query || {};

  if (!token) {
    return res.status(400).send("<p>Missing download token. Please use the link from your confirmation email.</p>");
  }

  const validTokens = (process.env.VALID_EBOOK_TOKENS || "")
    .split(",").map(t => t.trim()).filter(Boolean);

  if (!validTokens.includes(token)) {
    return res.status(403).send('<p>Invalid or expired download token. Please sign up again at <a href="/field-guide/">vibrationofawesome.com/field-guide/</a></p>');
  }

  const siteUrl = (process.env.SITE_URL || "https://vibrationofawesome.com").replace(/\/$/, "");
  const fieldGuidePath = "/downloads/voa-field-guide.pdf";
  const aiGuidePath = "/downloads/voa-ai.pdf";
  const requestedPath = product === "ai" || product === "paid"
    ? aiGuidePath
    : fieldGuidePath;

  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, `${siteUrl}${requestedPath}`);
}
