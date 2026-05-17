/**
 * generate-pinterest-image.js
 *
 * VISUAL SYSTEM A ~ live lightweight syndication visuals.
 * This is the production path currently used by syndication/drip publishing:
 * it generates the one-off Pinterest/Instagram asset needed for the live post
 * flow, and `syndicate.js` records usage in `static/_data/image-registry.json`.
 *
 * System B lives separately in `scripts/lib/build-visual-prompts.js`. Both
 * systems intentionally coexist while the richer future visual ecosystem is
 * prepared without changing the live syndication path.
 *
 * Generates a Pinterest-optimized image using the Ideogram API.
 * Falls back silently to null if IDEOGRAM_API_KEY is not set, so
 * the rest of syndication continues with a Pexels image instead.
 *
 * Ideogram API docs: https://api.ideogram.ai/docs
 * Get a key at:      https://ideogram.ai/manage-api
 *
 * Usage:
 *   import { generatePinterestImage } from "./generate-pinterest-image.js";
 *   const url = await generatePinterestImage(post, anthropic);  // returns URL or null
 */

/**
 * Ask Claude Haiku for a Pinterest-optimized Ideogram prompt.
 * Uses Haiku for speed + cost: this is a brief creative task.
 */
async function buildIdeogramPrompt(post, anthropic) {
  const tags = (post.tags || []).slice(0, 6).join(", ");
  const excerpt = (post.excerpt || "").slice(0, 300);

  const msg = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Write an Ideogram image generation prompt for a Pinterest pin about this blog post.

Title: ${post.title}
Excerpt: ${excerpt}
Tags: ${tags}

Requirements:
- Visually striking, emotionally evocative aesthetic suited to the post theme
- Include a short bold text overlay as part of the image (5-8 words distilling the core message)
- Portrait orientation (Pinterest standard 2:3 ratio)
- Cinematic lighting or painterly digital art style
- Avoid faces and identifiable people (evergreen reach)
- The visual mood and palette should match the post tone

Respond with ONLY the image prompt text, nothing else.`,
    }],
  });

  return msg.content[0].text.trim();
}

/**
 * Generate a Pinterest image via Ideogram and return the image URL.
 * Returns null (with a log message) if the API key is missing or generation fails.
 *
 * @param {object}    post       - Post metadata { title, excerpt, tags }
 * @param {Anthropic} anthropic  - Anthropic client for prompt generation
 * @returns {Promise<string|null>} Public image URL or null
 */
export async function generatePinterestImage(post, anthropic) {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) {
    console.log("  [ideogram] IDEOGRAM_API_KEY not set ~ using Pexels image for Pinterest");
    return null;
  }

  try {
    console.log("  [ideogram] Generating Pinterest image...");

    const prompt = await buildIdeogramPrompt(post, anthropic);
    console.log(`  [ideogram] Prompt: ${prompt.slice(0, 100)}${prompt.length > 100 ? "..." : ""}`);

    const resp = await fetch("https://api.ideogram.ai/generate", {
      method: "POST",
      headers: {
        "Api-Key":       apiKey,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        image_request: {
          prompt,
          aspect_ratio:         "ASPECT_10_16",  // ~1000x1600px, Pinterest portrait standard
          model:                "V_2_TURBO",      // fast + affordable; swap to "V_2" for max quality
          style_type:           "DESIGN",         // bold, graphic ~ works well for Pinterest
          magic_prompt_option:  "ON",             // Ideogram enhances the prompt further
        },
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = data?.message || data?.error || `HTTP ${resp.status}`;
      console.warn(`  [ideogram] API error: ${msg} ~ falling back to Pexels`);
      return null;
    }

    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      console.warn("  [ideogram] No image URL returned ~ falling back to Pexels");
      return null;
    }

    console.log(`  [ideogram] Image ready: ${imageUrl}`);
    return imageUrl;

  } catch (err) {
    console.warn(`  [ideogram] Failed: ${err.message} ~ falling back to Pexels`);
    return null;
  }
}
