/**
 * instagram-archetypes.js — VOA Instagram visual ecosystem
 *
 * Defines 8 distinct visual archetypes for VOA Instagram content.
 * Each archetype has its own palette, layout, Ideogram style, and emotional DNA.
 * The selection engine rotates through archetypes using recency-penalized scoring
 * to ensure the feed reads as a living, varied, intentional consciousness magazine.
 *
 * Design principle: "modern consciousness magazine" not "repost automation"
 *
 * All archetypes:
 *   - Feel cinematic, philosophical, and premium
 *   - Are emotionally intelligent and spiritually modern
 *   - Avoid motivational poster energy, generic AI aesthetics, hustle culture
 *   - Hold VOA's visual DNA: deep dark backgrounds, teal/cyan accent, liminal feeling
 *
 * Used by: scripts/generate-instagram-visual.js
 * History: scripts/lib/generation-memory.js → static/_data/generation-memory.json
 */

export const INSTAGRAM_ARCHETYPES = [
  {
    id:                  "premium-quote-card",
    label:               "Premium Quote Card",
    palette:             "teal-on-dark",
    layout:              "typography-forward",
    emotionalTone:       "clarity",
    emotionalCluster:    "intellectual",
    ideogramStyle:       "DESIGN",
    contentTypeAffinity: ["philosophy", "general", "creator"],
    description:         "Typography-forward. High-contrast. One resonant sentence or fragment. Editorial, not motivational.",
    visualDNA:           "Dark background (#020a0a to #030d0d). Teal accent (#00e5cc). Clean editorial typography. Minimal layout. Negative space is intentional. Think: a page from a consciousness magazine.",
    promptGuidance:      "Prioritize: typographic elegance, dark atmosphere, single resonant phrase, premium editorial feel. Avoid: motivational poster energy, bright colors, cluttered text.",
    avoidWith:           ["minimalist-philosophy"], // don't pair back-to-back (similar palette)
  },
  {
    id:                  "cinematic-ideogram",
    label:               "Cinematic Artwork",
    palette:             "painterly-dark",
    layout:              "environmental-scene",
    emotionalTone:       "liminal",
    emotionalCluster:    "atmospheric",
    ideogramStyle:       "REALISTIC",
    contentTypeAffinity: ["earthstar", "philosophy", "nervous-system"],
    description:         "Full painterly scene. Cinematic lighting. Liminal space. Minimal or no text. Emotionally evocative and wordless.",
    visualDNA:           "A threshold moment. Human in a vast environment. Bioluminescent quality. Deep time aesthetic. The moment before something shifts. Ancient textures: water, stone, deep forest, coastline.",
    promptGuidance:      "Prioritize: liminal atmosphere, painterly quality, cinematic lighting from within the subject, solitary but not lonely. Minimal text overlay — let the image speak. No stock photo feeling.",
    avoidWith:           ["nervous-system-atmospheric"], // both painterly, give space between
  },
  {
    id:                  "symbolic-consciousness",
    label:               "Symbolic Consciousness",
    palette:             "cosmic-teal",
    layout:              "abstract-centered",
    emotionalTone:       "cosmic",
    emotionalCluster:    "mystical",
    ideogramStyle:       "DESIGN",
    contentTypeAffinity: ["earthstar", "philosophy", "creator"],
    description:         "Abstract symbolic imagery. Consciousness metaphors. Sacred geometry suggestions without being literal. Stars, deep ocean, forest light.",
    visualDNA:           "Consciousness rendered visually. Starfields, neural networks that look organic, sacred geometry suggestions, deep ocean floor, root systems, mycelium patterns. The macro and micro reflecting each other.",
    promptGuidance:      "Prioritize: abstraction, symbolic resonance, cosmic scale suggestions, organic sacred geometry. Include a subtle text overlay (4-7 words). Avoid: literal symbols, New Age clichés.",
    avoidWith:           [],
  },
  {
    id:                  "minimalist-philosophy",
    label:               "Minimalist Philosophy",
    palette:             "near-black-accent",
    layout:              "vast-negative-space",
    emotionalTone:       "stillness",
    emotionalCluster:    "intellectual",
    ideogramStyle:       "DESIGN",
    contentTypeAffinity: ["philosophy", "nervous-system", "general"],
    description:         "Ultra-minimal. One meaningful object. Vast negative space. One or two words maximum. The restraint is the message.",
    visualDNA:           "A single object imbued with meaning. A candle. A stone. A threshold. A door left ajar. A window. The object exists in a sea of dark space. Almost nothing = everything.",
    promptGuidance:      "Prioritize: extreme minimalism, single meaningful object or element, vast dark negative space, quiet restraint. Maximum 2-word overlay if any. No visual noise.",
    avoidWith:           ["premium-quote-card"], // similar palette direction
  },
  {
    id:                  "field-guide-aesthetic",
    label:               "Field Guide Aesthetic",
    palette:             "warm-archive",
    layout:              "editorial-artifact",
    emotionalTone:       "quiet-discovery",
    emotionalCluster:    "grounded",
    ideogramStyle:       "DESIGN",
    contentTypeAffinity: ["creator", "philosophy", "general"],
    description:         "Archive and journal aesthetic. Tactile, analog, warm within the VOA palette. Field notes. Quiet observation. Discovery as a daily practice.",
    visualDNA:           "Journal pages, hand-drawn botanical-style elements, field observation notes, taxonomy of feeling, library aesthetics, pressed plants. Warm tones (amber, ochre) balanced with teal. Aged textures.",
    promptGuidance:      "Prioritize: analog texture, archival quality, warm editorial tones, quiet discovery feeling. Think naturalist's field journal meets consciousness research. Tactile over digital.",
    avoidWith:           [],
  },
  {
    id:                  "nervous-system-atmospheric",
    label:               "Nervous System Atmospheric",
    palette:             "soft-teal-mist",
    layout:              "breathing-space",
    emotionalTone:       "regulation",
    emotionalCluster:    "somatic",
    ideogramStyle:       "REALISTIC",
    contentTypeAffinity: ["nervous-system", "philosophy", "general"],
    description:         "Calming but not clinical. Water, breath, stillness. Soft focus. Grounded and embodied. Regulation made visible.",
    visualDNA:           "Calm water surface. Morning mist on a lake. Slow breath. Roots meeting earth. The body at rest in nature. Soft teal and deep green. Gentle light. Everything slowed down.",
    promptGuidance:      "Prioritize: softness, calm atmosphere, natural grounding elements, breath-like quality. Avoid: clinical, medical, or overly therapeutic aesthetics. This should feel like exhaling.",
    avoidWith:           ["cinematic-ideogram"], // give space between painterly realism styles
  },
  {
    id:                  "abstract-creator-life",
    label:               "Abstract Creator Life",
    palette:             "studio-cyan",
    layout:              "process-frame",
    emotionalTone:       "craft",
    emotionalCluster:    "grounded",
    ideogramStyle:       "DESIGN",
    contentTypeAffinity: ["creator", "general", "earthstar"],
    description:         "Creative process made visual. Studio light, instruments, code, hands at work. Specificity over generic 'creator'. Making something real.",
    visualDNA:           "A musician's hands. A studio at 2am. Circuit boards meeting analog warmth. Cables and instruments. Code on screen reflected in eyes. The craft of making, the ritual of it.",
    promptGuidance:      "Prioritize: specificity of the creative act, authentic studio atmosphere, teal-lit workspace aesthetic, tools of making. Avoid: generic 'creator' stock imagery, laptop-on-beach energy.",
    avoidWith:           [],
  },
  {
    id:                  "sacred-tech",
    label:               "Sacred Tech / Consciousness-Tech",
    palette:             "circuit-teal",
    layout:              "organic-digital-hybrid",
    emotionalTone:       "emergence",
    emotionalCluster:    "mystical",
    ideogramStyle:       "DESIGN",
    contentTypeAffinity: ["creator", "earthstar", "general"],
    description:         "Technology meets consciousness. Circuit-meets-nature. Digital-organic hybrid. The EarthStar dimension of technology as a spiritual tool.",
    visualDNA:           "Neural networks that look like root systems. Circuit boards with growing things. Data as light, light as data. The machine that breathes. Technology in service of awareness, not distraction.",
    promptGuidance:      "Prioritize: circuit-meets-nature hybrid aesthetic, teal bioluminescence, organic-digital fusion, technology as consciousness. Avoid: sterile tech aesthetics, corporate futurism.",
    avoidWith:           ["symbolic-consciousness"], // similar mystical cluster
  },
];

// ── Palette groups (for repetition analysis) ─────────────────────────────────
// Archetypes within the same palette group should be spread apart.

export const PALETTE_GROUPS = {
  "dark-editorial":  ["premium-quote-card", "minimalist-philosophy"],
  "painterly-real":  ["cinematic-ideogram", "nervous-system-atmospheric"],
  "design-abstract": ["symbolic-consciousness", "sacred-tech"],
  "warm-grounded":   ["field-guide-aesthetic", "abstract-creator-life"],
};

// ── Emotional cluster groups ──────────────────────────────────────────────────
// Avoid repeating the same emotional cluster back-to-back.

export const EMOTIONAL_CLUSTERS = {
  intellectual: ["premium-quote-card", "minimalist-philosophy"],
  atmospheric:  ["cinematic-ideogram", "nervous-system-atmospheric"],
  mystical:     ["symbolic-consciousness", "sacred-tech"],
  grounded:     ["field-guide-aesthetic", "abstract-creator-life"],
};

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getInstagramArchetype(id) {
  return INSTAGRAM_ARCHETYPES.find(a => a.id === id) || null;
}

// ── Format selection ──────────────────────────────────────────────────────────

// Recency penalties (index 0 = most recent)
const RECENCY_PENALTIES = [12, 6, 3, 2, 1, 0.5, 0.5, 0.3];

/**
 * Select the next Instagram archetype using recency-penalized rotation.
 *
 * Considers:
 *  - Format recency (avoid repeating recently used archetypes)
 *  - Palette group (avoid same palette cluster back-to-back)
 *  - Emotional cluster (avoid same emotional tone back-to-back)
 *  - Content-type affinity (mild preference for content-appropriate archetype)
 *  - avoidWith rules (never immediately follow a pairing-flagged archetype)
 *
 * @param {Array}  recentArchetypes - Array of recent { archetype, palette, emotionalCluster } entries
 * @param {string} [contentType]    - Post content type for affinity hint
 * @returns {object} An archetype from INSTAGRAM_ARCHETYPES
 */
export function selectInstagramArchetype(recentArchetypes = [], contentType = null) {
  const recentIds       = (recentArchetypes || []).slice(0, RECENCY_PENALTIES.length).map(e => e.archetype);
  const lastId          = recentIds[0] || null;
  const lastArchetype   = lastId ? getInstagramArchetype(lastId) : null;
  const lastPalette     = (recentArchetypes[0]?.palette) || null;
  const lastEmoCluster  = (recentArchetypes[0]?.emotionalCluster) || null;

  // Compute recency penalties
  const penalties = {};
  for (let i = 0; i < recentIds.length; i++) {
    const id = recentIds[i];
    penalties[id] = (penalties[id] || 0) + (RECENCY_PENALTIES[i] || 0);
  }

  const scored = INSTAGRAM_ARCHETYPES.map(a => {
    let score = penalties[a.id] || 0;

    // Hard avoid: avoidWith rules from the previous archetype
    if (lastArchetype?.avoidWith?.includes(a.id)) score += 8;

    // Palette cluster penalty: same palette group as last post
    const paletteGroup = Object.entries(PALETTE_GROUPS).find(([, ids]) => ids.includes(a.id))?.[0];
    const lastPaletteGroup = lastPalette
      ? Object.entries(PALETTE_GROUPS).find(([, ids]) => ids.includes(lastId))?.[0]
      : null;
    if (paletteGroup && paletteGroup === lastPaletteGroup) score += 3;

    // Emotional cluster penalty: same cluster as last post
    const emoCluster = Object.entries(EMOTIONAL_CLUSTERS).find(([, ids]) => ids.includes(a.id))?.[0];
    if (emoCluster && emoCluster === lastEmoCluster) score += 2;

    // Content-type affinity bonus (mild preference)
    if (contentType && a.contentTypeAffinity.includes(contentType)) score -= 0.7;

    // Random jitter to prevent deterministic lock-in
    score += Math.random() * 0.9;

    return { archetype: a, score };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0].archetype;
}

// ── Monotony analysis ─────────────────────────────────────────────────────────

/**
 * Analyze the recent Instagram archetype history for monotony and variety patterns.
 *
 * @param {Array} recentArchetypes - Array of recent { archetype, palette, emotionalCluster, ... }
 * @returns {{ warnings: string[], summary: string, diversity: object }}
 */
export function analyzeInstagramMonotony(recentArchetypes = []) {
  const recent = (recentArchetypes || []).slice(0, 10);
  const warnings = [];

  if (recent.length < 2) {
    return {
      warnings,
      summary:   "Insufficient history — fewer than 2 Instagram posts recorded.",
      diversity: buildDiversityReport(recent),
    };
  }

  // Back-to-back archetype repeat
  if (recent[0]?.archetype === recent[1]?.archetype) {
    warnings.push(`ARCHETYPE REPEAT: "${recent[0].archetype}" used back-to-back`);
  }

  // Same archetype 3+ times in last 6
  if (recent.length >= 6) {
    const last6 = recent.slice(0, 6).map(e => e.archetype);
    for (const arch of INSTAGRAM_ARCHETYPES) {
      const count = last6.filter(id => id === arch.id).length;
      if (count >= 3) warnings.push(`ARCHETYPE OVERUSE: "${arch.id}" appears ${count}/6 recent posts`);
    }
  }

  // Same palette group 3 in a row
  if (recent.length >= 3) {
    const lastThreePalettes = recent.slice(0, 3).map(e => e.palette);
    if (new Set(lastThreePalettes).size === 1) {
      warnings.push(`PALETTE MONOTONY: "${lastThreePalettes[0]}" palette 3 posts in a row`);
    }
  }

  // Same emotional cluster 3 in a row
  if (recent.length >= 3) {
    const lastThreeEmo = recent.slice(0, 3).map(e => e.emotionalCluster);
    if (new Set(lastThreeEmo).size === 1) {
      warnings.push(`TONE MONOTONY: "${lastThreeEmo[0]}" emotional cluster 3 posts in a row`);
    }
  }

  // avoidWith violations
  if (recent.length >= 2) {
    const currentArch = getInstagramArchetype(recent[0]?.archetype);
    if (currentArch?.avoidWith?.includes(recent[1]?.archetype)) {
      warnings.push(`PAIRING VIOLATION: "${recent[0].archetype}" immediately followed "${recent[1].archetype}" — these pair poorly`);
    }
  }

  return {
    warnings,
    summary:   warnings.length === 0
      ? "Good variety — no monotony patterns detected."
      : `${warnings.length} monotony pattern(s) detected.`,
    diversity: buildDiversityReport(recent),
  };
}

function buildDiversityReport(recent) {
  const archetypeCounts = {};
  const paletteCounts   = {};
  const emoCounts       = {};

  for (const e of recent) {
    archetypeCounts[e.archetype]       = (archetypeCounts[e.archetype] || 0) + 1;
    paletteCounts[e.palette]           = (paletteCounts[e.palette] || 0) + 1;
    emoCounts[e.emotionalCluster]      = (emoCounts[e.emotionalCluster] || 0) + 1;
  }

  const uniqueArchetypes = Object.keys(archetypeCounts).length;
  const uniquePalettes   = Object.keys(paletteCounts).length;
  const uniqueEmo        = Object.keys(emoCounts).length;
  const totalArchetypes  = INSTAGRAM_ARCHETYPES.length;

  return {
    totalPosts:       recent.length,
    uniqueArchetypes,
    uniquePalettes,
    uniqueEmoClusters: uniqueEmo,
    archetypeCoverage: `${uniqueArchetypes}/${totalArchetypes}`,
    archetypeCounts,
    paletteCounts,
    emoCounts,
  };
}
