/**
 * generation-memory.js ~ Rolling generation registry for semantic differentiation
 *
 * Tracks recent post characteristics (hooks, titles, narrative structures, emotional arcs,
 * opening styles, CTA patterns) so future generation prompts can consciously avoid
 * repeating the same patterns and produce genuinely varied content.
 *
 * Used by: generate-post.js (read before generation, write after)
 * Storage: static/_data/generation-memory.json
 *
 * Design principles:
 *   - Lightweight: plain JSON, no database
 *   - Capped: max 30 entries per category (rolling window)
 *   - Best-effort: read/write errors never break generation
 *   - Non-blocking: extraction is heuristic, not AI-powered
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..", "..");
const MEMORY_FILE = path.join(ROOT, "static", "_data", "generation-memory.json");

const MAX_ENTRIES = 30;

// ── Read ──────────────────────────────────────────────────────────────────────

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    }
  } catch (_) { /* corrupt or missing */ }
  return {
    recentHooks:              [],
    recentTitles:             [],
    recentNarrativeStructures:[],
    recentEmotionalArcs:      [],
    recentOpeningStyles:      [],
    recentCTAPatterns:        [],
  };
}

/**
 * Build a differentiation instruction for injection into generation prompts.
 * Returns a multi-line string describing recent patterns to avoid.
 * Returns null if memory is empty (first runs).
 *
 * @param {string} [niche]   - Optional niche slug to filter (avoids cross-niche noise)
 * @param {number} [lookback=10] - How many recent entries to surface
 */
export function getDifferentiationContext(niche = null, lookback = 10) {
  const memory = loadMemory();

  const recentHooks = (memory.recentHooks || [])
    .filter(e => !niche || e.niche === niche || !e.niche)
    .slice(0, lookback)
    .map(e => e.hook)
    .filter(Boolean);

  const recentTitles = (memory.recentTitles || [])
    .filter(e => !niche || e.niche === niche || !e.niche)
    .slice(0, lookback)
    .map(e => e.title)
    .filter(Boolean);

  const recentStructures = (memory.recentNarrativeStructures || [])
    .slice(0, lookback)
    .map(e => e.structure)
    .filter(Boolean);

  const recentArcs = (memory.recentEmotionalArcs || [])
    .slice(0, lookback)
    .map(e => e.arc)
    .filter(Boolean);

  const recentOpenings = (memory.recentOpeningStyles || [])
    .slice(0, lookback)
    .map(e => e.style)
    .filter(Boolean);

  if (!recentHooks.length && !recentTitles.length) return null;

  const lines = [
    "---",
    "DIFFERENTIATION CONTEXT ~ avoid repeating these recent patterns:",
    "",
  ];

  if (recentTitles.length) {
    lines.push("Recent titles (do NOT use similar cadence or framing):");
    recentTitles.forEach(t => lines.push("  - " + t));
    lines.push("");
  }

  if (recentHooks.length) {
    lines.push("Recent opening hooks (do NOT open with the same type of statement):");
    recentHooks.forEach(h => lines.push("  - " + h.slice(0, 120)));
    lines.push("");
  }

  if (recentStructures.length) {
    lines.push("Recent narrative structures used (avoid these):");
    recentStructures.forEach(s => lines.push("  - " + s));
    lines.push("");
  }

  if (recentArcs.length) {
    lines.push("Recent emotional arcs (vary away from these):");
    recentArcs.forEach(a => lines.push("  - " + a));
    lines.push("");
  }

  if (recentOpenings.length) {
    lines.push("Recent opening styles (use a different one):");
    recentOpenings.forEach(o => lines.push("  - " + o));
    lines.push("");
  }

  lines.push(
    "To differentiate: try a different opening style (question / vivid scene / blunt statement /",
    "counter-intuitive claim / short story / statistic), a fresh emotional arc (confusion -> resolve /",
    "certainty -> doubt -> clarity / frustration -> acceptance -> action), or a different structural",
    "approach (list-driven / narrative-driven / argument / FAQ / before-after / case study).",
    "---"
  );

  return lines.join("\n");
}

/**
 * Get basic cluster context for a given cluster key.
 * Returns prompt-injectable string or null if cluster not found.
 *
 * @param {string} clusterKey - Matches a key in topic-clusters.json
 */
export function getClusterContext(clusterKey) {
  if (!clusterKey) return null;
  const clustersFile = path.join(ROOT, "static", "_data", "topic-clusters.json");
  try {
    const { clusters } = JSON.parse(fs.readFileSync(clustersFile, "utf8"));
    const cluster = clusters.find(c => c.key === clusterKey);
    if (!cluster) return null;

    return [
      "---",
      "CLUSTER CONTEXT ~ this post belongs to the \"" + cluster.displayName + "\" topical cluster:",
      "Pillar: " + cluster.pillar,
      "",
      "Supporting angles already covered in this cluster (consider a fresh angle not yet represented):",
      ...cluster.supportingAngles.map(a => "  - " + a),
      "",
      "Related clusters: " + cluster.relatedClusters.join(", "),
      "---",
    ].join("\n");
  } catch (_) {
    return null;
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Record a newly generated post into the generation memory registry.
 * Extracts characteristics from the post metadata and markdown content.
 * Capped at MAX_ENTRIES per category (oldest entry drops off).
 *
 * Best-effort: never throws. Returns true if written, false if failed.
 *
 * @param {object} opts
 * @param {string} opts.slug
 * @param {string} opts.title
 * @param {string} opts.niche
 * @param {string} opts.cluster
 * @param {string} opts.markdownBody - Raw markdown for heuristic extraction
 */
export function recordGeneration({ slug, title, niche, cluster, markdownBody }) {
  try {
    const memory = loadMemory();
    const timestamp = new Date().toISOString();

    // Extract first non-heading, non-META line as the hook
    const hook = extractHook(markdownBody);

    // Heuristic narrative structure detection
    const structure = detectNarrativeStructure(markdownBody);

    // Heuristic emotional arc detection
    const arc = detectEmotionalArc(markdownBody);

    // Opening style classification
    const openingStyle = classifyOpening(markdownBody);

    function addEntry(arr, entry) {
      arr.unshift(entry);
      if (arr.length > MAX_ENTRIES) arr.length = MAX_ENTRIES;
    }

    if (hook) addEntry(memory.recentHooks, { slug, niche, cluster, hook, timestamp });
    addEntry(memory.recentTitles, { slug, niche, cluster, title, timestamp });
    if (structure) addEntry(memory.recentNarrativeStructures, { slug, structure, timestamp });
    if (arc) addEntry(memory.recentEmotionalArcs, { slug, arc, timestamp });
    if (openingStyle) addEntry(memory.recentOpeningStyles, { slug, style: openingStyle, timestamp });

    memory.lastUpdated = timestamp;

    fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf8");
    return true;
  } catch (_) {
    return false;
  }
}

// ── Heuristic extractors ──────────────────────────────────────────────────────

function extractHook(markdown) {
  if (!markdown) return null;
  const lines = String(markdown).split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("META:") || line.startsWith("---")) continue;
    if (line.length < 20) continue;
    return line.slice(0, 200);
  }
  return null;
}

function detectNarrativeStructure(markdown) {
  if (!markdown) return null;
  const text = String(markdown).toLowerCase();
  const h2s = (text.match(/^##\s.+/gm) || []).length;
  const hasList = /^[-*]\s/m.test(text);
  const hasNumberedList = /^\d+\.\s/m.test(text);
  const hasBlockquote = /^>/m.test(text);
  const hasQuestion = /\?/.test(text.slice(0, 500));

  if (hasNumberedList && h2s > 3) return "numbered-list with subheadings";
  if (hasList && h2s > 4)         return "bullet-list driven with multiple sections";
  if (hasBlockquote && h2s < 3)   return "narrative with blockquote centerpiece";
  if (hasQuestion && h2s < 3)     return "argument-style opening question";
  if (h2s > 5)                    return "heavily-sectioned (6+ H2s)";
  if (h2s > 2)                    return "moderate sections (3-5 H2s)";
  return "flowing narrative";
}

function detectEmotionalArc(markdown) {
  if (!markdown) return null;
  const text = String(markdown).toLowerCase();
  const firstQuarter = text.slice(0, Math.floor(text.length / 4));
  const lastQuarter  = text.slice(Math.floor(text.length * 3 / 4));

  const painWords    = ["stuck", "fail", "wrong", "hurt", "lost", "broken", "struggle", "fear", "shame", "frustrat"];
  const hopeWords    = ["possible", "clear", "ready", "power", "free", "trust", "forward", "build", "reclaim", "better"];
  const actionWords  = ["do", "start", "take", "choose", "step", "commit", "practice", "try", "begin"];

  const opensPain   = painWords.some(w => firstQuarter.includes(w));
  const closesHope  = hopeWords.some(w => lastQuarter.includes(w));
  const closesAction= actionWords.some(w => lastQuarter.includes(w));

  if (opensPain && closesHope && closesAction) return "pain-open → insight → hope + action close";
  if (opensPain && closesAction)               return "pain-open → reframe → action close";
  if (opensPain && closesHope)                 return "pain-open → resolution close";
  if (closesAction)                            return "neutral-open → action close";
  return "neutral arc";
}

function classifyOpening(markdown) {
  if (!markdown) return null;
  const hook = extractHook(markdown) || "";
  const lower = hook.toLowerCase();

  if (hook.trim().startsWith('"') || hook.trim().startsWith('"'))  return "quote opening";
  if (hook.endsWith("?"))                                           return "question opening";
  if (/there('s| is) (one|a) (thing|moment|truth)/i.test(hook))    return "mystery/information-gap opening";
  if (/i (know|used to|remember|was)/i.test(lower))                return "personal story opening";
  if (/most people|nobody|everyone/i.test(lower))                   return "social proof / counter-claim opening";
  if (/if you('re| are)/i.test(lower))                             return "direct reader address opening";
  if (/\d+ (way|reason|thing|step|secret)/i.test(lower))           return "numbered hook opening";
  if (/here('s| is) what/i.test(lower))                            return "reveal/answer-first opening";
  return "statement opening";
}
