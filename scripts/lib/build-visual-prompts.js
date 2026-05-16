#!/usr/bin/env node
/**
 * build-visual-prompts.js
 *
 * Visual derivation orchestrator for VOA blog posts.
 *
 * Phase 1: generation + storage only. Does NOT auto-post.
 *
 * Generates 4 visual types per post:
 *   pinterest       ~ 10:16 portrait, DESIGN style, board-aware, text overlay
 *   instagram       ~ 1:1 square, REALISTIC style, atmospheric, minimal text
 *   sacred_diagram  ~ 1:1 square, DESIGN style, consciousness schematic
 *   field_guide_artifact ~ 10:16 portrait, DESIGN style, premium artifact aesthetic
 *
 * Source of truth: shared-config/visual-generation-policy-v1.md
 *
 * CLI usage:
 *   node scripts/lib/build-visual-prompts.js --lane boom --slug <slug>
 *     → extract intelligence + build prompts, log everything, no Ideogram call
 *
 *   node scripts/lib/build-visual-prompts.js --lane boom --slug <slug> --generate
 *     → also call Ideogram for each prompt type, store URLs in visual-registry.json
 *
 *   node scripts/lib/build-visual-prompts.js --lane boom --slug <slug> --generate --type pinterest
 *     → generate only one type (pinterest | instagram | sacred_diagram | field_guide_artifact)
 *
 *   node scripts/lib/build-visual-prompts.js --review
 *     → print visual-registry.json in readable summary form
 *
 *   node scripts/lib/build-visual-prompts.js --lane boom --slug <slug> --dry-run
 *     → show what would be extracted, no API calls
 *
 * API usage:
 *   import { buildVisualPrompts, generateAndStoreVisuals } from "./build-visual-prompts.js"
 */

import Anthropic from "@anthropic-ai/sdk";
import dotenv    from "dotenv";
import fs        from "fs";
import path      from "path";
import minimist  from "minimist";
import { fileURLToPath } from "url";

import {
  extractVisualIntelligence,
  BOARD_VISUAL_DIRECTION,
  CONTENT_TYPE_SCENE,
} from "./visual-intelligence.js";

import {
  detectContentType,
  selectPinterestBoard,
  PINTEREST_BOARDS,
} from "./policy.js";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..", "..");

const REGISTRY_FILE = path.join(ROOT, "static", "_data", "visual-registry.json");

// ── Visual type definitions ────────────────────────────────────────────────────
// Exported so callers and the CLI can reference type names and params.
// Parameters passed to Ideogram per visual type.
// Derived from §2 of visual-generation-policy-v1.md.
export const VISUAL_TYPES = {
  pinterest: {
    label:       "Pinterest",
    aspect:      "ASPECT_10_16",
    model:       "V_2",           // V_2 over TURBO: significantly better text rendering
    style:       "DESIGN",
    magic:       "OFF",           // OFF: magic prompt rewrites our overlay text and causes garbling
    description: "10:16 portrait, bold graphic, text overlay, board-aware search optimization",
  },
  instagram: {
    label:       "Instagram",
    aspect:      "ASPECT_1_1",
    model:       "V_2_TURBO",
    style:       "REALISTIC",
    magic:       "ON",
    description: "1:1 square, photorealistic mood, atmospheric, minimal or no text",
  },
  sacred_diagram: {
    label:       "Sacred Diagram",
    aspect:      "ASPECT_1_1",
    model:       "V_2",         // higher quality for detailed diagram rendering
    style:       "DESIGN",
    magic:       "OFF",         // OFF for diagrams ~ magic prompt changes layout unpredictably
    description: "1:1 square, consciousness schematic, technical-mystical manual aesthetic",
  },
  field_guide_artifact: {
    label:       "Field Guide Artifact",
    aspect:      "ASPECT_10_16",
    model:       "V_2",
    style:       "DESIGN",
    magic:       "ON",
    description: "10:16 portrait, premium artifact aesthetic, worn/illuminated page or scroll",
  },
};

// ── Brand palette constants ────────────────────────────────────────────────────
// Exact values from the site CSS. Used in prompt construction.
const VOA_PALETTE = {
  accent:  "#00e5cc",  // teal ~ primary accent (called "gold" in baseof.html)
  deep:    "#020a0a",  // near-black background
  earth:   "#001a18",  // deep earthy teal-black
  terra:   "#003d38",  // deep forest teal
  cream:   "#d0fff8",  // light text
  muted:   "#4a9e96",  // secondary teal
};

const EARTHSTAR_PALETTE = {
  violet:  "#cc44ff",  // primary electric violet
  cyan:    "#00d4ff",  // secondary electric cyan
  black:   "#010d10",  // cosmic near-black
  gold:    "#f0c060",  // anchoring warm gold
  surface: "#080d18",  // dark blue-black
};

// ── Text overlay sanitizer ─────────────────────────────────────────────────────
// Ideogram garbles apostrophes, smart/curly quotes, and contractions.
// This strips them out and returns a clean uppercase phrase safe for rendering.
function sanitizeOverlay(text) {
  if (!text) return "";
  return text
    // Expand common contractions before stripping apostrophes
    .replace(/don['']t/gi, "dont")
    .replace(/you['']re/gi, "youre")
    .replace(/you['']ve/gi, "youve")
    .replace(/it['']s/gi, "its")
    .replace(/that['']s/gi, "thats")
    .replace(/there['']s/gi, "theres")
    .replace(/they['']re/gi, "theyre")
    .replace(/we['']re/gi, "were")
    .replace(/what['']s/gi, "whats")
    .replace(/can['']t/gi, "cant")
    .replace(/won['']t/gi, "wont")
    .replace(/i['']ve/gi, "ive")
    .replace(/i['']m/gi, "im")
    // Strip any remaining smart quotes, curly quotes, apostrophes, and stray punctuation
    .replace(/[''""„"«»‹›]/g, "")
    .replace(/'/g, "")
    .replace(/"/g, "")
    // Strip parentheses and brackets
    .replace(/[()[\]{}]/g, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();
}

// ── Prompt builders ────────────────────────────────────────────────────────────

function buildPinterestPrompt(intelligence, contentType, boardKey) {
  const boardDir  = BOARD_VISUAL_DIRECTION[boardKey] || BOARD_VISUAL_DIRECTION["vibration-of-awesome"];
  const sceneDir  = CONTENT_TYPE_SCENE[contentType] || CONTENT_TYPE_SCENE.general;
  const overlay   = sanitizeOverlay(intelligence.platformTextOverlays?.pinterest || "");
  const metaphor  = intelligence.visualMetaphor || "";
  const tension   = intelligence.emotionalTension || "";

  // Board drives scene when available; content type supplements
  const primaryScene  = boardDir.scene;
  const colorNote     = boardDir.colorModifier;
  const moodNote      = boardDir.mood;

  const parts = [
    // Mood-first opening (policy §3 rule 1)
    `${moodNote}.`,
    // Scene with metaphor layered in
    `${primaryScene}${metaphor ? `. ${metaphor} as a visual presence` : ""}.`,
    // Lighting character (policy §3 rule 4)
    `Light source is ${contentType === "earthstar" ? "prismatic and refractive, multi-directional" : "interior ~ soft teal bioluminescence from within a single element"}.`,
    // Explicit palette (policy §3 rule 5)
    `Color palette: ${colorNote}. Primary accent ${VOA_PALETTE.accent}, background ${VOA_PALETTE.deep}.`,
    // Text overlay (always present for Pinterest) ~ uppercase for clean Ideogram rendering
    overlay ? `Bold uppercase text overlay reads: "${overlay.toUpperCase()}". Render text with clean crisp edges, no distortion, no garbling.` : "",
    // Style direction
    `Painterly cinematic render, DESIGN style. No human faces. No identifiable people. No warm golden-hour tones.`,
    // Avoid directive
    `Avoid motivational poster composition, stock photo cleanliness, literal topic illustration.`,
    // Board search context
    `Keyword context for searchability: ${boardDir.searchIntent}.`,
  ].filter(Boolean).join(" ");

  return { prompt: parts, params: VISUAL_TYPES.pinterest };
}

function buildInstagramPrompt(intelligence, contentType) {
  const sceneDir  = CONTENT_TYPE_SCENE[contentType] || CONTENT_TYPE_SCENE.general;
  const overlay   = sanitizeOverlay(intelligence.platformTextOverlays?.instagram || "");
  const metaphor  = intelligence.visualMetaphor || "";
  const symbols   = (intelligence.symbolicImagery || []).slice(0, 2).join("; ");

  const parts = [
    // Instagram needs a faster emotional hit ~ lead harder
    `${intelligence.emotionalTension || sceneDir.mood}.`,
    // Scene but more abstract than Pinterest
    `${sceneDir.scene}${metaphor ? `, ${metaphor} as a central element` : ""}.`,
    // Subtle symbolic layer
    symbols ? `Subtle visual elements: ${symbols}.` : "",
    // Lighting as character
    `Single directional light source, deep shadows, cinematic quality of light.`,
    // Palette ~ slightly desaturated for Instagram aesthetic
    `Color palette: VOA identity, slightly underexposed. ${VOA_PALETTE.accent} accent against ${VOA_PALETTE.deep} background.`,
    // Text overlay only if short enough
    overlay ? `Minimal text overlay: "${overlay}".` : "No text overlay.",
    // Instagram-specific style rules
    `REALISTIC photographic style. Subject slightly off-center. Deep depth of field with one element crisp. No faces. Image holds at small thumbnail size.`,
    // Avoids
    `Avoid motivational poster energy, bright whites, warm golden-hour tones, generic spiritual imagery.`,
  ].filter(Boolean).join(" ");

  return { prompt: parts, params: VISUAL_TYPES.instagram };
}

function buildSacredDiagramPrompt(intelligence) {
  const diagram   = intelligence.sacredDiagram || {};
  const overlay   = intelligence.platformTextOverlays?.sacredDiagram || diagram.conceptTitle || "";
  const nodes     = (diagram.keyNodes || []).join(", ");
  const symbols   = (diagram.symbolicElements || []).join(", ");

  // Label style → visual treatment
  const LABEL_STYLES = {
    "technical-manual":        "precise technical annotation, monospaced labels, measurement marks",
    "ancient-recovered-text":  "worn inscribed lettering, fragmentary text, aged parchment quality",
    "cosmic-schematic":        "luminous floating labels, dimensional notation, star-chart typography",
    "field-notes":             "handwritten annotations, margin notes, exploratory notation",
    "blueprint":               "architectural blueprint precision, white lines on deep blue, exact measurements",
  };
  const labelTreatment = LABEL_STYLES[diagram.labelStyle || "cosmic-schematic"];

  // Structure type → layout direction
  const STRUCTURE_DIRECTIONS = {
    "nested-rings":  "concentric circular zones radiating outward from center",
    "flow-diagram":  "connected node network with directional flow lines",
    "matrix":        "precise grid with labeled axes and intersection markers",
    "map":           "spatial cartographic layout with territories and paths",
    "schematic":     "technical component diagram with connection lines",
    "star-chart":    "radial structure emanating from a luminous central point",
    "spiral":        "logarithmic spiral with staged sections and milestone markers",
    "duality-split": "mirrored two-column structure with central axis",
    "tree":          "branching hierarchy from single origin point",
    "interference":  "overlapping wave or field patterns creating interference zones",
  };
  const layoutDir = STRUCTURE_DIRECTIONS[diagram.structureType || "schematic"];

  const parts = [
    // Frame the artifact type first
    `A sacred schematic diagram rendered as both mystical artifact and technical manual from an advanced civilization.`,
    // Central concept
    `Central concept: "${diagram.centralConcept || intelligence.coreInsight}".`,
    // Layout structure
    `Layout structure: ${layoutDir}.`,
    // Key nodes
    nodes ? `Labeled zones and nodes: ${nodes}.` : "",
    // Symbolic elements integrated into structure
    symbols ? `Geometric and symbolic elements reinforcing the structure: ${symbols}.` : "",
    // Label/typography treatment
    `Typography treatment: ${labelTreatment}.`,
    // Color ~ slightly different from standard VOA for the diagram aesthetic
    `Color palette: deep black ${VOA_PALETTE.deep} background, ${VOA_PALETTE.accent} teal for primary lines and labels, ${VOA_PALETTE.cream} for secondary annotation. Gold ${EARTHSTAR_PALETTE.gold} for key nodes.`,
    // Text overlay ~ the diagram title
    overlay ? `Schematic title text visible in the diagram: "${overlay}".` : "",
    // Style
    `DESIGN style, extreme precision, fine line work. Every mark serves the diagram. Zero decorative elements. The aesthetic is a recovered manuscript from a civilization that understood consciousness as architecture.`,
    // Critical avoids for diagrams
    `Avoid: decorative sacred geometry without structural purpose, generic mandala aesthetics, soft watercolor or painterly treatment, faces or figures.`,
  ].filter(Boolean).join(" ");

  return { prompt: parts, params: VISUAL_TYPES.sacred_diagram };
}

function buildFieldGuideArtifactPrompt(intelligence) {
  const artifact  = intelligence.fieldGuideArtifact || {};
  const overlay   = artifact.artifactTitle || intelligence.platformTextOverlays?.pinterest || intelligence.coreInsight || "";
  const margins   = (artifact.marginNotes || []).join("; ");

  // Condition → visual treatment
  const CONDITIONS = {
    pristine:    "clean crisp edges, fresh ink, new-made but ancient in design",
    worn:        "worn edges, slight foxing, the marks of being carried and consulted",
    ancient:     "deep aging, cracked edges, fragments of text, palimpsest layers",
    encrypted:   "portions obscured, symbols replacing some words, intentional redaction",
    illuminated: "gilded ornamental borders, luminous decorated capitals, manuscript gold",
  };
  const conditionTreatment = CONDITIONS[artifact.condition || "worn"];

  // Artifact type → physical form
  const ARTIFACT_FORMS = {
    page:    "single document page with structured layout, margins, header and body",
    scroll:  "partially unrolled scroll revealing text and diagram",
    tablet:  "stone or carved surface with incised diagram and text",
    card:    "single card or tile, dense with a single core diagram",
    map:     "folded map partially open, territory and legend visible",
    cover:   "book cover or manuscript cover with title, symbol, and edge detail",
  };
  const artifactForm = ARTIFACT_FORMS[artifact.artifactType || "page"];

  const parts = [
    // Frame the artifact
    `A premium mystical artifact rendered with extraordinary detail: ${artifactForm}.`,
    // Condition treatment
    `Physical condition: ${conditionTreatment}.`,
    // Content overview
    `The artifact contains a central diagram or map, structured text, and margin annotations.`,
    margins ? `Visible margin annotations include: "${margins}".` : "",
    // Title visible on artifact
    overlay ? `Title text on artifact reads: "${overlay}".` : "",
    // Material and color
    `Material appearance: dark vellum or aged parchment ground. Ink colors: ${VOA_PALETTE.accent} teal primary, ${VOA_PALETTE.cream} secondary, occasional ${EARTHSTAR_PALETTE.gold} gold highlight for key elements.`,
    // Typography
    `Typography mixes Cinzel-style capitals for headers with finer body text in a classical or technical style.`,
    // Overall aesthetic
    `The overall aesthetic is a manual recovered from the Vibration of Awesome Field Guide ~ premium, mystical, deeply functional. Looks like something you would pay real money for and keep for years.`,
    // Style and avoids
    `DESIGN style, portrait orientation. No faces. Avoid digital-looking layouts, generic book covers, flat design. The artifact must feel physically real.`,
  ].filter(Boolean).join(" ");

  return { prompt: parts, params: VISUAL_TYPES.field_guide_artifact };
}

// ── Ideogram API call ──────────────────────────────────────────────────────────

async function callIdeogram(visualType, promptData) {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) throw new Error("IDEOGRAM_API_KEY not set");

  const { prompt, params } = promptData;

  const resp = await fetch("https://api.ideogram.ai/generate", {
    method:  "POST",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_request: {
        prompt,
        aspect_ratio:         params.aspect,
        model:                params.model,
        style_type:           params.style,
        magic_prompt_option:  params.magic,
      },
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.message || data?.error || `HTTP ${resp.status}`;
    throw new Error(`Ideogram (${visualType}): ${msg}`);
  }

  const url = data.data?.[0]?.url;
  if (!url) throw new Error(`Ideogram (${visualType}): no URL in response`);

  return url;
}

// ── Registry management ────────────────────────────────────────────────────────

function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const raw = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
      return Array.isArray(raw) ? raw : [];
    }
  } catch (_) { /* corrupt ~ start fresh */ }
  return [];
}

function saveRegistry(registry) {
  fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), "utf8");
}

function upsertRegistryEntry(registry, entry) {
  const idx = registry.findIndex(e => e.slug === entry.slug);
  if (idx >= 0) {
    // Merge: preserve existing image URLs if new generation didn't run
    const existing = registry[idx];
    const merged = {
      ...existing,
      ...entry,
      images: {
        ...(existing.images || {}),
        ...(entry.images || {}),
      },
    };
    registry[idx] = merged;
  } else {
    registry.unshift(entry);
  }
  return registry;
}

// ── Main exported functions ───────────────────────────────────────────────────

/**
 * Build visual prompts for a post without calling Ideogram.
 *
 * @param {object} post       - Post metadata { title, excerpt, tags, lane, slug, niche? }
 * @param {string} postBody   - Plain text body (first 700 words recommended)
 * @param {object} options    - { dryRun?: boolean }
 * @param {Anthropic} anthropic
 * @returns {Promise<object>} - { contentType, boardKey, intelligence, prompts }
 */
export async function buildVisualPrompts(post, postBody, options = {}, anthropic) {
  const contentType = detectContentType({ ...post });
  const boardKey    = selectPinterestBoard({ ...post });
  const boardName   = PINTEREST_BOARDS[boardKey] || boardKey;

  console.log(`\n[visuals] Extracting visual intelligence...`);
  console.log(`  Post:         ${post.title.slice(0, 60)}`);
  console.log(`  Content type: ${contentType}`);
  console.log(`  Board target: ${boardName} (${boardKey})`);

  if (options.dryRun) {
    console.log(`  [dry-run] Skipping Claude extraction.`);
    return { contentType, boardKey, intelligence: null, prompts: null };
  }

  const intelligence = await extractVisualIntelligence(
    post, postBody, contentType, boardKey, anthropic
  );

  console.log(`  Emotional tension: ${intelligence.emotionalTension}`);
  console.log(`  Core insight:      ${intelligence.coreInsight}`);
  console.log(`  Visual metaphor:   ${intelligence.visualMetaphor}`);
  console.log(`  Diagram concept:   ${intelligence.sacredDiagram?.conceptTitle}`);
  console.log(`  Diagram type:      ${intelligence.sacredDiagram?.structureType}`);

  const prompts = {
    pinterest:            buildPinterestPrompt(intelligence, contentType, boardKey),
    instagram:            buildInstagramPrompt(intelligence, contentType),
    sacred_diagram:       buildSacredDiagramPrompt(intelligence),
    field_guide_artifact: buildFieldGuideArtifactPrompt(intelligence),
  };

  return { contentType, boardKey, boardName, intelligence, prompts };
}

/**
 * Build prompts AND generate Ideogram images, storing everything in visual-registry.json.
 *
 * @param {object} post       - Post metadata
 * @param {string} postBody   - Plain text body
 * @param {object} options    - { typeFilter?: string, dryRun?: boolean }
 * @param {Anthropic} anthropic
 * @returns {Promise<object>} - Full registry entry for this post
 */
export async function generateAndStoreVisuals(post, postBody, options = {}, anthropic) {
  const { contentType, boardKey, boardName, intelligence, prompts } =
    await buildVisualPrompts(post, postBody, options, anthropic);

  if (!intelligence) {
    return null; // dry-run
  }

  // Determine which types to generate
  const allTypes   = Object.keys(VISUAL_TYPES);
  const typesToRun = options.typeFilter
    ? allTypes.filter(t => t === options.typeFilter)
    : allTypes;

  const images = {};

  for (const typeName of typesToRun) {
    const promptData = prompts[typeName];
    if (!promptData) continue;

    console.log(`\n[visuals] Generating ${VISUAL_TYPES[typeName].label}...`);
    console.log(`  Prompt (first 120): ${promptData.prompt.slice(0, 120)}...`);
    console.log(`  Params: ${promptData.params.aspect} ${promptData.params.style} ${promptData.params.model}`);

    if (options.dryRun) {
      console.log(`  [dry-run] Skipping Ideogram call.`);
      images[typeName] = null;
      continue;
    }

    try {
      const url = await callIdeogram(typeName, promptData);
      console.log(`  ✓ Generated: ${url}`);
      images[typeName] = {
        url,
        generatedAt: new Date().toISOString(),
        ephemeral:   true, // Ideogram URLs expire; future phases should upload to permanent storage
      };
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
      images[typeName] = null;
    }
  }

  // Build registry entry
  const entry = {
    slug:         post.slug,
    title:        post.title,
    lane:         post.lane,
    contentType,
    boardKey,
    boardName,
    generatedAt:  new Date().toISOString(),
    intelligence,
    prompts: Object.fromEntries(
      Object.entries(prompts).map(([k, v]) => [k, {
        prompt: v.prompt,
        aspect: v.params.aspect,
        model:  v.params.model,
        style:  v.params.style,
      }])
    ),
    images,
  };

  // Persist
  const registry = loadRegistry();
  const updated  = upsertRegistryEntry(registry, entry);
  saveRegistry(updated);

  console.log(`\n[visuals] Saved to visual-registry.json`);

  return entry;
}

// ── CLI ────────────────────────────────────────────────────────────────────────

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isCli) {
  const argv = minimist(process.argv.slice(2), {
    string:  ["lane", "slug", "type"],
    boolean: ["generate", "dry-run", "review", "prompts-only"],
    alias:   { l: "lane", s: "slug", t: "type", g: "generate" },
  });

  if (argv.review) {
    // Print registry summary
    const registry = loadRegistry();
    if (registry.length === 0) {
      console.log("visual-registry.json is empty. Run with --lane and --slug --generate to populate.");
      process.exit(0);
    }
    console.log(`\nVisual Registry ~ ${registry.length} entry/entries:\n`);
    for (const entry of registry) {
      const imageCount = Object.values(entry.images || {}).filter(Boolean).length;
      const promptCount = Object.keys(entry.prompts || {}).length;
      console.log(`  ${entry.slug}`);
      console.log(`    Lane:    ${entry.lane}  |  Type: ${entry.contentType}  |  Board: ${entry.boardName}`);
      console.log(`    Prompts: ${promptCount}  |  Images generated: ${imageCount}`);
      if (entry.intelligence) {
        console.log(`    Insight: ${entry.intelligence.coreInsight}`);
        console.log(`    Diagram: ${entry.intelligence.sacredDiagram?.conceptTitle} (${entry.intelligence.sacredDiagram?.structureType})`);
      }
      console.log();
    }
    process.exit(0);
  }

  if (!argv.lane || !["matt", "boom"].includes(argv.lane) || !argv.slug) {
    console.error("Usage: node scripts/lib/build-visual-prompts.js --lane [matt|boom] --slug <slug> [--generate] [--type <type>] [--dry-run]");
    console.error("       node scripts/lib/build-visual-prompts.js --review");
    console.error("\nVisual types: pinterest | instagram | sacred_diagram | field_guide_artifact");
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY && !argv["dry-run"]) {
    console.error("Error: ANTHROPIC_API_KEY not set."); process.exit(1);
  }

  const dataFile = path.join(ROOT, "static", "_data", `${argv.lane}-posts.json`);
  if (!fs.existsSync(dataFile)) { console.error(`No data file: ${dataFile}`); process.exit(1); }

  const posts = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  const post  = posts.find(p => p.slug === argv.slug);
  if (!post) { console.error(`Post "${argv.slug}" not found in ${dataFile}`); process.exit(1); }

  // Read post body from HTML file
  let postBody = post.excerpt || "";
  const htmlFile = path.join(ROOT, "static", "blog", argv.lane, "posts", `${argv.slug}.html`);
  if (fs.existsSync(htmlFile)) {
    const rawHtml = fs.readFileSync(htmlFile, "utf8");
    const artMatch = rawHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const fullText = (artMatch ? artMatch[1] : rawHtml)
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    postBody = fullText.split(/\s+/).slice(0, 700).join(" ");
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const options   = {
    dryRun:     argv["dry-run"],
    typeFilter: argv.type || null,
  };

  try {
    if (argv.generate || argv.g) {
      const entry = await generateAndStoreVisuals({ ...post, lane: argv.lane }, postBody, options, anthropic);
      if (entry) {
        console.log("\n╔═ Visual Generation Complete ═══════════════════════");
        for (const [type, img] of Object.entries(entry.images || {})) {
          const label = VISUAL_TYPES[type]?.label || type;
          console.log(`║  ${label.padEnd(22)} ${img ? "✓ " + img.url.slice(0, 60) + "..." : "✗ not generated"}`);
        }
        console.log("╚═══════════════════════════════════════════════════\n");
      }
    } else {
      // Prompts-only mode (no Ideogram)
      const result = await buildVisualPrompts({ ...post, lane: argv.lane }, postBody, options, anthropic);
      if (result.prompts) {
        console.log("\n╔═ Generated Visual Prompts ══════════════════════════");
        for (const [type, data] of Object.entries(result.prompts)) {
          const label = VISUAL_TYPES[type]?.label || type;
          console.log(`║`);
          console.log(`║  ── ${label} (${data.params.aspect} ${data.params.style}) ──`);
          console.log(`║  ${data.prompt.slice(0, 200)}...`);
        }
        console.log("╚═══════════════════════════════════════════════════");
        console.log("\nAdd --generate to also call Ideogram and save image URLs.\n");
      }
    }
  } catch (err) {
    console.error("Fatal:", err.message);
    process.exit(1);
  }
}
