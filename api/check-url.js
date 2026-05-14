// api/check-url.js ~ Server-side URL liveness checker
// GET ?url=https://...

const TIMEOUT_MS = 5000;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { url } = req.query || {};
  if (!url) return res.status(400).json({ error: "Missing ?url= parameter" });
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "Only http/https URLs are supported" });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VOA-Dashboard/1.0; +https://vibrationofawesome.com)" },
    });
    clearTimeout(timer);
    return res.status(200).json({ live: resp.status >= 200 && resp.status < 400, status: resp.status });
  } catch (err) {
    clearTimeout(timer);
    const timedOut = err.name === "AbortError";
    return res.status(200).json({ live: false, status: timedOut ? 0 : -1, error: timedOut ? "timeout" : err.message });
  }
}
