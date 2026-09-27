# Module: Visuals (hero images, Pinterest, Instagram, registries)

Read this before touching image generation, `instagram-archetypes.js`, utility cards, `static/images/boom/`, or the image registries. Also read `shared-config/visual-generation-policy-v1.md`.

## System A vs System B

- **System A (live):** `generate-pinterest-image.js` and `generate-instagram-visual.js` run in the automated drip/syndication flow. `syndicate.js → recordImageUsage()` logs each Pexels/Ideogram/local choice to `static/_data/image-registry.json` (`post_slug, source, url, platforms_used, pinterest_board, ideogram_prompt, timestamp`, capped at 500).
- **System B (future, manual only):** `scripts/lib/build-visual-prompts.js --generate` builds four visual types per post (`pinterest`, `instagram`, `sacred_diagram`, `field_guide_artifact`) into `static/_data/visual-registry.json` (created on first run).
- **Do not merge or delete either registry** until System B is wired into live syndication and tested end to end. The shared calendar, when built, should read System B.

## Instagram content mix: art + utility (2026-07-24)

`INSTAGRAM_ARCHETYPES` (`scripts/lib/instagram-archetypes.js`) has two families selected by **one** engine, `selectInstagramArchetype()`:
- `family: "art"`: 8 Ideogram archetypes (`textRenderMode: "ideogram"`).
- `family: "utility"`: `list-resource-card`, `curiosity-hook-card`, `mini-guide-card`, `comparison-card` (`textRenderMode: "deterministic"`, no Ideogram call).

Family repetition is penalized at half weight; `analyzeInstagramMonotony()` warns on `FAMILY MONOCULTURE` (3 in a row) and `FAMILY OVERUSE` (5+/6). Extend this engine; never build a second rotation system.

- **Grounding:** `buildUtilityCardConcept()` (`scripts/lib/utility-card-concept.js`) reads ~3000 chars of the actual post body and judges fit first. `{fit:false}` falls back to an art archetype. **Never weaken this check** to force more utility volume; it is what prevents generic AI-slop lists.
- **Rendering:** `scripts/lib/utility-card-renderer.js` renders SVG + `sharp` over a programmatic gradient. Every character is the exact concept string (no image model spells anything). XML-escape all text. Overflow is truncated with a visible ellipsis via `wrapTextLimited()`; this fix is load-bearing.
- **Upload:** rendered buffers have no public URL yet, so `uploadPublerMediaBuffer()` (`scripts/lib/publer-media-upload.js`) uses Publer's multipart `POST /media` (verified against the live API). It returns `{id, path}` where `path` is a fetchable HTTPS URL, so downstream URL threading is unchanged. It is a separate module to avoid a circular import with `generate-instagram-visual.js`.
- **Measuring:** `family` and `utilityFormat` are stored per post in `generation-memory.json` so performance can later be joined against existing analytics (EarthStar Command's Creator Intelligence). Don't build a second analytics system here.

## Hero images (Core Web Vitals)

`static/images/boom/` is the local NASA/Hubble hero pool, used as CSS `background-image` in post headers (not `<img>`, so no alt text and invisible to image search). `scripts/optimize-hero-images.js` (sharp) resized them to a 1600px long edge, JPEG q80, in place; PNGs were converted to JPEG with post references rewritten automatically. Keep new hero images at that size.

`BOOM_IMAGES` in `scripts/patch-draft-posts.js` is the **rotation pool for future drafts**. Some entries are not used by any live post, so "unreferenced by a live post" does not mean "safe to delete". Check this list first.
