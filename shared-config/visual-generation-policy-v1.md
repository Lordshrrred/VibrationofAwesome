# Visual Generation Policy v1
## Ideogram ~ VOA Blog + EarthStar Rising

**Status:** Active (brand rules) / Partially implemented (pipeline)
**Engine:** VOA Blog syndication (Pinterest + Instagram)  
**Last updated:** 2026-05-17  
**Applies to:** `scripts/generate-pinterest-image.js` and `scripts/lib/build-visual-prompts.js`

---

## PIPELINE STATUS (read this before touching visual generation code)

There are **two visual generation systems** in this repo. Do NOT merge them accidentally.

### System A — Lightweight live pipeline (currently active in automated syndication)

**File:** `scripts/generate-pinterest-image.js`  
**Triggered by:** `syndicate.js` on every drip-publish run  
**What it generates:** One Ideogram image per post, Pinterest portrait (10:16), DESIGN style  
**Storage:** Image URL passed directly to Publer; NOT saved locally; captured in `static/_data/image-registry.json`  
**Status:** This is the live system. Do not disable or replace it without testing the full drip pipeline.

### System B — Richer visual OS (future canonical direction, NOT yet wired to live syndication)

**Files:** `scripts/lib/build-visual-prompts.js` + `scripts/lib/visual-intelligence.js`  
**Triggered by:** Manual CLI only (`npm run visuals:build -- --lane boom --slug <slug>`)  
**What it generates:** 4 visual types per post: `pinterest`, `instagram`, `sacred_diagram`, `field_guide_artifact`  
**Storage:** `static/_data/visual-registry.json` (created on first `--generate` run)  
**Status:** Implemented but NOT wired into drip/syndication. This is the long-term canonical visual OS.

### Direction

System B is the intended future. System A will remain active until System B is safely wired into the drip pipeline and tested end-to-end. The shared calendar architecture (future) should reference visual assets from System B's `visual-registry.json`.

To avoid confusion:
- `image-registry.json` = System A output (live syndication asset audit)
- `visual-registry.json` = System B output (richer visual OS, manual for now)
- Do not consolidate these files until System B is wired to live syndication

---

This document defines the visual rules for AI-generated images used in VOA blog syndication.
It is the source of truth for Ideogram prompt construction, aesthetic direction, and
platform-specific composition rules. Code and prompts must reference this document.

---

## 1. Brand Identities

There are two distinct visual identities in this ecosystem. They should never be mixed in
a single image. Use the one that matches the content lane and platform destination.

---

### 1a. Vibration of Awesome (VOA)

**The feeling:** Someone who has lived through real things and emerged with unusual clarity.
Not spiritual performance. Not toxic positivity. The feeling after the storm passes and you
see the landscape differently. Grounded mysticism.

**Color palette:**
| Role | Value | Use |
|---|---|---|
| Primary accent | `#00e5cc` (teal/cyan) | Glow, borders, key text overlay |
| Background | `#020a0a` ~ `#030d0d` | Deep near-black, cosmic dark |
| Secondary depth | `#001a18` ~ `#003d38` | Layered dark greens, earthy-cosmic |
| Light text | `#d0fff8` | Body text on dark, subtle overlays |
| Muted | `#4a9e96` | Supporting elements, secondary details |

**Color tone:** Deep space with teal luminosity. Imagine the ocean floor at night lit by
bioluminescence. Cool, ancient, alive. Never warm-toned. Never orange, red, or brown.

**Typography for overlays (reference only ~ Ideogram should approximate):**
- Display: Cinzel Decorative or Cinzel (all-caps, spaced, Roman gravitas)
- Body/subhead: Cormorant Garamond italic (elegant, literary)
- UI/secondary: Rajdhani (clean, geometric, slightly futuristic)

**Composition style:**
- Centered or rule-of-thirds focal point
- Large negative space ~ the image breathes
- 2D painterly or photographic with subtle cosmic treatment
- Light source from within the subject (bioluminescence, not spotlight)
- Textures: water, stone, deep forest, starfield, ice, mineral
- Scale: human against vast environments (reinforces the "small in a big cosmos" feeling)

**What VOA images feel like:**
- Liminal ~ a doorway, threshold, transition moment
- Solitary but not lonely
- Ancient ~ pre-modern textures, ruins, forests, coastlines
- The moment before something shifts

**What to avoid:**
- Motivational poster energy (fists raised, "hustle" imagery)
- Corporate stock photo cleanliness
- Warm golden-hour Instagram clichés
- Bright white backgrounds
- Clipart-style illustrations
- Overly symmetrical sacred geometry patterns (that's EarthStar territory)
- Generic "mindfulness" imagery (candles, lotus, meditation poses)

---

### 1b. EarthStar Rising

**The feeling:** The moment you realize your life was never an accident. Sacred architecture
visible beneath ordinary existence. Power that comes from alignment, not force. Crystalline
intelligence, not soft mysticism.

**Color palette:**
| Role | Value | Use |
|---|---|---|
| Primary accent | `#cc44ff` (electric violet) | Primary glow, geometry highlights |
| Deep background | `#020a0a` ~ `#010d10` | Cosmic black, zero-light space |
| Secondary accent | `#00d4ff` (electric cyan) | Secondary glow, contrast |
| Gold/warm accent | `#f0c060` | Anchoring warmth against the cool violet |
| Surface | `#080d18` | Dark blue-black midground |

**Color tone:** Deep space, electric violet and cyan, geometric light sources. More intense
and saturated than VOA. Where VOA feels like a coastal night, EarthStar feels like deep
space near an active nebula.

**Typography for overlays:**
- Same Cinzel / Cinzel Decorative family as VOA
- More metallic treatment on text ~ gold foil, silver light-catch, embossed feel
- Text often centered over geometry

**Composition style:**
- Sacred geometry as primary or secondary structural element
- Stars, hexagons, triangles, Flower of Life structures ~ but photorealistic or rendered, not flat diagram
- Crystalline mineral formations, geodes, fractal structures
- Wide-angle cosmos with a single geometric focal point
- Symmetry is appropriate here (unlike VOA which prefers organic asymmetry)
- Light sources: prismatic, refractive, multi-directional

**What EarthStar images feel like:**
- Discovery ~ seeing a pattern you can't unsee
- Initiation ~ crossing a threshold into knowing
- Encoded ~ geometry that feels meaningful, not decorative
- Expansive ~ this is about scale and depth

**What to avoid:**
- Casual or mundane settings
- Hand-drawn or sketch aesthetics
- Flat 2D geometry diagrams
- Anything that reads as "astrology TikTok" (trendy, pastel, overly cute)
- Human faces (too personal for a brand/platform aesthetic)
- Text-heavy layouts that obscure the visual

---

## 2. Ideogram Technical Parameters

These are the recommended Ideogram API parameters for each use case.
They are defined here and referenced by code, not hardcoded in multiple places.

### Pinterest (both brands)
```
aspect_ratio:        ASPECT_10_16    ~ 1000x1600px portrait
model:               V_2_TURBO       ~ speed/cost; swap to V_2 for campaign-quality pins
style_type:          DESIGN          ~ bold graphic treatment, good for text overlay
magic_prompt_option: ON              ~ Ideogram enhances the prompt further
```

### Instagram (VOA only, for now)
```
aspect_ratio:        ASPECT_1_1      ~ 1080x1080px square
model:               V_2_TURBO
style_type:          REALISTIC       ~ photographic feel works better for feed posts
magic_prompt_option: ON
```

### Potential future: Story/Reel cover
```
aspect_ratio:        ASPECT_9_16     ~ vertical, matches phone screen
model:               V_2
style_type:          DESIGN
magic_prompt_option: ON
```

---

## 3. Prompt Construction Rules

### Universal rules (all platforms, all brands)

1. **No human faces.** Faces create platform-specific algorithm dynamics and reduce
   cross-cultural evergreen appeal. Use silhouettes, backs of heads, or implied presence.
2. **Include text overlay as part of the prompt.** Ideogram is best-in-class at text rendering.
   Always specify a 5-8 word phrase to embed directly in the image. This is what stops the scroll.
3. **Lead with mood, not description.** The prompt should evoke a feeling before describing a scene.
   "A feeling of standing at the edge of something vast" outperforms "a person near a cliff."
4. **Specify lighting as a character.** Lighting does more than anything else to set mood.
   Name the light source and its quality explicitly.
5. **Name the color palette** within the prompt. Ideogram responds well to explicit color direction.
6. **Avoid generic spiritual tropes in the prompt.** No lotus flowers, no chakra diagrams,
   no yin-yang symbols, no "third eye" references. The imagery should be oblique, not literal.

### Text overlay rules

- 5-8 words maximum
- Must connect to the post's core emotional truth, not its topic
- Should feel like something you'd stop to re-read
- Use sentence fragments or incomplete thoughts ~ creates cognitive pull
- Do NOT use the post title verbatim (the algorithm sees it as duplicate content)
- Examples of good overlay phrases:
  - "You were never actually lost"
  - "The version of you that already knows"
  - "What if it was always this simple"
  - "Built different. Works different."
  - "Stop optimizing. Start noticing."

---

## 4. Deriving Prompts from Blog Posts

The prompt generation pipeline works in two stages:
1. **Semantic extraction:** Pull the emotional core from the post (not the topic)
2. **Visual translation:** Map that emotional core to a scene, not an illustration of the topic

### Stage 1 ~ What to extract from a blog post

From the post, extract:
- The **core tension** (what is the problem or conflict the post addresses?)
- The **turning point** (what shift does the post argue for?)
- The **emotional register** (heavy/light, urgent/calm, raw/refined, intimate/cosmic?)
- The **content type** (creator, philosophy, nervous-system, earthstar, general)

Do NOT illustrate the literal topic. A post about dopamine detox should not generate an image
of someone on a phone looking sad. Find the emotional truth: liberation, reclaiming clarity,
the cost of numbness.

### Stage 2 ~ Visual translation by content type

| Content type | Scene direction | Mood |
|---|---|---|
| `creator` | Workshop, tools, machinery, circuitry, musical instruments | Purposeful momentum, controlled creation |
| `philosophy` | Threshold, horizon, forest path, empty room, first light | Liminal, contemplative, open |
| `nervous-system` | Still water, single candle, dark room with one open window, bare trees | Quiet, breath, suspended |
| `earthstar` | Crystal formation, star map, sacred ruin, geometric cave | Discovery, encoded meaning, initiation |
| `general` | Natural landscape, single figure in vast space | Openness, scale, possibility |

### Example derivation

**Post title:** "Why Your Nervous System Is Keeping You Stuck in a Life That Doesn't Fit"  
**Content type:** `nervous-system`  
**Core tension:** The body is protecting against a threat that no longer exists  
**Turning point:** The system can be updated  
**Emotional register:** Heavy, urgent, personal  

**Derived text overlay:** "Your body doesn't know the war ended"  

**Derived scene:** A single lit window in a dark house at dusk, fog outside, the quality of
light suggesting something suspended between two states. Deep teal glow from the window.
VOA palette. No faces. Painterly, cinematic.

---

## 5. Deriving Prompts from Video Transcripts

*(For EarthStar Command when that integration is built)*

Video transcript prompts follow the same two-stage process but with different source material.

**From a transcript, extract:**
- The **3-second hook** (the opening statement that grabs attention)
- The **payoff moment** (the insight or reveal the viewer was waiting for)
- The **chapter topic** if the video is sectioned
- The speaker's **emotional state** during the key moment

Video content is often more direct and punchy than blog content, so visual prompts should
skew more energetic and less contemplative than blog-derived images.

**Video-specific adjustments:**
- Prefer DESIGN style over REALISTIC (video thumbnails need higher contrast)
- Text overlays can be more direct/declarative (less oblique than blog overlays)
- Color treatment can be more saturated for algorithm visibility
- Include the EarthStar identity when sourcing from EarthStar Command content

---

## 6. Pinterest Board-Specific Visual Direction

Each board has its own audience expectation. Ideogram prompts should be tuned per board.

---

### Purpose and Direction
**Audience intent:** Finding clarity on what they're building and why  
**Visual style:** Open horizon, long road, single figure, first morning light  
**Palette:** VOA base with warm teal gradient, suggestion of dawn  
**Text overlay style:** Question or incomplete thought ("What you keep coming back to...")  
**Avoid:** Productivity tool imagery, clocks, checkboxes, arrows pointing up  

---

### Dopamine Detox
**Audience intent:** Reclaiming attention and sensation from overstimulation  
**Visual style:** Minimal scene, single object, near-silence as a visual quality  
**Palette:** Very dark backgrounds, single muted light source, no color saturation  
**Text overlay style:** Declarative release ("You don't have to chase this anymore")  
**Avoid:** Phone imagery (too literal), red/orange stimulation colors, busy compositions  

---

### Nervous System Reset
**Audience intent:** Regulation, calm, coming back to the body after dysregulation  
**Visual style:** Still water, breath as concept, empty vessel, simple natural textures  
**Palette:** Cool blue-green, muted teal, very low contrast backgrounds  
**Text overlay style:** Somatic and grounding ("Slow is not weak")  
**Avoid:** Meditation clichés (lotus, folded hands), clinical imagery, any urgency in composition  

---

### Conscious Creator Tools
**Audience intent:** Finding tools and workflows that actually work for creative/neurodiverse minds  
**Visual style:** Elegant workspace, instrument close-ups, circuit patterns, elegant machinery  
**Palette:** VOA teal with darker techy backgrounds, clean lines  
**Text overlay style:** Practical hook ("The tool that actually thinks with you")  
**Avoid:** Generic computer/laptop stock imagery, corporate office contexts  

---

### Field Guide
**Audience intent:** New readers looking for an entry point into the VOA worldview  
**Visual style:** Path into unknown terrain, open book or map, threshold imagery  
**Palette:** VOA full palette, slightly warmer than usual ~ approachable, inviting  
**Text overlay style:** Invitation ("The guide nobody handed you")  
**Avoid:** Educational/academic imagery, generic "self-help" visual tropes  

---

### EarthStar
**Audience intent:** Aligned with the EarthStar mission, cosmic identity, empowerment  
**Visual style:** Sacred geometry, crystalline structure, deep space, prismatic light  
**Palette:** EarthStar palette (violet, electric cyan, deep black, gold accents)  
**Text overlay style:** Initiatory, declarative ("You were built for this frequency")  
**Avoid:** Casual/everyday settings, anything that undermines the cosmic register  

---

### Empower Thyself
**Audience intent:** Claiming personal sovereignty, shedding external conditioning  
**Visual style:** Single figure at threshold, dawn breaking, storm clearing  
**Palette:** VOA base moving toward light ~ progression from dark to teal-gold horizon  
**Text overlay style:** Reclamation ("This was always yours")  
**Avoid:** Aggressive "hustle" imagery, group/crowd shots, anything performative  

---

### Vibration of Awesome (default fallback)
**Audience intent:** General VOA audience, brand discovery  
**Visual style:** Most representative of the VOA identity ~ cosmic, grounded, liminal  
**Palette:** Full VOA palette, no compromise toward any sub-brand  
**Text overlay style:** Brand voice at its most distilled  
**Avoid:** Anything that would belong more naturally on another board  

---

## 7. Instagram-Specific Visual Rules

Instagram requires a different treatment than Pinterest for the same underlying content.

**Key differences from Pinterest:**
- Square crop (1:1) vs portrait (10:16) ~ composition must work at both but is optimized for square
- Users are scrolling in real-time ~ the hook must work in 0.3 seconds
- Text overlay is optional on Instagram (algorithm may downrank heavy text)
- The image carries the emotional weight alone without relying on text
- Photorealistic style preferred over graphic design style (REALISTIC vs DESIGN in Ideogram)

**VOA Instagram image rules:**
- Subject should be slightly off-center (avoids "poster" feel)
- Deep depth of field preferred ~ shallow focus with one element crisp
- Image should hold up at small size (thumbnail in a grid)
- Color grade: underexposed slightly ~ moody, not dark for darkness's sake
- If text overlay is included, maximum 3 words, very large, clean typeface

**Content types that work on VOA Instagram:**
- `creator` ~ workspace aesthetics, tools, creation in progress
- `philosophy` ~ vast landscapes, solitary moments, light and shadow
- `earthstar` ~ crystalline forms, cosmic beauty, sacred architecture

**Content types that do NOT work on Instagram (skip visual generation):**
- `nervous-system` ~ clinical tone does not translate to visual scroll experience
- `general` ~ unclassified content not worth a visual slot

---

## 8. What to Avoid Across All Platforms

These are absolute avoids regardless of brand or platform:

| Avoid | Reason |
|---|---|
| Human faces | Algorithm dynamics, accessibility, evergreen appeal |
| Stock photo cleanliness | Undermines authentic brand voice |
| Warm golden-hour tones | Cliché; incompatible with VOA/EarthStar palette |
| Motivational poster layouts | Cheap, low-trust, brand-diluting |
| Literal topic illustration | A post about AI should not show a robot |
| Symmetrical stock chakra art | Too generic for either brand |
| Bright white backgrounds | Wrong palette entirely |
| Aggressive reds/oranges | Not in either brand palette; activates wrong emotions |
| Watermarks or visible platform UI | Obvious, embarrassing, not brand-appropriate |
| Text errors | Always review Ideogram output for typos before publishing |

---

## 9. Prompt Template Structure

When constructing an Ideogram prompt programmatically, follow this structure:

```
[MOOD SENTENCE]. [SCENE DESCRIPTION]. [LIGHTING]. [COLOR PALETTE]. 
Bold text overlay reads: "[5-8 WORD PHRASE]". [STYLE NOTE]. [AVOID NOTE].
```

**Example (philosophy / VOA Pinterest):**

> A feeling of standing at the edge of something irreversible. Lone silhouette on a coastal 
> cliff, fog below, stars emerging above, no horizon visible. Light source is interior ~ 
> soft teal bioluminescence from within the cliff face. Deep black and teal color palette, 
> #020a0a background, #00e5cc accents. Bold cinzel-style text overlay reads: "You were never 
> actually lost". Painterly, cinematic, no faces, high contrast. Avoid warm tones, golden 
> hour, motivational poster composition.

**Example (earthstar / Pinterest EarthStar board):**

> A sense of encoded intelligence visible beneath ordinary reality. A crystalline geode 
> cross-section revealing a geometric star pattern inside, deep space visible through the 
> crystal walls. Light source is prismatic, refracting electric violet and cyan across the 
> frame. Color palette: #cc44ff violet, #00d4ff cyan, #010d10 black, #f0c060 gold accent. 
> Bold metallic text overlay reads: "You were built for this frequency". Photorealistic 
> crystal render, symmetrical composition, no faces. Avoid casual settings, flat geometry.

---

## 10. Quality Criteria Before Publishing

Before an Ideogram image is used in syndication, it should pass these checks:

- [ ] No human faces visible
- [ ] Text overlay is readable and typo-free
- [ ] Color palette matches the target brand (VOA vs EarthStar)
- [ ] Composition reads clearly at thumbnail size
- [ ] Image does not illustrate the literal topic (passed the "oblique test")
- [ ] Style is consistent with the target platform (DESIGN for Pinterest, REALISTIC for Instagram)
- [ ] No watermarks or artifacts
- [ ] The image would make you stop scrolling

---

*This policy is referenced by `scripts/generate-pinterest-image.js` and any future image generation modules.*  
*When prompt logic changes, update this document first.*  
*Code derives from the policy ~ not the other way around.*  
