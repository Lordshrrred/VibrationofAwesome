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
 * Model and style are configurable via env vars:
 *   IDEOGRAM_DEFAULT_MODEL  (default: V_2_TURBO — fast + affordable for automated runs)
 *   IDEOGRAM_DEFAULT_STYLE  (default: DESIGN — bold graphic, good for Pinterest)
 *
 * Usage:
 *   import { generatePinterestImage } from "./generate-pinterest-image.js";
 *   const result = await generatePinterestImage(post, anthropic);
 *   // result: { url, model, style, promptHash } | null
 */

import crypto from "crypto";

async function buildIdeogramPrompt(post, anthropic) {
  const tags    = (post.tags || []).slice(0, 6).join(", ");
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
 * Generate a Pinterest portrait image via Ideogram.
 * Returns a result object on success, null on failure or missing key.
 *
 * @param {object}    post      - Post metadata { title, excerpt, tags }
 * @param {Anthropic} anthropic - Anthropic client for prompt generation
 * @returns {Promise<{url: string, model: string, style: string, promptHash: string}|null>}
 */
export async function generatePinterestImage(post, anthropic) {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) {
    console.log("  [ideogram] IDEOGRAM_API_KEY not set ~ using Pexels image for Pinterest");
    return null;
  }

  const model = process.env.IDEOGRAM_DEFAULT_MODEL || "V_2_TURBO";
  const style = process.env.IDEOGRAM_DEFAULT_STYLE || "DESIGN";

  try {
    console.log(`  [ideogram] Generating Pinterest portrait (${model}/${style})...`);

    const prompt = await buildIdeogramPrompt(post, anthropic);
    const promptHash = crypto.createHash("sha256").update(prompt).digest("hex").slice(0, 12);
    console.log(`  [ideogram] Prompt hash: ${promptHash}  "${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}"`);

    const resp = await fetch("https://api.ideogram.ai/generate", {
      method:  "POST",
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      body:    JSON.stringify({
        image_request: {
          prompt,
          aspect_ratio:        "ASPECT_10_16", // ~1000×1600px, Pinterest portrait standard
          model,
          style_type:          style,
          magic_prompt_option: "ON",
        },
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = data?.message || data?.error || `HTTP ${resp.status}`;
      console.warn(`  [ideogram] API error: ${msg} ~ falling back to Pexels`);
      return null;
    }

    const url = data.data?.[0]?.url;
    if (!url) {
      console.warn("  [ideogram] No image URL returned ~ falling back to Pexels");
      return null;
    }

    console.log(`  [ideogram] Pinterest image ready: ${url}`);
    return { url, model, style, promptHash, aspectRatio: "ASPECT_10_16" };

  } catch (err) {
    console.warn(`  [ideogram] Failed: ${err.message} ~ falling back to Pexels`);
    return null;
  }
}
