# VOA Experience Ecosystem Roadmap

Living reference for the authority hub/tool ecosystem: current state, the
Experience metadata convention, future experience priorities, and the
deterministic syndication approach. Read alongside `static/_data/authority-hubs.json`
and `static/_data/authority-assets.json`, which remain the source of truth for
live data ~ this doc is the strategic layer on top.

## Hub -> Flagship Experience (current state)

| Hub | Articles | Primary Experience | Secondary | Health |
|---|---|---|---|---|
| Nervous System Regulation | 7 | Nervous System Reset (ritual) | none | Good |
| ADHD & Focus | 1 | ADHD Focus Session Planner (ritual) | Digital Attention Audit | Good (thin article count, flagship correct) |
| Dopamine & Attention | 3 | Digital Attention Audit (assessment) | none | Good |
| Meditation | 1 | **none** | Breathwork Timer (approved, unpublished) | Missing flagship |
| Creativity | 40 | **none** | Creative Energy Assessment (proposed) | Missing flagship ~ largest hub without one |
| Personal Growth | 7 | **none** | Weekly Life Review (proposed) | Missing flagship |
| Self Trust | 1 | **none** | none | No asset in backlog yet |
| Purpose | 8 | **none** | Personal Values Sorter (proposed) | Missing flagship |
| AI Creator Workflows | 86 | /ai-engine/ (flagship product) | none | Correct as-is ~ AI Engine *is* the flagship |
| VOA Concepts | 3 | /field-guide/ (flagship resource) | none | Correct as-is ~ Field Guide *is* the flagship |

Three hubs correctly route to a real interactive experience today. Two
correctly route to an existing flagship *product* (AI Engine, Field Guide)
rather than a tool, which is the right call ~ those hubs shouldn't get a
lesser, redundant tool bolted on just to fill the slot. Four hubs
(Meditation, Creativity, Personal Growth, Purpose) have no flagship yet and
are the real gaps, not bugs.

## The Experience metadata convention

Any published interactive asset in `authority-assets.json` may carry an
`experience` object (schema documented in that file's own `_meta.experienceSchema`).
Fields: `category`, `primaryPurpose`, `emotionalOutcome`, `practicalOutcome`,
`estimatedMinutes`, `artifactType`, `replayValue`, `printable`,
`neighboringExperiences`, `recommendedFollowUp`. All three published
experiences (Digital Attention Audit, ADHD Focus Session Planner, Nervous
System Reset) now carry real, accurate values ~ not placeholders. Nothing
reads this data yet; it exists so a future recommendation engine, a richer
hub page, or a "which experience fits you right now" cross-tool feature can
be built directly from it instead of re-deriving the same facts ad hoc.

## Top 20 future experiences, ranked

Ranked by a blend of usefulness, originality, backlink/SEO potential,
bookmark/shareability, implementation effort, and strategic fit (fills a
real gap vs. duplicates something that already exists). Generic quizzes and
calculators are deliberately excluded ~ every entry below produces a real
reflective/practical outcome and (where noted) a distinct saveable artifact,
matching the "Holy Shit" bar the first three experiences were held to.

| # | Experience | Hub | Why it matters | Artifact idea | Effort |
|---|---|---|---|---|---|
| 1 | **The Creative Signal Finder** | Creativity | Largest hub (40 articles) with zero flagship. Surfaces what's *actually* blocking output right now (perfectionism, comparison, burnout, unclear vision, fear of judgment) and matches it to one unblocking practice. | A generative "Spark Pattern" unique to the blocker + practice chosen | Medium |
| 2 | **The Compass Point** | Purpose | Second-largest gap hub (8 articles). Clarifies direction from energy/values/current season instead of a generic "find your purpose" quiz. | A "Direction Card" pointing to one small next action | Medium |
| 3 | **The Presence Key** | Meditation | Only hub with an *approved-but-unpublished* asset and no flagship. A short settling sequence, not a bare timer. | "Presence Rings" (concentric depth marks, distinct from Reset Mandala) | Medium |
| 4 | **The Honest Mirror** | Personal Growth | 7 articles, growing. A real check-in (what's working / what's avoided / one honest next step), not a journal template. | A "Growth Waypoint" card | Medium |
| 5 | Digital Detox Planner | Dopamine & Attention | Already in the backlog as "proposed." Pairs naturally with the Digital Attention Audit as its practical follow-through. | Reset-style short plan card | Low (spec already exists) |
| 6 | Weekly Life Review | Personal Growth | Already "proposed." A recurring companion to Honest Mirror rather than competing with it. | none needed ~ journal-style | Low |
| 7 | Personal Values Sorter | Purpose | Already "proposed." Could stand alone or feed into Compass Point as a first step. | Values card | Low |
| 8 | Creative Energy Assessment | Creativity | Already "proposed." Positioned as secondary to Creative Signal Finder once that exists. | none needed | Low |
| 9 | **The Self-Trust Ledger** | Self Trust | Only hub with zero backlog assets. Reflects on one recent kept vs. broken self-promise ~ deliberately not a scored assessment. | "Trust Balance" reflection card | Low-Medium |
| 10 | Breathwork Protocol Library | Meditation | Already "proposed," reference-type (no build needed beyond content). | none | Low |
| 11 | Meditation/Breathwork Timer | Meditation | Already "approved." Ships as a secondary alongside Presence Key, not instead of it. | none | Low |
| 12 | VOA Core Concepts Glossary | VOA Concepts | Already "approved." Reference asset, complements Field Guide as primary. | none | Low |
| 13 | **AI Workflow Matcher** | AI Creator Workflows | Companion to AI Engine (stays primary): matches a creative task type to a starting tool stack. | none needed | Medium |
| 14 | **The Ritual Finder** | Cross-hub (once 4+ flagships exist) | A genuine connective tool: "which of VOA's rituals fits how you feel right now" spanning Reset/Planner/Audit/Presence Key/Signal Finder. High strategic value *after* the gap hubs ship, not before ~ nothing to route to yet. | none needed, it's a router | Medium, later |
| 15 | Attention Environment Audit | Dopamine & Attention | A physical-space companion to the Digital Attention Audit: which objects/habits in your literal environment are attention traps. | none needed | Medium |
| 16 | The Boundary Practice | Self Trust / Personal Growth overlap | Reflects on one recent boundary moment, held or not. | none needed | Low |
| 17 | Values-Matched Art Finder | Art Buying Online | Ties EarthStar/art-store browsing to the same values language as Purpose/Compass Point ~ commerce and philosophy in one experience. | none needed | Medium-High |
| 18 | Shadow Work Starter Ritual | Emotional Regulation | Directly ties to existing "Shadow Work for Beginners" article cluster. | none needed | Medium |
| 19 | The Morning Signal | Spiritual Productivity | A short values-aligned intention generator, distinct from generic "morning routine" content. | Intention card | Low-Medium |
| 20 | The Release Valve | Creator Automation / burnout overlap | A 90-second decompression check for overloaded solo creators, adjacent to but distinct from Nervous System Reset (creator-specific framing). | none needed | Low |

**Immediate recommendation**: build #1-4 next (one per currently-flagshipless
hub), in that order, before anything further down the list ~ they close
real gaps rather than adding a second experience to a hub that already has
one.

## Quality review of the three existing experiences

- **Digital Attention Audit**: Clear, fast (2 min), honest non-diagnostic
  framing, has Copy but *no Print* button ~ the one existing experience that
  doesn't match the printable-artifact bar the other two set. Low-cost future
  fix: add a print button/style, matching the Planner and Reset. Not done in
  this pass (scope: audit and architecture, not new build work).
- **ADHD Focus Session Planner**: Strongest replay value of the three (built
  to be used every session, not once). Focus Star + Focus Card remains the
  clearest "bookmark and send to a friend" artifact in the ecosystem.
- **Nervous System Reset**: Genuinely different geometry (Reset Mandala) from
  the Focus Star, as required when it was built. Highest current inbound
  recommendation count (7) since its hub has the most routed articles among
  the three tool-bearing hubs.

None of the three need new animation, AI, APIs, or accounts. The one
concrete, low-effort quality gap (DAA's missing print button) is the single
thing worth doing before building anything new.

## Automation readiness (no homepage change, no new nav)

Every future experience already inherits, with zero extra work per-tool:

- **Hub pages**: `renderHub()` pulls `assets.filter(a => a.hub === hub.slug)`
  automatically (self-referencing assets are now excluded, see below).
- **Related reading**: `getAuthorityTargets()` resolves primary + optional
  `secondaryAssets` per hub automatically for every blog post.
- **Sitemap**: `update-sitemap.js` already walks `static/tools/*/index.html`
  and `static/hubs/*/index.html` generically ~ a new tool directory is picked
  up with no code change.
- **Schema**: `pageChrome()`'s `breadcrumbTrail` + `WebApplication` schema
  pattern is copy-ready for a new `renderX()` function.
- **Authority link checker**: `check-authority-links.js` auto-discovers new
  `static/tools/*/index.html` files the same way it discovers hubs.
- **Analytics**: the `experience_start` / `experience_complete` /
  `artifact_copy` / `related_resource_click` GA4 event naming convention
  (with a `tool_id`) is established and ready to reuse verbatim.
- **Future homepage integration**: deliberately *not* touched this pass, per
  explicit instruction ~ the architecture is ready whenever the homepage's
  own planned redesign wants to surface it.

Two real defects were closed this pass so the above is actually true today,
not just in principle: a hub's own self-referencing "reference" asset could
silently win the primary-recommendation slot ahead of a real tool (fixed in
`getAuthorityTargets()` and `renderHub()`), and ADHD & Focus's primary
pointed at the wrong tool (fixed).

## Syndication architecture

`scripts/lib/experience-syndication.js` (new, this pass) generates
deterministic, template-based syndication content per experience for
WordPress, Blogger, Medium, Tumblr, Reddit (non-promotional framing),
Pinterest, Quora, a generic backlink-landing-page shape, and a one-line
social snippet. Pure functions of the asset's own `experience` metadata;
same input always produces the same output; every output links back to the
canonical VOA URL. **Not wired into `syndicate.js`'s live pipeline and does
not call any API** ~ this is preparation so that when an experience is ready
to syndicate, the same deterministic approach already used for blog posts is
available without inventing per-tool copy from scratch.
