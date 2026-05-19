/**
 * threads-formats.js ~ VOA Threads native variety system
 *
 * Defines 8 structural archetypes for VOA Threads content. Each format has
 * distinct cadence, section count, opening style, and closing approach.
 * The format selector uses recent generation history to prevent structural monotony.
 *
 * All formats inherit the VOA quality rules (no third-person, no promo language,
 * no hashtags unless genuinely useful, no repeated openings). Format-specific
 * instructions add structural and tonal variation on top of that baseline.
 *
 * Used by: scripts/generate-captions.js
 * History: scripts/lib/generation-memory.js → static/_data/generation-memory.json
 */

// ── Base quality rules inherited by every format ───────────────────────────────
// These are always injected regardless of format choice.
const BASE_RULES = `
Write in first person or direct observation. Never refer to Matt in third person.
Never mention "this article", "this post", "this write-up", "this piece", or "wrote about."
Never use "read more", "learn more", or "check out" language.
No guru cadence. No generic self-help language. No fake profundity.
Zero hashtags unless one is genuinely useful and specific.
No em-dashes. Vary sentence rhythm.
URL appears only in the final section and is placed without "read more" energy.
`.trim();

// ── Format definitions ────────────────────────────────────────────────────────

export const THREADS_FORMATS = [
  {
    id:             "reflective-essay",
    label:          "Reflective Mini Essay",
    cadenceProfile: "slow-layered",
    density:        "dense",
    sectionRange:   [3, 4],
    mode:           "thread",
    openerStyle:    "grounded-observation",
    closerStyle:    "quiet-wisdom",
    description:    "Layered, thoughtful, emotionally intelligent. The current strongest baseline.",
    structuralNote: "3-4 sections. Each section deepens the thought rather than pivoting. Dense but not heavy ~ the kind of thing someone reads twice.",
    instruction: `Write a reflective mini-essay thread. Use 3-4 numbered sections (1/N through N/N, where N matches the actual count). Target 650-950 chars total. Opens with a grounded observation from lived experience. Each section deepens the central thought ~ no pivoting to a new idea. Section lengths can vary; let the thought breathe. Closes with quiet earned insight, not a summary, not a CTA. Dense but not heavy.`,
  },

  {
    id:             "philosophical-observation",
    label:          "Philosophical Observation",
    cadenceProfile: "contemplative",
    density:        "medium-dense",
    sectionRange:   [2, 3],
    mode:           "thread",
    openerStyle:    "conceptual-paradox",
    closerStyle:    "open-question",
    description:    "Conceptual, slow-paced, idea-driven. May end without resolution.",
    structuralNote: "2-3 sections. Opens with a conceptual statement or a useful paradox. Unhurried ~ ideas accumulate. Can end with an unresolved question rather than a clean answer.",
    instruction: `Write a philosophical observation thread. Use 2-3 numbered sections (1/N through N/N). Target 550-850 chars total. Opens with a conceptual statement or a productive paradox that creates thinking space. Pacing is unhurried ~ each section adds a layer of meaning rather than rushing toward conclusion. May close with an unresolved question rather than a resolution. That incompleteness is intentional.`,
  },

  {
    id:             "creative-identity-reflection",
    label:          "Creative / Identity Reflection",
    cadenceProfile: "lyrical",
    density:        "medium",
    sectionRange:   [2, 3],
    mode:           "thread",
    openerStyle:    "identity-confession",
    closerStyle:    "invitation",
    description:    "Artistic, identity-oriented, emotionally honest. For creator/AI/music content.",
    structuralNote: "2-3 sections. Opens with a creative truth or identity confession. Language can be slightly lyrical but stays grounded. Closes with an invitation or a quiet affirmation of the creative path.",
    instruction: `Write a creative identity reflection thread. Use 2-3 numbered sections (1/N through N/N). Target 550-800 chars total. Centered on creative identity, the creator experience, or what it means to build something real. Opens with a personal truth or creative confession. Language can be slightly lyrical but stays grounded and specific. Closes with something that feels like an invitation ~ a door held open rather than a conclusion shut.`,
  },

  {
    id:             "tension-revelation",
    label:          "Tension / Revelation Thread",
    cadenceProfile: "tension-then-release",
    density:        "medium-dense",
    sectionRange:   [3, 4],
    mode:           "thread",
    openerStyle:    "contradiction",
    closerStyle:    "earned-realization",
    description:    "Opens with contradiction or honest tension. Unfolds into an emotionally satisfying realization.",
    structuralNote: "3-4 sections. Opens with a contradiction or an impossible-feeling statement. Middle sections sit in the tension without rushing to resolve. Final section delivers a reframe that feels earned ~ satisfying without being tidy.",
    instruction: `Write a tension-revelation thread. Use 3-4 numbered sections (1/N through N/N). Target 650-950 chars total. Opens with a contradiction, impossible-feeling statement, or honest tension. The middle sections live in the tension without rushing to resolve it. The final section delivers a realization or reframe that feels earned ~ emotionally satisfying without being tidy or preachy. The resolution should surprise slightly.`,
  },

  {
    id:             "conversational-reflection",
    label:          "Conversational Reflection",
    cadenceProfile: "casual-spoken",
    density:        "light-medium",
    sectionRange:   [2, 4],
    mode:           "thread",
    openerStyle:    "mid-conversation",
    closerStyle:    "natural-landing",
    description:    "Natural spoken cadence. Sounds like a real person thinking out loud.",
    structuralNote: "2-4 sections (shorter sections fine ~ not every section needs equal weight). Sounds like mid-conversation. Looser structure. Can end where the thought naturally lands, not where it's polished to end.",
    instruction: `Write a conversational reflection thread. Use 2-4 sections (shorter sections are fine; not every section needs to carry equal weight). Target 500-850 chars total. Sounds like a real person thinking out loud mid-conversation. Less formal structure ~ let sections be uneven in length if that's where the thought goes. Can end where the thought naturally lands rather than where it's polished to land. The looseness is part of it.`,
  },

  {
    id:             "short-native-insight",
    label:          "Short Native Insight",
    cadenceProfile: "compact",
    density:        "light",
    sectionRange:   [1, 2],
    mode:           "thread",
    openerStyle:    "direct",
    closerStyle:    "resonant",
    description:    "Shorter but meaningfully complete. Not a shallow quote post.",
    structuralNote: "1-2 sections only. Dense meaning in compact form ~ not a quote card, not a teaser. If 2 sections, the second deepens the first. May omit URL if 1 section and the URL feels forced.",
    instruction: `Write a short native insight. Use 1-2 sections only (use "1/1" for a single section or "1/2" and "2/2" for two). Target 300-550 chars total. Not a shallow quote post ~ a complete, meaningful thought that doesn't need more space. Dense meaning in compact form. The kind of thing that makes someone stop scrolling without trying to. If 2 sections, the second deepens the first. If 1 section, it stands fully on its own. May omit the URL if a single section and adding it would feel forced.`,
  },

  {
    id:             "manifesto-conviction",
    label:          "Manifesto / Conviction Style",
    cadenceProfile: "charged-decisive",
    density:        "medium-dense",
    sectionRange:   [3, 4],
    mode:           "thread",
    openerStyle:    "strong-declarative",
    closerStyle:    "worldview-shift",
    description:    "Strong worldview energy. Decisive, emotionally charged, still human.",
    structuralNote: "3-4 sections. Opens with a declarative statement reflecting a genuine belief. Not aggressive ~ decisive. The voice of someone who has thought this through and arrived somewhere real. Builds across sections. Closes with something that shifts how the reader sees the topic.",
    instruction: `Write a manifesto / conviction style thread. Use 3-4 numbered sections (1/N through N/N). Target 650-950 chars total. Opens with a strong declarative statement reflecting a genuine belief. The tone is decisive and emotionally charged ~ not aggressive, but the voice of someone who has actually thought this through. Pacing builds across sections. Closes with something that shifts how the reader sees the topic, not just a summary of what was said.`,
  },

  {
    id:             "single-native-post",
    label:          "Single Native Post",
    cadenceProfile: "standalone",
    density:        "medium",
    sectionRange:   [1, 1],
    mode:           "single",
    openerStyle:    "any",
    closerStyle:    "complete",
    description:    "Not every concept requires a numbered thread. One cohesive post with depth.",
    structuralNote: "One post, no 1/N numbering. Must feel complete rather than truncated. Any tone. Up to 450 chars including URL.",
    instruction: `Write a single native Threads post. NOT a numbered thread ~ no 1/N formatting at all. One cohesive piece of writing that stands fully on its own. Up to 450 characters total including the URL. Any tone, any structure. Must feel complete rather than like a truncated thread or a caption. Include the URL naturally in the text ~ not as a trailing footnote.`,
  },
];

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getThreadsFormat(id) {
  return THREADS_FORMATS.find(f => f.id === id) || null;
}

// ── Instruction builder ───────────────────────────────────────────────────────

/**
 * Build the complete Claude instruction string for a given format.
 * Combines format-specific structural guidance with shared quality rules.
 */
export function buildThreadsInstruction(format) {
  return [
    `THREADS: ${format.instruction}`,
    "",
    BASE_RULES,
  ].join("\n");
}

// ── Format selection ──────────────────────────────────────────────────────────

// Recency penalties: index 0 = most recent, index 1 = second most recent, etc.
const RECENCY_PENALTIES = [12, 6, 3, 2, 1, 0.5, 0.5, 0.3, 0.2, 0.1];

/**
 * Select the next Threads format using recency-penalized rotation.
 * Formats used recently receive higher penalty scores; the format with the
 * lowest total score is selected. Jitter prevents lock-in on a single runner-up.
 *
 * @param {Array} recentFormats - Array of recent { format, cadenceProfile, density } entries
 * @param {string} [contentType] - Optional: "creator" | "nervous-system" | etc. for mild preference
 * @returns {object} A format definition from THREADS_FORMATS
 */
export function selectThreadsFormat(recentFormats = [], contentType = null) {
  const recentIds = (recentFormats || []).slice(0, RECENCY_PENALTIES.length).map(e => e.format);

  // Compute total penalty per format based on how recently it was used
  const penalties = {};
  for (let i = 0; i < recentIds.length; i++) {
    const id = recentIds[i];
    penalties[id] = (penalties[id] || 0) + (RECENCY_PENALTIES[i] || 0);
  }

  const scored = THREADS_FORMATS.map(f => ({
    format: f,
    // Base recency score + small random jitter (0-0.8) to break ties
    score: (penalties[f.id] || 0) + (Math.random() * 0.8),
  }));

  // Apply mild content-type affinity (reduces score by 0.5 for good-fit formats)
  if (contentType) {
    const affinityMap = {
      creator:          ["creative-identity-reflection", "manifesto-conviction", "reflective-essay"],
      "nervous-system": ["conversational-reflection", "philosophical-observation", "short-native-insight"],
      philosophy:       ["philosophical-observation", "tension-revelation", "reflective-essay"],
      earthstar:        ["manifesto-conviction", "tension-revelation", "creative-identity-reflection"],
      general:          [], // no preference
    };
    const preferred = affinityMap[contentType] || [];
    for (const s of scored) {
      if (preferred.includes(s.format.id)) s.score -= 0.5;
    }
  }

  scored.sort((a, b) => a.score - b.score);
  return scored[0].format;
}

// ── Monotony analysis ─────────────────────────────────────────────────────────

/**
 * Analyze the recent Threads format history for monotony patterns.
 * Returns a list of warnings and a summary string.
 *
 * @param {Array} recentFormats - Array of recent { format, cadenceProfile, density, openerStyle, closerStyle }
 * @returns {{ warnings: string[], summary: string, recentSnapshot: object }}
 */
export function analyzeFormatMonotony(recentFormats = []) {
  const recent = (recentFormats || []).slice(0, 8);
  const warnings = [];

  if (recent.length < 2) {
    return {
      warnings,
      summary: "Insufficient history ~ fewer than 2 Threads posts recorded.",
      recentSnapshot: buildSnapshot(recent),
    };
  }

  // Format repetition: same format back-to-back
  if (recent[0]?.format === recent[1]?.format) {
    warnings.push(`FORMAT REPEAT: "${recent[0].format}" used twice in a row`);
  }

  // Same format 3 times in last 5
  if (recent.length >= 5) {
    const last5 = recent.slice(0, 5).map(e => e.format);
    for (const fmt of THREADS_FORMATS) {
      const count = last5.filter(id => id === fmt.id).length;
      if (count >= 3) warnings.push(`FORMAT OVERUSE: "${fmt.id}" appears ${count}/5 recent posts`);
    }
  }

  // Cadence monotony: same cadenceProfile 3 in a row
  if (recent.length >= 3) {
    const cadences = recent.slice(0, 3).map(e => e.cadenceProfile);
    if (new Set(cadences).size === 1) {
      warnings.push(`CADENCE MONOTONY: "${cadences[0]}" cadence 3 posts in a row`);
    }
  }

  // Density monotony: same density 4 in a row
  if (recent.length >= 4) {
    const densities = recent.slice(0, 4).map(e => e.density);
    if (new Set(densities).size === 1) {
      warnings.push(`DENSITY MONOTONY: "${densities[0]}" density 4 posts in a row`);
    }
  }

  // Opener monotony: same opener style 3 in a row
  if (recent.length >= 3) {
    const openers = recent.slice(0, 3).map(e => e.openerStyle).filter(o => o && o !== "any");
    if (openers.length === 3 && new Set(openers).size === 1) {
      warnings.push(`OPENER MONOTONY: "${openers[0]}" opener style 3 posts in a row`);
    }
  }

  // Thread-only monotony: all recent are threaded (never single-post)
  if (recent.length >= 6) {
    const modes = recent.slice(0, 6).map(e => {
      const fmt = getThreadsFormat(e.format);
      return fmt?.mode || "thread";
    });
    if (!modes.includes("single")) {
      warnings.push(`MODE MONOTONY: no "single-native-post" in last 6 generations ~ consider mixing in standalone posts`);
    }
  }

  return {
    warnings,
    summary: warnings.length === 0
      ? "Good variety ~ no monotony patterns detected."
      : `${warnings.length} monotony pattern(s) detected.`,
    recentSnapshot: buildSnapshot(recent),
  };
}

function buildSnapshot(recent) {
  return {
    formats:       recent.slice(0, 6).map(e => e.format),
    cadences:      recent.slice(0, 6).map(e => e.cadenceProfile),
    densities:     recent.slice(0, 6).map(e => e.density),
    openerStyles:  recent.slice(0, 6).map(e => e.openerStyle),
  };
}
