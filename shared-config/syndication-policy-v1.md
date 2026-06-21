# Vibration of Awesome ~ Syndication Policy v1

**Status:** Active  
**Engine:** VOA Blog + EarthStar Command (dual-engine)  
**Last updated:** 2026-05-15  

This document is the source of truth for how VOA blog content and EarthStar Command video
content share platforms without triggering spam signals, algorithmic suppression, or audience
fatigue. Both engines read from this policy.

---

## 1. Platform Ownership

Platform roles are assigned to prevent both engines from competing for the same audience slot
on the same day. These are defaults, not hard locks.

| Platform | Primary Owner | Secondary | Blog posts? | Video posts? |
|---|---|---|---|---|
| YouTube | EarthStar Command | ~ | No | Yes |
| Dev.to | VOA Blog | Dev.to account 2 for art-buyer extras only | Yes (primary always; account 2 selective) | No |
| Blogger | VOA Blog | ~ | Yes (always) | No |
| WordPress (EarthStarRising) | VOA Blog | ~ | Yes (always) | No |
| Tumblr VOA | VOA Blog | ~ | Yes (always ~ backlink tier) | No |
| Tumblr ESR | NOT ACTIVE | ~ | No (wired in quota table only, not in live syndication) | No |
| Facebook VOA | VOA Blog | ~ | Yes (selective) | Rarely |
| Facebook EarthStar | EarthStar Command | VOA (earthstar only) | Limited | Yes |
| Bluesky VOA | VOA Blog | ~ | Yes | No |
| Bluesky ESR | EarthStar Command | ~ | No (suppressed by default) | Yes |
| Mastodon VOA | VOA Blog | ~ | Yes | No |
| Mastodon ESR | EarthStar Command | ~ | No (suppressed by default) | Yes |
| Threads VOA | VOA Blog | ~ | Yes (native thread format) | ~ |
| Threads ESR | EarthStar Command | ~ | No (separate account) | Yes |
| Pinterest VOA (@awesomevibe) | VOA Blog | ~ | Yes (evergreen, board-routed) | ~ |
| Pinterest ESR | EarthStar Command | ~ | No (separate account) | Yes |
| Instagram VOA | VOA Blog | ~ | Yes (all content types — early growth routing) | ~ |
| Instagram ESR | EarthStar Command | ~ | No (separate account) | Yes |

---

## 2. Backlink Tier Philosophy

The following platforms are **SEO infrastructure, not audience channels**.

They exist to:
- Create indexed backlinks to VOA posts
- Build domain authority for vibrationofawesome.com
- Distribute canonical signals across the web
- Generate organic discovery from high-DA platforms

**These always receive every blog post. No throttling. No filtering. No cooldowns.**

```
devto              ~ canonical tag, DoFollow, high-DA tech platform (VOA canonical URL set)
tumblr_voa         ~ indexed, DoFollow, VOA brand continuity
blogger            ~ Google-owned, fast indexing, DoFollow
wordpress_earthstar ~ WordPress.com indexed, DoFollow, EarthStarRising brand
```

**Dev.to account 2:** `DEVTO2_API_KEY` exists for the second Dev.to account. It is **not** part of the default backlink tier. It is used only for art-buyer extra posts via platform key `devto2` / syndication profile `art-devto2-only`. Do not send normal posts to both Dev.to accounts; the same canonical URL should not be duplicated across accounts.

**Note on Tumblr ESR:** `tumblr_esr` appears in the quota tables for planning purposes but is **NOT wired into live syndication** in `syndicate.js`. Only `tumblr_voa` is actively posted to. If you add Tumblr ESR to the live pipeline, update this document and the backlink tier list in `scripts/lib/policy.js`.

The content sent to these platforms is always **original AI-generated companion articles** inspired by the source post ~ never copy-paste, never excerpts. Each companion article must:

1. Have a **unique title** (not identical to the VOA source post)
2. Have a **unique body** (AI-generated from the source, not excerpted from it)
3. Include **one natural backlink** to the original VOA post
4. Set a **canonical URL** pointing to VOA where the platform supports it (Dev.to does; Blogger and WordPress do not)

The VOA canonical post is always the primary source. All companion and backlink content is derivative by design but must be substantially different to avoid duplicate content penalties.

---

## 3. Social Throttling Philosophy

Social platforms are **audience channels, not SEO infrastructure**.

They can fatigue, suppress, flag, or penalize accounts that post too aggressively or
repetitively. The video engine and blog engine combined can easily exceed safe limits on
shared platforms.

**Rules:**

1. Not every blog post hits every social platform.
2. Content type determines which social platforms are appropriate.
3. The video engine and blog engine should not post to the same social platform on the same day
   unless the posts are clearly different in format, tone, and CTA.
4. Same URL posted to the same platform more than once per 48 hours is a spam signal.
5. Same CTA in every post is a spam signal. Rotate them.

---

## 4. VOA vs EarthStar Platform Roles

### Facebook VOA
- VOA blog engine primary
- Personal, conversational, slower cadence
- Blog posts: yes, but selective by content type
- Video posts: occasional only (not primary home for video)
- Max: 2 posts/day across both engines combined

### Facebook EarthStar
- EarthStar Command primary
- Initiative, mission, cosmic/philosophical
- Blog posts: only EarthStar-aligned content
- Video posts: yes
- Max: 2 posts/day across both engines combined

### Bluesky (ESR + VOA)
- Both engines equally
- High philosophical tolerance, strong open-web community
- Blog posts: all content types
- Video posts: yes (teasers, links)
- Max: 5 posts/day per account

### Mastodon (ESR + VOA)
- Both engines equally
- Federated, intellectual, no spam detection pressure
- Blog posts: all content types
- Video posts: yes
- Max: 5 posts/day per account

### Threads
- **VOA Threads** (Publer ID: `6a069b7979cc0b32f3235166`) and **ESR Threads** are separate accounts
- VOA blog engine posts to **VOA Threads only**
- Content format: **native 3-part mini-thread** (1/3 ~ 2/3 ~ 3/3), not a link dump
- Each part is a connected thought; URL appears only in 3/3
- Max: 4 posts/day total across both engines

### Instagram
- **VOA Instagram** (Publer ID: `6a0698ee1f0e47d9f3f18a43`) and **ESR Instagram** are separate accounts
- VOA blog engine posts to **VOA Instagram only**
- Content format: visual-first caption, scroll-stopping hook, no clickable URL in caption, 6-8 hashtags
- Image: Ideogram-generated when available, falls back to Pexels article image
- Blog posts: **creator, philosophy, earthstar content only** ~ not nervous-system, not general
- Video posts: EarthStar Command primary (Reels)
- Max: 2 posts/day total across both engines

### Pinterest
- Both engines, staggered
- High volume tolerance, evergreen content wins
- Blog posts: evergreen content types (creator, general, earthstar)
- Video posts: yes (cover image pins)
- Max: 10 posts/day total across engines
- Philosophy and nervous-system posts are not Pinterest-native ~ skip them

---

## 5. Pinterest Strategy

Pinterest is a search engine, not a social feed. Posts surface weeks or months after pinning.

Guidelines:
- Pin only content that is evergreen and save-worthy
- Keyword-rich descriptions (already enforced in generate-captions.js)
- Do not pin the same URL twice
- Preferred content types for blog engine: creator tools, AI workflow, earthstar alignment
- Avoid pinning: raw personal reflection, trauma processing, nervous-system regulation
  (these perform poorly as pins ~ the audience mode does not match)
- Both engines can pin on the same day if topics differ significantly

---

## 6. Selective Social Syndication Rules

Blog content is routed to social platforms based on detected content type.

### Content Type: `creator`
AI tools, creator workflow, music, automation, building.
Social: Bluesky VOA, Mastodon VOA, Facebook VOA, Pinterest VOA, Threads VOA, **Instagram VOA**

### Content Type: `philosophy`
Mindset, awareness, consciousness, personal reflection, purpose.
Social: Bluesky VOA, Mastodon VOA, Facebook VOA, Threads VOA, **Instagram VOA**
Skip: Pinterest (audience mode mismatch), Facebook EarthStar, nervous-system content

### Content Type: `nervous-system`
ADHD, anxiety, dopamine, neurodivergent, regulation, healing.
Social: Bluesky VOA, Mastodon VOA, Facebook VOA, Pinterest VOA, Threads VOA, Instagram VOA
Skip: Facebook EarthStar
Note: Instagram and Pinterest now included during early-growth phase (consistency over best-fit).
Revisit suppression rules when account has engagement data to guide decisions.

### Content Type: `earthstar`
EarthStar Initiative, sacred geometry, cosmic identity, empowerment.
Social: Bluesky VOA, Mastodon VOA, Facebook VOA, Facebook EarthStar, Pinterest VOA, Threads VOA, **Instagram VOA**

### Content Type: `general`
Unclassified or mixed content.
Social: Bluesky VOA, Mastodon VOA, Facebook VOA, Pinterest VOA, Threads VOA, Instagram VOA
Skip: Facebook EarthStar
Note: Instagram included during early-growth phase. Revisit when engagement data is available.

---

## 7. Visual Generation Strategy

### Ideogram ~ Pinterest and Instagram

When `IDEOGRAM_API_KEY` is set, the blog engine generates an AI image for each syndication run.

- **Model:** V_2_TURBO (speed + cost); swap to V_2 for maximum quality
- **Format:** ASPECT_10_16 portrait (1000x1600px), DESIGN style, magic prompt ON
- **Prompt:** Claude Haiku generates a Pinterest-optimized visual prompt from post title/excerpt
- **Routing:** Image is used for both Pinterest and Instagram if both are being syndicated
- **Storage:** Images are NOT saved locally; Publer fetches the ephemeral Ideogram URL during the same run
- **Fallback:** If Ideogram fails or key is missing, Pexels stock photo is used instead

### Image Rules
- Never pin the same image twice to the same Pinterest board
- Instagram images should feel emotional and visual, not informational
- Pinterest images should be keyword-rich, evergreen, and save-worthy
- Do not use images for Threads (text-only platform for VOA blog content)

---

## 8. Anti-Spam Rules

1. **No same URL twice** to the same platform within 48 hours.
2. **No same CTA link** in consecutive posts to the same platform. Rotate.
3. **No consecutive posts** to Facebook VOA or Facebook EarthStar from the same engine within
   6 hours.
4. **No same topic** across blog and video on the same platform within 72 hours.
5. **Captions must vary** by platform. Never use the same caption across multiple platforms.
6. **Image must vary** where image is used. Do not pin the same image twice.
7. **Hashtags must be relevant**. Do not use the same hashtag block for every post.

---

## 9. CTA Rotation Philosophy

Every post should not point to the same destination. Rotating CTAs:

1. Avoids algorithmic detection of repetitive link patterns
2. Surfaces different VOA entry points to different audience segments
3. Matches CTA to content type (field guide for philosophy, art store for earthstar, etc.)

### CTA Pool (Blog Engine)

| ID | Label | URL | Best for |
|---|---|---|---|
| field-guide | Field Guide | /field-guide/ | Philosophy, general, first-time readers |
| art-store | Art Store | /art-store/ | EarthStar, creator, community posts |
| aura | AURA | /aura/ | Philosophical, nervous-system, personal posts |
| blog | Blog | /blog/ | Any post targeting new readers |
| earthstar | EarthStar Initiative | /earthstar/ | EarthStar-aligned, mission content |

Rotation state is tracked per lane in `static/_data/cta-rotation-state.json`.

### CTA Matching Guidelines
- `philosophy` posts: prefer Field Guide or AURA
- `creator` posts: prefer Blog or Field Guide
- `nervous-system` posts: prefer AURA or Field Guide
- `earthstar` posts: prefer EarthStar or Art Store
- `general` posts: rotate freely through pool

---

## 10. Daily Platform Quotas (Both Engines Combined)

These are safe limits before platform suppression risk increases.

| Platform | Safe Max/Day | Notes |
|---|---|---|
| facebook_voa | 2 | More = suppressed organic reach |
| facebook_earthstar | 2 | Video engine primary |
| instagram | 2 | Reels + 1 feed max |
| threads | 4 | High tolerance |
| mastodon_esr | 5 | Federated, tolerant |
| mastodon_voa | 5 | Federated, tolerant |
| bluesky_esr | 5 | Growing, tolerant |
| bluesky_voa | 5 | Growing, tolerant |
| pinterest | 10 | Highest tolerance |
| tumblr | 10 | Reblog culture |
| devto | 1 per post | Once per blog article |
| blogger | 1 per post | Once per blog article |
| wordpress_earthstar | 1 per post | Once per blog article |

---

## 11. Minimum Cooldown Windows

Minimum time between posts to the same platform from any engine.

| Platform | Cooldown |
|---|---|
| facebook_voa | 6 hours |
| facebook_earthstar | 6 hours |
| instagram | 8 hours |
| threads | 4 hours |
| mastodon (any) | 2 hours |
| bluesky (any) | 2 hours |
| pinterest | 2 hours |
| tumblr | 1 hour |

---

## 12. Time Staggering

- Blog posts: prefer morning window (7am~10am local)
- Video posts: prefer evening window (5pm~8pm local)
- Pinterest: either window is fine (discovery platform, not real-time)
- On heavy days (blog + video both publish): suppress blog social to 3 platforms max

---

## 13. Future Orchestration Notes

These are not implemented in v1. They are documented for v2 planning.

### Master Content Calendar
A shared `static/_data/content-calendar.json` where both engines register planned posts
by date and platform. Before scheduling, each engine checks for conflicts.

### Cross-Engine Cooldown Enforcement
Phase 2 of `scripts/lib/policy.js` will read `syndication-log.json` to enforce cooldown
windows across both engines, not just advisory warnings.

### Topic Pairing
Blog and video should be paired weekly: blog post goes out 2~3 days before the video on
the same niche topic. The blog primes the audience; the video deepens it. Neither competes.

### Analytics Feedback
A weekly script will read referral data and update content-type routing weights. If
philosophy posts drive more traffic from Mastodon than Bluesky, Mastodon gets boosted
weight for that type.

### Platform Role Review
Platform roles should be reviewed quarterly as audience behaviors shift. Instagram Reels
dominance may decrease. Bluesky community growth may change strategy. Policy v2 will
incorporate observed performance data.

---

*This policy is enforced by `scripts/lib/policy.js` in the VOA blog engine.*  
*The EarthStar Command engine maintains a parallel version of this document.*  
*Both documents must stay in sync when platform roles change.*
