/**
 * policy.js ~ Syndication policy layer for vibrationofawesome.com
 *
 * Responsibilities:
 *   - Content type detection from post metadata (niche, tags, lane)
 *   - Social platform routing by content type
 *   - Backlink tier identification (always runs, never throttled)
 *   - CTA rotation across posts (avoids same-link spam)
 *   - Platform quota + cooldown lookup (informational in v1)
 *   - Policy decision logging to stdout
 *
 * See: shared-config/syndication-policy-v1.md for full rationale.
 *
 * Usage:
 *   import { BACKLINK_TIER, detectContentType, getSocialPlatforms,
 *            logPolicyDecision, getNextCTA } from './lib/policy.js';
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..", "..");
const DATA_DIR   = path.join(ROOT, "static", "_data");

// ─────────────────────────────────────────────────────────────────
// PLATFORM TIERS
// ─────────────────────────────────────────────────────────────────

/**
 * Backlink tier ~ always syndicates, never throttled.
 * These are SEO infrastructure: indexed backlinks, canonical signals,
 * domain authority. Do NOT apply social filtering to these platforms.
 */
export const BACKLINK_TIER = [
  "devto",
  "tumblr_esr",
  "tumblr_voa",
  "blogger",
  "wordpress_earthstar",
];

/**
 * All social platforms known to the blog engine.
 * Used to compute the suppressed set for logging.
 */
export const ALL_SOCIAL = [
  "bluesky_esr",
  "bluesky_voa",
  "mastodon_esr",
  "mastodon_voa",
  "facebook_voa",
  "facebook_earthstar",
  "instagram",
  "threads",
  "pinterest",
];

// ─────────────────────────────────────────────────────────────────
// CONTENT TYPE DETECTION
// ─────────────────────────────────────────────────────────────────

/** EarthStar niche slug -> content type */
const NICHE_TO_TYPE = {
  "ai-creator-tools":             "creator",
  "self-betrayal-avoidance":      "philosophy",
  "dopamine-addiction-numbing":   "nervous-system",
  "nervous-system-dysregulation": "nervous-system",
  "misalignment-wrong-life":      "philosophy",
  "direction-purpose-drift":      "philosophy",
  "disconnection-inner-noise":    "philosophy",
};

/**
 * Tag keywords that signal a content type.
 * Checked in priority order: creator -> nervous-system -> earthstar -> philosophy.
 */
const TAG_SIGNALS = {
  creator:          ["ai", "tools", "automation", "music", "creator", "workflow", "software", "tech", "Claude", "production"],
  "nervous-system": ["adhd", "nervous-system", "anxiety", "dopamine", "neurodivergent", "dysregulation", "healing", "regulation"],
  earthstar:        ["earthstar", "earth-star", "empower", "initiative", "sacred-geometry"],
  philosophy:       ["philosophy", "mindset", "spiritual", "consciousness", "awareness", "purpose", "reflection", "personal", "identity"],
};

/**
 * Detect the content type of a post from its metadata.
 *
 * Priority order:
 *   1. post.niche field (EarthStar niche slug ~ most reliable)
 *   2. post.tags array (keyword signal detection)
 *   3. post.lane default (matt lane = philosophy)
 *   4. "general" fallback
 *
 * @param {object} post - Post metadata { niche?, tags?, lane? }
 * @returns {string} One of: creator, philosophy, nervous-system, earthstar, general
 */
export function detectContentType(post) {
  // 1. Explicit niche field
  if (post.niche && NICHE_TO_TYPE[post.niche]) {
    return NICHE_TO_TYPE[post.niche];
  }

  // 2. Tag-based signal detection (priority order matters)
  const tags = (post.tags || []).map(t => String(t).toLowerCase().trim());
  for (const [type, signals] of Object.entries(TAG_SIGNALS)) {
    if (tags.some(tag => signals.includes(tag))) return type;
  }

  // 3. Lane default ~ Matt lane is personal/philosophical by design
  if (post.lane === "matt") return "philosophy";

  return "general";
}

// ─────────────────────────────────────────────────────────────────
// SOCIAL PLATFORM ROUTING
// ─────────────────────────────────────────────────────────────────

/**
 * Social platform routing by content type.
 *
 * Design principles (see syndication-policy-v1.md for full rationale):
 *   facebook_earthstar ~ EarthStar content only (video engine owns this page)
 *   instagram          ~ creator/earthstar only (video engine primary)
 *   pinterest          ~ evergreen/visual content only (skip philosophy + nervous-system)
 *   bluesky + mastodon ~ all content types (open platforms, philosophical community)
 *   threads            ~ all content types (high spam tolerance)
 *   facebook_voa       ~ all except suppressed-by-type content
 */
const SOCIAL_ROUTING = {
  creator: [
    "bluesky_esr", "bluesky_voa",
    "mastodon_esr", "mastodon_voa",
    "facebook_voa",
    "pinterest",
    "threads",
    "instagram",
  ],
  philosophy: [
    "bluesky_esr", "bluesky_voa",
    "mastodon_esr", "mastodon_voa",
    "facebook_voa",
    "threads",
  ],
  "nervous-system": [
    "bluesky_esr", "bluesky_voa",
    "mastodon_esr", "mastodon_voa",
    "facebook_voa",
    "threads",
  ],
  earthstar: [
    "bluesky_esr", "bluesky_voa",
    "mastodon_esr", "mastodon_voa",
    "facebook_voa", "facebook_earthstar",
    "pinterest",
    "threads",
  ],
  general: [
    "bluesky_esr", "bluesky_voa",
    "mastodon_esr", "mastodon_voa",
    "facebook_voa",
    "pinterest",
    "threads",
  ],
};

/**
 * Get the social platforms appropriate for this content type.
 *
 * @param {string} contentType - From detectContentType()
 * @returns {string[]} Platform keys to include in social syndication
 */
export function getSocialPlatforms(contentType) {
  return SOCIAL_ROUTING[contentType] || SOCIAL_ROUTING.general;
}

// ─────────────────────────────────────────────────────────────────
// SUPPRESSION REASONS (for logging)
// ─────────────────────────────────────────────────────────────────

const SUPPRESS_REASONS = {
  facebook_earthstar: "video engine primary ~ EarthStar content only",
  instagram:          "video engine primary ~ creator content only",
  pinterest:          "visual/evergreen platform ~ skip philosophy and nervous-system",
};

function getSuppressionReason(platform) {
  return SUPPRESS_REASONS[platform] || "content type routing";
}

// ─────────────────────────────────────────────────────────────────
// POLICY DECISION LOGGING
// ─────────────────────────────────────────────────────────────────

/**
 * Log the full policy decision to stdout so it appears in CI workflow logs.
 * Shows backlink tier, active social platforms, and suppressed platforms with reasons.
 *
 * @param {object}   post           - Post metadata
 * @param {string}   contentType    - Detected content type
 * @param {string[]} socialPlatforms - Active social platforms after routing
 * @param {string}   [suggestedCta] - Optional CTA label for this post
 */
export function logPolicyDecision(post, contentType, socialPlatforms, suggestedCta) {
  const suppressed = ALL_SOCIAL.filter(p => !socialPlatforms.includes(p));

  console.log("\n╔═ [policy] Syndication Policy ══════════════════════");
  console.log(`║  Post:         "${post.title}"`);
  console.log(`║  Lane:         ${post.lane || "unknown"}`);
  console.log(`║  Niche:        ${post.niche || "none"}`);
  console.log(`║  Content type: ${contentType}`);
  if (suggestedCta) {
    console.log(`║  Suggested CTA: ${suggestedCta}`);
  }
  console.log("║");
  console.log("║  Backlink tier (always):");
  BACKLINK_TIER.forEach(p => console.log(`║    + ${p}`));
  console.log("║");
  console.log("║  Social destinations:");
  if (socialPlatforms.length) {
    socialPlatforms.forEach(p => console.log(`║    + ${p}`));
  } else {
    console.log("║    (none ~ use --all-social to override)");
  }
  if (suppressed.length) {
    console.log("║");
    console.log("║  Suppressed social:");
    suppressed.forEach(p =>
      console.log(`║    ~ ${p}  (${getSuppressionReason(p)})`)
    );
  }
  console.log("╚════════════════════════════════════════════════════\n");
}

// ─────────────────────────────────────────────────────────────────
// CTA ROTATION
// ─────────────────────────────────────────────────────────────────

/**
 * CTA pool ~ rotates to avoid link fatigue and repetitive patterns.
 * Field Guide is the primary CTA but should not appear in every post.
 */
const CTA_POOL = [
  {
    id:    "field-guide",
    label: "Field Guide",
    url:   "https://vibrationofawesome.com/field-guide/",
    text:  "Start with the Field Guide",
  },
  {
    id:    "art-store",
    label: "Art Store",
    url:   "https://vibrationofawesome.com/art-store/",
    text:  "Browse the EarthStar Art Store",
  },
  {
    id:    "aura",
    label: "AURA",
    url:   "https://vibrationofawesome.com/aura/",
    text:  "Talk to AURA",
  },
  {
    id:    "blog",
    label: "Blog",
    url:   "https://vibrationofawesome.com/blog/",
    text:  "Read more on the blog",
  },
  {
    id:    "earthstar",
    label: "EarthStar Initiative",
    url:   "https://vibrationofawesome.com/earthstar/",
    text:  "Explore the EarthStar Initiative",
  },
];

/**
 * Get the next CTA from the rotation pool.
 * Rotation state is persisted per lane in static/_data/cta-rotation-state.json.
 *
 * @param {string} lane - "matt" or "boom" (separate rotation index per lane)
 * @returns {{ id: string, label: string, url: string, text: string }}
 */
export function getNextCTA(lane = "boom") {
  const stateFile = path.join(DATA_DIR, "cta-rotation-state.json");
  let state = {};

  try {
    if (fs.existsSync(stateFile)) {
      state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    }
  } catch (_) { /* start fresh */ }

  const key     = `last_${lane}`;
  const lastIdx = typeof state[key] === "number" ? state[key] : -1;
  const nextIdx = (lastIdx + 1) % CTA_POOL.length;

  state[key]        = nextIdx;
  state.lastUpdated = new Date().toISOString();

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn(`[policy] Could not save CTA rotation state: ${err.message}`);
  }

  return CTA_POOL[nextIdx];
}

// ─────────────────────────────────────────────────────────────────
// QUOTA + COOLDOWN (informational ~ enforcement in v2)
// ─────────────────────────────────────────────────────────────────

/** Safe maximum posts per day per platform (both engines combined) */
const DAILY_QUOTAS = {
  facebook_voa:        2,
  facebook_earthstar:  2,
  instagram:           2,
  threads:             4,
  mastodon_esr:        5,
  mastodon_voa:        5,
  bluesky_esr:         5,
  bluesky_voa:         5,
  pinterest:          10,
  tumblr_esr:         10,
  tumblr_voa:         10,
  devto:               1,
  blogger:             1,
  wordpress_earthstar: 1,
};

/** Minimum hours between posts to same platform (both engines combined) */
const COOLDOWN_HOURS = {
  facebook_voa:       6,
  facebook_earthstar: 6,
  instagram:          8,
  threads:            4,
  mastodon_esr:       2,
  mastodon_voa:       2,
  bluesky_esr:        2,
  bluesky_voa:        2,
  pinterest:          2,
  tumblr_esr:         1,
  tumblr_voa:         1,
};

/**
 * Get the safe daily post quota for a platform.
 * @param {string} platform - Platform key
 * @returns {number} Maximum posts per day
 */
export function getDailyQuota(platform) {
  return DAILY_QUOTAS[platform] ?? 3;
}

/**
 * Get the minimum cooldown between posts for a platform (hours).
 * @param {string} platform - Platform key
 * @returns {number} Hours
 */
export function getCooldownHours(platform) {
  return COOLDOWN_HOURS[platform] ?? 3;
}

/**
 * Check if a platform is eligible to receive a post now.
 *
 * v1: always returns true ~ quota/cooldown is logged but not enforced.
 * v2: will read syndication-log.json and enforce limits.
 *
 * @param {string}   platform    - Platform key
 * @param {object[]} recentPosts - Recent syndication log entries
 * @returns {boolean}
 */
export function isSocialEligible(platform, recentPosts = []) {
  // Phase 2: enforce quota and cooldown using recentPosts
  return true;
}
