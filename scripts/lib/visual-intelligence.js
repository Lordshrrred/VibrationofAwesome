/**
 * visual-intelligence.js
 *
 * Semantic extraction layer for VOA visual generation.
 * Takes a blog post and returns structured intelligence used by
 * build-visual-prompts.js to construct Ideogram-ready prompts.
 *
 * Source of truth: shared-config/visual-generation-policy-v1.md
 *
 * What this module does:
 *   1. Analyzes post title, excerpt, body, lane, content type
 *   2. Extracts emotional tension, transformation arc, core insight
 *   3. Derives symbolic imagery and visual metaphor
 *   4. Produces text overlays per platform (Pinterest, Instagram, Sacred Diagram)
 *   5. Defines the sacred diagram concept for each post
 *
 * What this module does NOT do:
 *   - Call Ideogram
 *   - Build final Ideogram prompts (that is build-visual-prompts.js)
 *   - Post to any platform
 */

// ── Content type → scene direction ────────────────────────────────────────────
// Derived from §4 of visual-generation-policy-v1.md.
// These inform the visual scene when board direction is not available.
export const CONTENT_TYPE_SCENE = {
  creator: {
    scene:   "workshop environment, elegant tools, circuitry, musical instruments, creation in progress",
    mood:    "purposeful momentum, controlled creation, mastery in motion",
    palette: "VOA teal on dark backgrounds, clean geometric elements",
  },
  philosophy: {
    scene:   "liminal threshold, coastal cliff at night, forest path, empty room with single window",
    mood:    "contemplative, open, liminal, the moment before something shifts",
    palette: "deep near-black, single teal light source, vast negative space",
  },
  "nervous-system": {
    scene:   "still water, single candle in darkness, bare trees, one open window in dark room",
    mood:    "suspended breath, reclaimed quiet, regulation, stillness as power",
    palette: "very low contrast, muted teal-green, near silence as visual quality",
  },
  earthstar: {
    scene:   "crystalline geode cross-section, deep space with geometric structure, sacred ruin revealing pattern",
    mood:    "discovery, encoded intelligence, initiation, seeing what was always there",
    palette: "electric violet #cc44ff, deep black #010d10, prismatic cyan #00d4ff, gold accent #f0c060",
  },
  general: {
    scene:   "single figure in vast natural landscape, open horizon, ancient coastline or forest",
    mood:    "openness, scale, possibility, the world from the outside",
    palette: "full VOA palette, teal accent on dark ground",
  },
};

// ── Pinterest board → visual modifiers ────────────────────────────────────────
// Derived from §6 of visual-generation-policy-v1.md.
// Each board has search intent, scene direction, overlay tone, and palette notes.
export const BOARD_VISUAL_DIRECTION = {
  "purpose-and-direction": {
    scene:         "open horizon, long road vanishing point, dawn light breaking at the edge",
    mood:          "clarity emerging from fog, forward momentum, the first step made visible",
    colorModifier: "warm teal gradient toward horizon, suggestion of dawn approaching dark",
    textTone:      "question or incomplete thought ~ creates pull without answering",
    searchIntent:  "life direction, clarity, purpose, calling, what do I do with my life",
  },
  "dopamine-detox": {
    scene:         "minimal single-object composition, near-silence as a visual quality, empty table or bare window",
    mood:          "liberation from noise, reclaimed attention, stillness as a radical act",
    colorModifier: "very dark backgrounds, single desaturated light source, no color saturation",
    textTone:      "declarative release ~ you don't have to chase this anymore",
    searchIntent:  "dopamine detox, phone addiction, digital detox, attention reset, screen free",
  },
  "nervous-system-reset": {
    scene:         "still water surface, single breath visible as mist, empty vessel, bare trees with space",
    mood:          "regulation, exhale, coming home to the body, slowness as intelligence",
    colorModifier: "cool blue-green, very low contrast backgrounds, muted teal, nothing urgent",
    textTone:      "somatic and grounding ~ speaks to the body, not the mind",
    searchIntent:  "nervous system regulation, calm, anxiety relief, ADHD, neurodivergent, healing",
  },
  "conscious-creator-tools": {
    scene:         "elegant workspace, close-up of instrument strings or circuit detail, tool arranged with intention",
    mood:          "purposeful flow, the right tool for the right mind, systems that actually work",
    colorModifier: "VOA teal with darker techy backgrounds, clean precision lines",
    textTone:      "practical hook ~ names the tool or the problem it solves",
    searchIntent:  "AI tools, creator tools, automation, workflow, music production, creative process",
  },
  "field-guide": {
    scene:         "path into unknown terrain, worn book open on a table, compass or map, threshold invitation",
    mood:          "entry point, the guide nobody handed you, welcome to the real curriculum",
    colorModifier: "VOA palette slightly warmer than usual, approachable, ancient-document warmth",
    textTone:      "invitation ~ you already knew this was the next step",
    searchIntent:  "self-help, field guide, personal development, awakening, consciousness",
  },
  earthstar: {
    scene:         "crystalline structure revealing hidden geometry, deep space with encoded pattern, sacred ruin",
    mood:          "initiation, seeing the architecture beneath everything, belonging to something larger",
    colorModifier: "EarthStar palette: electric violet, prismatic cyan, deep black, gold accent",
    textTone:      "initiatory declarative ~ you were built for this frequency",
    searchIntent:  "sacred geometry, earthstar, cosmic identity, empowerment, awakening, spiritual",
  },
  "empower-thyself": {
    scene:         "single figure at threshold, storm clearing to reveal horizon, dawn after darkness",
    mood:          "reclamation, sovereignty, the moment you stop waiting for permission",
    colorModifier: "VOA palette moving toward light ~ dark foundation, teal-gold emerging horizon",
    textTone:      "reclamation ~ this was always yours",
    searchIntent:  "empowerment, sovereignty, self-worth, claim your life, stop shrinking, own it",
  },
  "vibration-of-awesome": {
    scene:         "most representative VOA image ~ cosmic, grounded, liminal, the feeling of the site itself",
    mood:          "the whole thing distilled ~ real, slightly eccentric, alive with quiet power",
    colorModifier: "full VOA palette without compromise, no sub-brand lean",
    textTone:      "VOA voice at its most distilled",
    searchIntent:  "vibration of awesome, awakening, consciousness, personal transformation, authentic",
  },
};

// ── Sacred diagram structure types ────────────────────────────────────────────
// Vocabulary for defining what kind of diagram a post warrants.
// Used in the intelligence extraction prompt and in diagram prompt construction.
export const DIAGRAM_STRUCTURE_TYPES = {
  "nested-rings":    "concentric circles showing layers, depth, or levels of a concept",
  "flow-diagram":    "connected nodes showing process, transformation, or sequence",
  "matrix":          "grid showing relationships or comparisons between concepts",
  "map":             "spatial territory representing conceptual landscape or journey",
  "schematic":       "technical diagram showing system components and their connections",
  "star-chart":      "radial pattern emanating from a central concept outward",
  "spiral":          "temporal or developmental progression rendered as a spiral",
  "duality-split":   "two-column or mirrored structure showing contrast, before/after, inner/outer",
  "tree":            "hierarchical branching structure showing origins and derivations",
  "interference":    "overlapping fields or wave patterns showing interaction between forces",
};

// ── Main extraction function ───────────────────────────────────────────────────

/**
 * Extract structured visual intelligence from a blog post.
 *
 * Uses Claude Haiku (cheap/fast) to analyze the post semantics and return
 * a structured object used by build-visual-prompts.js for Ideogram prompt assembly.
 *
 * @param {object} post        - Post metadata { title, excerpt, tags, lane, niche? }
 * @param {string} postBody    - Plain text of the full post body (first 700 words)
 * @param {string} contentType - From detectContentType() in policy.js
 * @param {string} boardKey    - From selectPinterestBoard() in policy.js
 * @param {Anthropic} anthropic - Anthropic client
 * @returns {Promise<object>}  - Structured visual intelligence object
 */
export async function extractVisualIntelligence(post, postBody, contentType, boardKey, anthropic) {
  const tags = (post.tags || []).slice(0, 8).join(", ");
  const excerpt = (post.excerpt || "").slice(0, 300);
  const body    = (postBody || "").slice(0, 1200);
  const boardDir = BOARD_VISUAL_DIRECTION[boardKey] || BOARD_VISUAL_DIRECTION["vibration-of-awesome"];
  const sceneDir = CONTENT_TYPE_SCENE[contentType] || CONTENT_TYPE_SCENE.general;
  const diagramTypes = Object.entries(DIAGRAM_STRUCTURE_TYPES)
    .map(([k, v]) => `  "${k}" ~ ${v}`).join("\n");

  const systemPrompt = `You are the visual intelligence layer for a spiritual/creator blog called Vibration of Awesome.
Your job is to extract the EMOTIONAL and SYMBOLIC core of blog posts and return structured visual data.

Rules:
- Never illustrate the literal topic. "Dopamine detox" does not mean a phone. Find the emotional truth beneath.
- Text overlays must feel like something you would stop to re-read. 5-8 words for Pinterest, max 3 for Instagram.
- Sacred diagrams are NOT spiritual art. They are consciousness schematics, dimensional maps, future-civilization manuals.
  Think: technical manual meets cosmic cartography. Every element serves the diagram, nothing decorative.
- All output must be valid JSON only. No preamble. No markdown fences.`;

  const userPrompt = `Analyze this blog post and return structured visual intelligence as a single JSON object.

POST:
Title: ${post.title}
Lane: ${post.lane === "matt" ? "Forest Temple (raw personal blog by Matt EarthStar)" : "Boom Frequency (AI/creator blog by Matty BoomBoom)"}
Content type: ${contentType}
Pinterest board target: ${boardKey}
Board search intent: ${boardDir.searchIntent}
Tags: ${tags}
Excerpt: ${excerpt}
Body: ${body}

Return this exact JSON structure (all fields required):
{
  "emotionalTension": "one sentence ~ the core conflict or unresolved question the post holds",
  "transformation": "one sentence ~ the shift, realization, or change the post moves toward",
  "coreInsight": "one sentence ~ the sharpest, most shareable idea in the post",
  "symbolicImagery": ["3 to 5 short symbol/image phrases that capture the post's essence obliquely"],
  "visualMetaphor": "one concrete natural or architectural metaphor that holds the post's meaning",
  "platformTextOverlays": {
    "pinterest": "5 to 8 word phrase for Pinterest text overlay ~ scroll-stopping, oblique, re-readable",
    "instagram": "2 to 3 word phrase for Instagram overlay (or empty string if none needed)",
    "sacredDiagram": "6 to 12 word title/label for the sacred diagram ~ sounds like a schematic or map title"
  },
  "sacredDiagram": {
    "conceptTitle": "name of the diagram as it would appear on a future-civilization schematic",
    "structureType": "one of: nested-rings | flow-diagram | matrix | map | schematic | star-chart | spiral | duality-split | tree | interference",
    "structureRationale": "one sentence ~ why this structure fits the post's conceptual architecture",
    "keyNodes": ["3 to 6 labeled nodes or zones that would appear in the diagram"],
    "centralConcept": "the single concept at the center or origin of the diagram",
    "labelStyle": "one of: technical-manual | ancient-recovered-text | cosmic-schematic | field-notes | blueprint",
    "symbolicElements": ["2 to 4 geometric or symbolic elements that reinforce the diagram's meaning"]
  },
  "fieldGuideArtifact": {
    "artifactType": "one of: page | scroll | tablet | card | map | cover",
    "artifactTitle": "title that would appear on the artifact, 4 to 8 words",
    "condition": "one of: pristine | worn | ancient | encrypted | illuminated",
    "marginNotes": ["2 to 3 short annotation phrases that would appear in the margins"]
  }
}

Available structure types with meanings:
${diagramTypes}`;

  const msg = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 900,
    system:     systemPrompt,
    messages:   [{ role: "user", content: userPrompt }],
  });

  const raw = msg.content[0].text.trim();

  // Strip markdown fences if Claude wrapped it anyway
  const jsonStr = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`visual-intelligence: JSON parse failed ~ ${err.message}\nRaw: ${raw.slice(0, 200)}`);
  }
}
