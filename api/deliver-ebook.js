// api/deliver-ebook.js ~ Secure ebook download token validator
// GET ?token=XXXXX&product=free|paid

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
  const freePath = process.env.FREE_EBOOK_PATH || "/dl/a7f3k9x2m4p8q1w6/field-guide.pdf";
  const paidPath = process.env.PAID_EBOOK_PATH || "/dl/b2n8h5r7t3y6u1i4/user-manual.pdf";

  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, `${siteUrl}${product === "paid" ? paidPath : freePath}`);
}
