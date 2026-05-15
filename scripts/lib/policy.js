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
// PUBLER ACCOUNT OWNERSHIP
// ─────────────────────────────────────────────────────────────────

/**
 * Expected Publer account IDs for VOA-owned accounts.
 * Used by syndicate.js to log whether the configured account ID
 * matches the known VOA account or an unexpected (ESR/other) account.
 * Update these if accounts are disconnected and reconnected in Publer.
 */
export const PUBLER_VOA_ACCOUNT_IDS = {
  instagram: "6a0698ee1f0e47d9f3f18a43",  // VOA Instagram
  threads:   "6a069b7979cc0b32f3235166",  // VOA Threads
  pinterest: "6a052b620ce3c7cac0c7ebac",  // VOA Pinterest (@awesomevibe)
};

/**
 * Return "VOA", "ESR", or "unknown" for a given Publer platform
 * based on the env var currently configured.
 */
export function publerAccountOwnership(platform) {
  const id = (process.env[`PUBLER_${platform.toUpperCase()}_ACCOUNT_ID`] || "").trim();
  if (!id) return "auto-detect";
  if (PUBLER_VOA_ACCOUNT_IDS[platform] === id) return "VOA";
  return "unknown ~ verify PUBLER_" + platform.toUpperCase() + "_ACCOUNT_ID";
}

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
  "tumblr_voa",
  "blogger",
  "wordpress_earthstar",
];

/**
 * VOA-owned social platforms the blog engine may post to.
 * ESR (EarthStar Rising) accounts are NOT listed here ~
 * they belong to the EarthStar Command engine.
 *
 * Facebook EarthStar is intentionally excluded from VOA blog routing.
 * ESR/Facebook video strategy will be wired through the ESR engine later.
 *
 * TODO (crossover v2): if VOA posts should ever crosspost to ESR Bluesky
 * or ESR Mastodon, add a dedicated crossover flag to the policy routing
 * rather than adding them back to ALL_SOCIAL.
 */
export const ALL_SOCIAL = [
  "bluesky_voa",
  "mastodon_voa",
  "facebook_voa",
  "threads",
  "pinterest",
  "instagram",
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
 * VOA blog routes ONLY to VOA-owned social accounts by default.
 * ESR (EarthStar Rising) accounts ~ bluesky_esr, mastodon_esr ~ are owned
 * by the EarthStar Command engine and are NOT included here.
 *
 * Platform notes:
 *   bluesky_voa       ~ VOA Bluesky, all content types
 *   mastodon_voa      ~ VOA Mastodon, all content types
 *   facebook_voa      ~ VOA Facebook page, most content types
 *   pinterest         ~ evergreen/visual content only (skip philosophy + nervous-system)
 *   threads           ~ all content types, text-first mini-thread
 *
 * TODO (crossover v2): to add ESR Bluesky/Mastodon for specific content
 * types, add a crossover flag here rather than adding them to ALL_SOCIAL.
 */
const SOCIAL_ROUTING = {
  creator: [
    "bluesky_voa",
    "mastodon_voa",
    "facebook_voa",
    "pinterest",
    "threads",
    "instagram",       // creator/AI/tools content is Instagram-native
  ],
  philosophy: [
    "bluesky_voa",
    "mastodon_voa",
    "facebook_voa",
    "threads",
    "instagram",       // philosophical/identity content resonates on Instagram
  ],
  "nervous-system": [
    "bluesky_voa",
    "mastodon_voa",
    "facebook_voa",
    "threads",
    // no instagram ~ nervous-system content skews clinical, not visual
    // no pinterest ~ audience mode mismatch
  ],
  earthstar: [
    "bluesky_voa",
    "mastodon_voa",
    "facebook_voa", "facebook_earthstar",
    "pinterest",
    "threads",
    "instagram",       // EarthStar content is inherently visual/cosmic
  ],
  general: [
    "bluesky_voa",
    "mastodon_voa",
    "facebook_voa",
    "pinterest",
    "threads",
    // no instagram ~ general/unclassified content not worth a visual slot
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
  facebook_earthstar: "EarthStar crossover ~ earthstar content type only",
  instagram:          "visual/selective ~ creator, philosophy, earthstar content only",
  pinterest:          "visual/evergreen platform ~ skip philosophy and nervous-system",
  // ESR accounts are EarthStar Command territory, not VOA blog defaults
  bluesky_esr:        "EarthStar Command account ~ not VOA blog default",
  mastodon_esr:       "EarthStar Command account ~ not VOA blog default",
};

function getSuppressionReason(platform) {
  return SUPPRESS_REASONS[platform] || "content type routing";
}

// ─────────────────────────────────────────────────────────────────
// PINTEREST BOARD ROUTING
// ─────────────────────────────────────────────────────────────────

/**
 * VOA Pinterest board map.
 * Keys are stable board identifiers; values are the human-readable board names
 * exactly as they appear in the VOA Pinterest account.
 *
 * Board IDs are resolved at runtime via PUBLER_PINTEREST_BOARD_<KEY>_ID env vars
 * or the Publer media-options API fallback.
 *
 * To add a new board: add an entry here and set the corresponding env var.
 */
/**
 * VOA Pinterest strategy boards.
 * Keys are stable env-var slugs; values are the board names exactly as
 * they appear in the VOA Pinterest account (used for name-match fallback).
 *
 * Routing priority in getPublerPinterestBoardId():
 *   1. PUBLER_PINTEREST_BOARD_{KEY}_ID env var (fastest, no API call)
 *   2. Name-match from Publer media-options API
 *   3. PUBLER_PINTEREST_BOARD_DEFAULT_ID env var
 *   4. Hard-coded "Vibration of Awesome" board ID (641129765641663037)
 */
export const PINTEREST_BOARDS = {
  "purpose-and-direction":  "Purpose and Direction",
  "dopamine-detox":         "Dopamine Detox",
  "nervous-system-reset":   "Nervous System Reset",
  "conscious-creator-tools":"Conscious Creator Tools",
  "field-guide":            "Field Guide",
  "earthstar":              "EarthStar",
  "empower-thyself":        "Empower Thyself",
  // fallback board ~ always present on the VOA account
  "vibration-of-awesome":   "Vibration of Awesome",
};

/** Default board key when no specific rule matches */
const PINTEREST_DEFAULT_BOARD = "vibration-of-awesome";

/**
 * Rule-based board selection. Deterministic, no AI.
 *
 * Priority order:
 *   1. Niche slug (most specific)
 *   2. Tag keyword signals
 *   3. Content type
 *   4. Lane default
 *   5. PINTEREST_DEFAULT_BOARD fallback
 *
 * @param {object} post - Post metadata { niche?, tags?, lane?, title? }
 * @returns {string} Board key from PINTEREST_BOARDS
 */
export function selectPinterestBoard(post) {
  const niche = (post.niche || "").toLowerCase();
  const tags  = (post.tags || []).map(t => String(t).toLowerCase());
  const title = (post.title || "").toLowerCase();

  // 1. Niche-based rules (highest specificity)
  if (niche === "nervous-system-dysregulation" || niche === "dopamine-addiction-numbing") {
    if (niche === "dopamine-addiction-numbing") return "dopamine-detox";
    return "nervous-system-reset";
  }
  if (niche === "ai-creator-tools") return "conscious-creator-tools";
  if (niche === "direction-purpose-drift")  return "purpose-and-direction";
  if (niche === "disconnection-inner-noise") return "flow-state";
  // Philosophy niches map to the main VOA board
  if (["self-betrayal-avoidance", "misalignment-wrong-life"].includes(niche)) {
    return "vibration-of-awesome";
  }

  // 2. Tag-based signals (priority: dopamine > nervous-system > creator > earthstar > empower > field-guide > purpose)
  if (tags.some(t => ["dopamine", "dopamine-detox", "addiction", "numbing"].includes(t))) {
    return "dopamine-detox";
  }
  if (tags.some(t => ["nervous-system", "anxiety", "dysregulation", "adhd", "neurodivergent", "healing"].includes(t))) {
    return "nervous-system-reset";
  }
  if (tags.some(t => ["ai", "tools", "automation", "workflow", "creator", "music", "production"].includes(t))) {
    return "conscious-creator-tools";
  }
  if (tags.some(t => ["earthstar", "earth-star", "sacred-geometry"].includes(t))) {
    return "earthstar";
  }
  if (tags.some(t => ["empower", "empower-thyself", "sovereignty", "self-mastery", "initiation"].includes(t))) {
    return "empower-thyself";
  }
  if (tags.some(t => ["field-guide", "guide", "ebook", "download"].includes(t))) {
    return "field-guide";
  }
  if (tags.some(t => ["purpose", "direction", "calling", "clarity", "drift"].includes(t))) {
    return "purpose-and-direction";
  }

  // 3. Title keyword signals
  if (/dopamine|addiction|numb/.test(title))                          return "dopamine-detox";
  if (/nervous system|anxiety|adhd|dysregulation/.test(title))        return "nervous-system-reset";
  if (/ai tool|workflow|automat|creator tool/.test(title))            return "conscious-creator-tools";
  if (/earthstar|earth.?star/.test(title))                            return "earthstar";
  if (/empower|sovereignty|self.?master|initiation/.test(title))      return "empower-thyself";
  if (/field guide/.test(title))                                      return "field-guide";
  if (/purpose|direction|calling/.test(title))                        return "purpose-and-direction";

  // 4. Content type fallback
  const ct = detectContentType(post);
  if (ct === "creator")        return "conscious-creator-tools";
  if (ct === "nervous-system") return "nervous-system-reset";
  if (ct === "earthstar")      return "earthstar";

  // 5. Safe default
  return PINTEREST_DEFAULT_BOARD;
}

/**
 * Log the selected Pinterest board with routing reason.
 * @param {string} boardKey   - Key from PINTEREST_BOARDS
 * @param {string} reason     - Human-readable reason for selection
 */
export function logPinterestBoard(boardKey, reason) {
  const name = PINTEREST_BOARDS[boardKey] || boardKey;
  console.log(`  [pinterest-board] Selected: "${name}" (${reason})`);
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
