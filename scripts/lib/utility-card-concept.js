/**
 * utility-card-concept.js ~ Turns an existing VOA post into a real, specific
 * utility/list/resource social artifact concept, or honestly declines.
 *
 * This is the "use VOA's existing content as the brain" requirement: it
 * never invents a generic AI-slop list disconnected from the post. Claude is
 * asked to judge fit first; a post that doesn't genuinely support a useful,
 * specific list/framework/curiosity artifact returns { fit: false } and the
 * caller falls back to an art archetype instead of forcing a bad card.
 *
 * Output is strict JSON, validated locally. Every string here is rendered
 * verbatim and deterministically by utility-card-renderer.js ~ nothing here
 * is ever handed to an image model to spell, so there is no fake-AI-text risk
 * on this path.
 */

const VALID_FORMATS = ["list_resource", "curiosity_hook", "mini_guide", "comparison"];

function safeParseJson(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (_) {
    return null;
  }
}

function validateConcept(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.fit === false) return { fit: false };
  if (!VALID_FORMATS.includes(raw.format)) return null;
  if (!raw.headline || typeof raw.headline !== "string") return null;

  if (raw.format === "curiosity_hook") {
    if (!raw.hookLine || typeof raw.hookLine !== "string") return null;
  } else {
    if (!Array.isArray(raw.items) || raw.items.length < 3) return null;
    const items = raw.items
      .filter(it => it && typeof it.label === "string" && it.label.trim())
      .map(it => ({ label: it.label.trim(), detail: typeof it.detail === "string" ? it.detail.trim() : "" }));
    if (items.length < 3) return null;
    raw.items = items;
  }

  return {
    fit:      true,
    format:   raw.format,
    eyebrow:  typeof raw.eyebrow === "string" ? raw.eyebrow.trim() : "",
    headline: raw.headline.trim(),
    hookLine: typeof raw.hookLine === "string" ? raw.hookLine.trim() : "",
    items:    raw.items || [],
    footer:   typeof raw.footer === "string" ? raw.footer.trim() : "",
  };
}

/**
 * Ask Claude to derive a real utility-card concept from a VOA post, or
 * honestly say the post doesn't fit this format.
 *
 * @param {object}    post      - { title, excerpt, tags, slug }
 * @param {Anthropic} anthropic - Anthropic client
 * @param {string}    formatHint - preferred format id (archetype's formatId)
 * @returns {Promise<object|null>} concept or null (fit:false / invalid / error)
 */
export async function buildUtilityCardConcept(post, anthropic, formatHint) {
  const tags    = (post.tags || []).slice(0, 6).join(", ");
  // Needs enough of the post to reach past the opening hook/setup paragraph
  // into its actual specifics ~ a short slice reliably judges "no real content"
  // on posts whose concrete list/steps/tools appear later in the body.
  const excerpt = (post.excerpt || "").slice(0, 3000);

  try {
    const msg = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [{
        role: "user",
        content: `You are deciding whether a blog post can become a genuinely useful, specific, save-worthy Instagram utility card ~ NOT generic AI-slop, NOT a forced list.

Post title: ${post.title}
Excerpt: ${excerpt}
Tags: ${tags}
Preferred format: ${formatHint}

Judge honestly: does this post's actual content contain enough specific, concrete, useful information to fill a real list/resource/framework/curiosity card? Reject if the post is too abstract, too philosophical/vague, or would force a generic "X things about mindset" list that doesn't come from anything specific in the post.

If it fits, respond with ONLY this JSON shape (no markdown fences, no explanation):
{
  "fit": true,
  "format": "list_resource" | "curiosity_hook" | "mini_guide" | "comparison",
  "eyebrow": "short 2-4 word kicker, optional, or empty string",
  "headline": "punchy headline, max 60 characters, no clickbait ALL CAPS",
  "hookLine": "one sharp sentence, ONLY required if format is curiosity_hook",
  "items": [ { "label": "short specific point (max 55 chars)", "detail": "one-line elaboration, optional, max 90 chars" } ],
  "footer": "short optional line, e.g. a plain-language pointer, or empty string"
}
Use 3-8 items for list_resource/mini_guide, 3-5 for comparison (label = myth/before, detail = reality/after). Every item must be something a reader could not have written for any generic post ~ it must come from THIS post's actual content.

If the post genuinely does not fit, respond with ONLY:
{ "fit": false, "reason": "short reason" }`,
      }],
    });

    const text = msg.content[0]?.text || "";
    const parsed = safeParseJson(text);
    const validated = validateConcept(parsed);
    if (!validated || validated.fit === false) return null;
    return validated;
  } catch (err) {
    console.warn(`  [utility-card-concept] Failed: ${err.message} ~ falling back`);
    return null;
  }
}
