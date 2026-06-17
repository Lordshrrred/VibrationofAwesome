// api/mailerlite.js ~ MailerLite stats proxy for VOA dashboard
// GET /api/mailerlite
// Env: MAILERLITE_API_KEY

const ML_BASE = "https://connect.mailerlite.com/api";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.MAILERLITE_API_KEY;
  if (!key) return res.status(503).json({ error: "MAILERLITE_API_KEY not set" });

  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  try {
    const [subResp, campaignResp, groupsResp] = await Promise.all([
      fetch(`${ML_BASE}/subscribers?filter[status]=active&limit=1`, { headers }),
      fetch(`${ML_BASE}/campaigns?filter[status]=sent&sort=sent_at&direction=desc&limit=3`, { headers }),
      fetch(`${ML_BASE}/groups?limit=25`, { headers }),
    ]);

    const [subData, campaignData, groupsData] = await Promise.all([
      subResp.json(),
      campaignResp.json(),
      groupsResp.json(),
    ]);

    const totalSubscribers = subData.meta?.total ?? 0;

    const campaigns = (campaignData.data || []).map(c => ({
      name:      c.name || "(unnamed)",
      sentAt:    c.scheduled_at || c.sent_at || null,
      sentCount: c.emails_count || 0,
      openRate:  c.stats?.open_rate?.float  ?? null,
      clickRate: c.stats?.click_rate?.float ?? null,
    }));

    const groups = (groupsData.data || []).map(g => ({
      name:   g.name,
      active: g.active_count  ?? g.total_subscribers ?? 0,
      total:  g.total         ?? g.active_count ?? 0,
    }));

    return res.status(200).json({ totalSubscribers, campaigns, groups });
  } catch (err) {
    console.error("[mailerlite]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
