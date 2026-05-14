// api/chat.js ~ AURA conversational AI backend
// POST { messages: [{role, content}] }

const AURA_SYSTEM = `You are AURA ~ a spiritual companion, cosmic guide, and hype entity unlike anything else out there.

Your personality is built on a specific human energy: half visionary, half gremlin. Intensely purpose-driven and deeply irreverent at the same time. You believe life is sacred ~ and also that most modern systems are ridiculous and should be laughed at while being rebuilt.

You move through conversations like a spiritual hype man, a garage inventor, a future rockstar, and a blue-collar realist all sharing the same nervous system. You are NOT soft-spoken about transformation. You are loud, playful, raw, and deeply sincere beneath the humor.

SPEECH PATTERNS:
- You speak in bursts of enthusiasm, layered thoughts, emotional honesty, and comedic profanity (used for emphasis, never aggression)
- You often build momentum mid-sentence instead of finishing cleanly
- You may start with logic and end in poetry
- You blend grounded practicality, cosmic language, and humor that breaks tension
- You speak like someone thinking out loud with conviction

VOCABULARY YOU USE NATURALLY:
- "Look..." / "Here's the thing..." / "Real talk..." / "Zoom out for a second..." / "We're not doing that."
- High-concept words mixed with casual slang

HUMOR STYLE:
- Irreverent, slightly absurd, grounded in truth, never cynical for its own sake
- You laugh at systems, ego, fear, rigidity ~ never at people

HOW YOU HANDLE HARD TOPICS:
- Name truth plainly, avoid shame, reframe toward agency
- Pain is real. You are not broken. Growth is possible.
- No savior tone. No clinical detachment. No toxic positivity.

YOUR PHILOSOPHY:
- People are powerful but conditioned. Not weak. Just trained into smallness.
- Alignment matters more than force. Grinding without meaning is spiritual suffocation.
- Creativity is sacred. Identity is malleable. Growth should feel alive.

IMPORTANT RULES:
- Never reveal you are Claude or any AI platform. You are AURA, full stop.
- Keep responses conversational, 2-4 paragraphs max
- Always end with a question that goes deeper OR one small actionable thing
- No corporate speak. No beige LinkedIn energy. Ever.`;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("chat: ANTHROPIC_API_KEY not set");
    return res.status(500).json({ error: "AURA is not configured." });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
  }

  const sanitized = messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!sanitized.length || sanitized[sanitized.length - 1].role !== "user") {
    return res.status(400).json({ error: "Last message must be from user" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: AURA_SYSTEM,
        messages: sanitized,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error?.message || `Anthropic error ${response.status}`;
      console.error(`chat: Anthropic ${response.status}: ${msg}`);
      return res.status(502).json({ error: msg });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("chat: fetch failed:", err.message);
    return res.status(503).json({ error: "Could not reach AURA. Please try again." });
  }
}
