/**
 * generate-instagram-visual.js
 *
 * Generates Instagram-optimized visuals for VOA using the Ideogram API.
 * Each post receives a deliberately chosen archetype (one of 8 visual identities)
 * selected using anti-repetition logic to ensure the feed reads as a living,
 * varied philosophical visual ecosystem — not a uniform repost machine.
 *
 * Archetype selection: recency-penalized rotation from instagram-archetypes.js
 * Anti-monotony: palette group, emotional cluster, and avoidWith rules
 * Fallback: silently returns null if IDEOGRAM_API_KEY is unset or generation fails.
 *   Caller falls back to pinterestImageUrl (Pexels/Pinterest Ideogram).
 *
 * Visual format:
 *   - ASPECT_1_1 (1080×1080px square — Instagram standard)
 *   - V_2_TURBO model by default (~$0.02/image)
 *   - Archetype-specific style (DESIGN, REALISTIC, or AUTO)
 *   - Magic prompt ON (Ideogram enhances the base prompt)
 *
 * Usage:
 *   import { generateInstagramVisual } from "./generate-instagram-visual.js";
 *   const result = await generateInstagramVisual(post, anthropic, contentType);
 *   // result: { url, archetype, archetypeLabel, palette, emotionalCluster, prompt } | null
 */

import crypto from "crypto";
import { INSTAGRAM_ARCHETYPES, getInstagramArchetype, selectInstagramArchetype } from "./lib/instagram-archetypes.js";
import { getRecentInstagramArchetypes, recordInstagramArchetype } from "./lib/generation-memory.js";

// ── Prompt construction ───────────────────────────────────────────────────────

/**
 * Ask Claude Haiku to build an archetype-specific Ideogram prompt for Instagram.
 * Haiku is used for speed + cost — this is a brief creative task.
 */
async function buildInstagramPrompt(post, archetype, anthropic) {
  const tags    = (post.tags || []).slice(0, 5).join(", ");
  const excerpt = (post.excerpt || "").slice(0, 250);

  const msg = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 220,
    messages: [{
      role:    "user",
      content: `Write an Ideogram image generation prompt for an Instagram square post about this blog content.

Post title: ${post.title}
Excerpt: ${excerpt}
Tags: ${tags}

Visual archetype to use: ${archetype.label}
Archetype visual DNA: ${archetype.visualDNA}
Prompt guidance: ${archetype.promptGuidance}

RULES:
- The image should feel like a panel from a modern consciousness magazine (Vibration of Awesome)
- VOA palette: deep near-black backgrounds (#020a0a to #030d0d), teal/cyan accent (#00e5cc), subtle deep greens
- Emotionally resonant and visually premium
- No stock photo energy. No motivational poster energy. No hustle culture visuals.
- No faces or identifiable people (evergreen reach)
- Square composition (1:1 — Instagram standard)
- The tone of someone who has been through real things and emerged with unusual clarity

Respond with ONLY the Ideogram prompt text. No explanation. No preamble.`,
    }],
  });

  return msg.content[0].text.trim();
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Generate an Instagram-specific visual for a VOA post.
 *
 * @param {object}    post        - Post metadata { title, excerpt, tags, slug, niche }
 * @param {Anthropic} anthropic   - Anthropic client for prompt generation
 * @param {string}    [contentType] - Optional content type for archetype affinity
 * @returns {Promise<object|null>} Result object or null on failure
 */
export async function generateInstagramVisual(post, anthropic, contentType = null) {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) {
    console.log("  [instagram-visual] IDEOGRAM_API_KEY not set ~ using Pinterest/Pexels image for Instagram");
    return null;
  }

  try {
    // Select archetype using recency-penalized anti-monotony rotation
    const recentArchetypes = getRecentInstagramArchetypes(10);
    const archetype = selectInstagramArchetype(recentArchetypes, contentType);

    console.log(`  [instagram-visual] Archetype: ${archetype.label} (${archetype.palette} / ${archetype.emotionalTone})`);

    // Build the Ideogram prompt via Claude Haiku
    const prompt = await buildInstagramPrompt(post, archetype, anthropic);
    console.log(`  [instagram-visual] Prompt: ${prompt.slice(0, 90)}${prompt.length > 90 ? "..." : ""}`);

    const model = process.env.IDEOGRAM_DEFAULT_MODEL || "V_2_TURBO";
    const promptHash = crypto.createHash("sha256").update(prompt).digest("hex").slice(0, 12);

    console.log(`  [instagram-visual] Prompt hash: ${promptHash}  "${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}"`);

    // Call Ideogram API (1:1 square, Instagram standard)
    const resp = await fetch("https://api.ideogram.ai/generate", {
      method:  "POST",
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      body:    JSON.stringify({
        image_request: {
          prompt,
          aspect_ratio:        "ASPECT_1_1",           // Instagram square 1080×1080px
          model,                                        // from IDEOGRAM_DEFAULT_MODEL env var
          style_type:          archetype.ideogramStyle, // varies by archetype for visual variety
          magic_prompt_option: "ON",                    // Ideogram enhances further
        },
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = data?.message || data?.error || `HTTP ${resp.status}`;
      console.warn(`  [instagram-visual] Ideogram error: ${msg} ~ falling back to Pinterest image`);
      return null;
    }

    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      console.warn("  [instagram-visual] No URL returned ~ falling back to Pinterest image");
      return null;
    }

    // Record archetype in generation-memory for future anti-monotony selection
    if (post.slug) {
      recordInstagramArchetype({
        slug:           post.slug,
        archetype:      archetype.id,
        archetypeLabel: archetype.label,
        palette:        archetype.palette,
        emotionalTone:  archetype.emotionalTone,
        emotionalCluster: archetype.emotionalCluster,
      });
    }

    console.log(`  [instagram-visual] ✓ Image ready: ${imageUrl}`);

    return {
      url:              imageUrl,
      archetype:        archetype.id,
      archetypeLabel:   archetype.label,
      palette:          archetype.palette,
      emotionalTone:    archetype.emotionalTone,
      emotionalCluster: archetype.emotionalCluster,
      prompt,
      promptHash,
      model,
      style:            archetype.ideogramStyle,
      aspectRatio:      "ASPECT_1_1",
    };
  } catch (err) {
    console.warn(`  [instagram-visual] Failed: ${err.message} ~ falling back to Pinterest image`);
    return null;
  }
}
