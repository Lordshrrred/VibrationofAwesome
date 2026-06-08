# VOA Public Site Truth

Audit date: 2026-06-08

## 1. Public Website Role

Vibration of Awesome is the public website and brand surface for Matt EarthStar's philosophy, writing, AI-assisted creator content, downloads, AURA, EarthStar Initiative pages, and EarthStar Art Store.

The public site is not presented as a public SaaS dashboard, agency platform, client-account manager, ads tool, DM/comment automation tool, or Meta publishing tool. The public-facing Meta story is read-only analytics through EarthStar Command.

Internally, this repo also contains a VOA blog syndication engine, dashboards, scripts, and data files for distributing blog content. That internal machinery is more active than the main public brand pages imply.

## 2. Current Routes

| Route | Purpose | Visible CTA | Social/platform links | External embed/feed/form |
| --- | --- | --- | --- | --- |
| `/` | Home page for VOA philosophy and content paths. | Field Guide, Blog, Volume Two, Forest Temple, Boom Frequency, EarthStar, Art Store. | No public social follow links found on the home page. | Google tag in base layout. |
| `/field-guide/` | Free Field Guide landing page. | Email capture for PDF. | No public social follow links found. | Uses email capture API and downloadable PDF. |
| `/field-guide/thank-you/` | Download/thank-you page. | Download/open guide. | No public social follow links found. | Download delivery flow. |
| `/ai-engine/` | Creative Exoskeleton/AI Engine landing page. | Email capture for AI guide, Field Guide link. | Links to Claude, ChatGPT, ElevenLabs, Claude Code docs, VS Code, Publer. | Uses `/api/capture-email`; mentions Publer as scheduling/publishing layer. |
| `/blog/` | Blog index. | Read Forest Temple or Boom Frequency. | No public social follow links found. | Static post indexes from JSON data. |
| `/blog/matt/` | Forest Temple personal writing lane. | Read posts. | Legacy posts include occasional Facebook comment references and YouTube embeds. | Static blog content. |
| `/blog/boom/` | Boom Frequency AI-assisted content lane. | Read posts. | Posts contain platform/topic references; no global social follow block found. | Static blog content generated from data. |
| `/earthstar/` | EarthStar Initiative landing page. | Philosophy, Vision, Merch. | Links to VOA Art Store/Spring merch. | Static page. |
| `/earthstar/vision/` | EarthStar vision page. | Merch/related EarthStar navigation. | Spring merch link. | Static page. |
| `/earthstar/philosophy/` | EarthStar philosophy page. | Merch/related EarthStar navigation. | Spring merch link. | Static page. |
| `/art-store/` | EarthStar Art Store. | Product buttons, full Spring store, portfolio. | Spring store and product URLs. | External Spring/CreatorSpring checkout links. |
| `/portfolio/` | Portfolio archive. | Browse pieces/art. | No social follow links found in audited entry point. | Static data from portfolio JSON. |
| `/aura/` | AURA AI companion product page. | Start free chat, premium checkout. | No social follow links found. | Calls `/api/chat`, `/api/create-checkout`, `/api/verify-subscription`; Stripe checkout. |
| `/user-manual/` | Volume Two waitlist/sales page. | Email/waitlist, Field Guide. | No social follow links found. | Uses `https://vibrationofawesome-mailer.vercel.app/api/capture-email`. |
| `/privacy/` | Privacy policy. | Contact email, data deletion link. | Mentions Meta/Facebook/Instagram read-only analytics. | Static legal page. |
| `/data-deletion/` | Meta data deletion instructions. | Email deletion request. | Mentions Facebook/Instagram/Meta settings. | Static legal page. |
| `/terms/` | Terms of service. | Legal/navigation only. | No social follow links found in audit. | Static legal page. |
| `/contact/` | Contact page. | Email and contact form. | No social follow links found. | Netlify-style form posting to `/`. |
| `/dashboard/` | Publicly available static dashboard route, though operational/admin in nature. | Dashboard tabs/admin links. | Shows syndication platform statuses and URLs. | Fetches local JSON data, WordPress public API, backlink API. |
| `/admin/` | Admin/editor entry. | Login/editor controls. | None. | Editor APIs/GitHub-backed save flow. |

Additional legacy redirect/article routes exist for older posts such as `/vibration-of-awesome/`, `/paradigm-of-abundance/`, `/empower-your-life/`, and other archive URLs.

## 3. Public Social Links By Platform

| Platform | URL/link target found | Account/brand | Location | Status |
| --- | --- | --- | --- | --- |
| Instagram | No public profile link found. Internal Publer account detail says `vibrationofawesome` / `@vibrationofawesome`. | VOA | Internal docs/data only. | Public follow link missing; internal routing treats it as VOA. |
| Threads | No public profile link found. Internal Publer account detail says `@vibrationofawesome`. | VOA | Internal docs/data only. | Public follow link missing; internal routing treats it as VOA. |
| Facebook | Public post URLs in syndication data use `facebook.com/175302679321012_...`; privacy mentions Facebook Page analytics. | VOA page, plus legacy EarthStar in old data/docs. | Dashboard/data/internal docs, legal copy. | No public follow link found. Internal data implies active Facebook VOA publishing. |
| YouTube | Legacy embeds in Matt archive posts. Publer account inventory includes YouTube, but not as a public link. | Legacy/video content, not clearly VOA follow destination. | Blog archive embeds and internal health details. | No current VOA YouTube public link found. |
| Pinterest | No public profile link found. Internal docs say VOA Pinterest `@awesomevibe` and board "Vibration of Awesome"; scripts and AI Engine mention Pinterest. | VOA | Internal docs/scripts, AI Engine copy. | Public follow link missing; internal routing treats Pinterest as active. |
| TikTok | Publer account inventory mentions TikTok, but no public profile link found. | Unknown/not public. | Internal health details only. | No public target found. |
| X/Twitter | Only Twitter/X card metadata and Publer inventory mention. | Not public. | Metadata/internal health only. | No public target found. |
| Bluesky | `https://bsky.app/profile/vibrationofawesome.bsky.social/...` in syndication data. ESR legacy data uses `unlimitedpotential.bsky.social`. | VOA plus ESR legacy. | Dashboard/data/internal docs. | No public follow link found; internal data implies active VOA publishing. |
| Mastodon | `https://mastodon.social/@Vibrationofawesome/...` in syndication data. ESR legacy data uses `@unlimitedpotential`. | VOA plus ESR legacy. | Dashboard/data/internal docs. | No public follow link found; internal data implies active VOA publishing. |
| Publer | `https://publer.com/EarthStar` on `/ai-engine/`; internal API usage in scripts. | EarthStar/VOA tooling. | AI Engine public page and internal scripts. | Public page explicitly names Publer as distribution tooling. |
| Tumblr | `https://vibrationofawesome.tumblr.com/...` in syndication data; `earthstarrising.tumblr.com` in legacy data. | VOA plus ESR legacy. | Dashboard/data/internal docs. | No public follow link found; internal data implies active VOA posting. |
| Dev.to | `https://dev.to/earthstarrising/...` in syndication data. | EarthStar Rising. | Dashboard/data/internal docs. | SEO/backlink destination, not a public VOA social link. |
| Blogger | `https://vibrationofawesomeearthstar.blogspot.com/...` in data/API defaults. | VOA/EarthStar backlink site. | Dashboard/data/API defaults. | SEO/backlink destination, not public follow link. |
| WordPress | `https://earthstarrisingsun.wordpress.com/...` in docs/data/dashboard. | EarthStar Rising. | Dashboard/data/internal docs. | Separate EarthStar Rising content destination. |
| Spring/CreatorSpring | `https://earthstar.creator-spring.com` and product listing URLs. | EarthStar Art Store. | Art Store/EarthStar pages. | Active public shop destination. |

## 4. Privacy/Data Deletion Status

`/privacy/` exists and explicitly mentions EarthStar Command. It explains Meta Graph API access as read-only for Facebook Pages and Instagram professional accounts, describes analytics/insight data, says the use is for content analytics/performance review/private reporting, and says EarthStar Command does not sell Meta data, share it with advertisers, publish, schedule, upload, comment, message, DM, or write back to Meta.

`/data-deletion/` exists and explains how to request deletion by emailing `matt@vibrationofawesome.com` with an EarthStar Command Data Deletion Request. It also tells users they can remove app access from Facebook, Instagram, or Meta settings, and repeats that the app does not sell user data or write to Meta.

Verdict: Meta-review ready for the submitted read-only analytics story. The only tension is outside the legal pages: `/ai-engine/`, README, CLAUDE.md, shared config, scripts, and dashboard data describe publishing/syndication for VOA blog content. Those are not framed as Meta App Review pages, but the public `/ai-engine/` copy is visible and should be considered if reviewers browse beyond the legal URLs.

## 5. Meta App Review Compatibility

Compatible:

- Legal pages say EarthStar Command is private/local and read-only for Meta.
- Legal pages deny Meta publishing, scheduling, uploading, commenting, messaging, DM, and write actions.
- No public page appears to offer client account management, ads management, DM automation, comment automation, or selling analytics data.
- Data deletion is visible and linked from shared legal footers.

Potentially confusing:

- `static/ai-engine/index.html` says VOA has "a living content ecosystem that publishes, syndicates, and evolves across fifteen platforms" and names Publer as "the scheduling and publishing layer that moves content across Instagram, Pinterest, and Threads." Suggested safe wording if needed: "a creator content workflow for VOA-owned channels, separate from EarthStar Command's read-only Meta analytics app."
- `static/blog/matt/posts/twenty-years-internet-marketing.html` says EarthStar Command Center "automates my video syndication pipeline." Suggested safe wording if needed: "helps me organize my own video/content workflow."
- `README.md`, `CLAUDE.md`, `shared-config/syndication-policy-v1.md`, scripts, config, and `static/dashboard/` describe active social syndication. These are repo/internal or operational surfaces, not the public legal story. Keep them private from review unless specifically needed.

## 6. Current CTAs, Forms, And Content Flows

- Field Guide: free PDF/email capture, thank-you/download flow, `static/downloads/voa-field-guide.pdf`.
- AI Engine: multiple email capture forms to `/api/capture-email`, PDF download fallback to `static/downloads/voa-ai.pdf`, and visible tool stack links.
- AURA: free chat UI calls `/api/chat`; premium upgrade calls Stripe checkout through `/api/create-checkout` and verifies via `/api/verify-subscription`.
- User Manual: waitlist/email capture points at `https://vibrationofawesome-mailer.vercel.app/api/capture-email`.
- Contact: Netlify-style contact form posts to `/`; direct `mailto:matt@vibrationofawesome.com`.
- Art Store: product CTA buttons open external Spring/CreatorSpring product pages; no local checkout for merch.
- Blog: Matt and Boom post indexes are static JSON-backed content destinations. Internal scripts can generate, drip publish, and syndicate posts.
- Dashboard/Admin: operational routes expose syndication status and editor/admin controls; these could later feed EarthStar Command but are separate from the Meta read-only analytics story.

Later EarthStar Command candidates:

- Email capture events and source-page/CTA placement.
- Blog post inventory, publish dates, and content clusters.
- Syndication status/results for owned VOA channels.
- Shop CTA clicks/products, if tracked later.
- AURA usage/checkout status, if privacy-scoped later.

Unrelated to social orchestration:

- Legal pages.
- Static philosophy pages.
- Legacy archive content except where it contains embeds or CTAs.
- Spring checkout itself.

## 7. Gaps Between Public VOA Site And EarthStar Command Assumptions

- Public site does not clearly expose social follow links for VOA Instagram, Threads, Facebook, YouTube, Pinterest, TikTok, Bluesky, Mastodon, or Tumblr.
- Internal assumptions treat VOA Instagram, Threads, Pinterest, Facebook, Bluesky, Mastodon, Tumblr, Dev.to, Blogger, WordPress, and Feeder as routing/syndication destinations.
- Public legal pages describe EarthStar Command as read-only Meta analytics, while internal VOA tooling is a publishing/syndication engine for owned content. The distinction is valid but should stay explicit.
- EarthStar Rising appears as a separate WordPress/Dev.to/legacy social/content destination. It should be treated separately from VOA, especially when routing content, reporting metrics, or explaining Meta review scope.
- The public site does not currently prove that VOA Instagram/Threads/Pinterest are active destinations to ordinary visitors. That proof exists in internal docs/data and operational dashboard state, not in nav/footer/body social follow blocks.
- `/dashboard/` and `/admin/` are public routes in the static tree. If they are meant to be private/operational, consider access strategy later.

Important question answer: the public VOA site itself mostly presents Instagram/Threads/Pinterest/etc. as absent or tool references, not as public follow destinations. Internal repo truth says VOA Instagram, Threads, Pinterest, Facebook, Bluesky, Mastodon, Tumblr, and other outputs are active publishing/syndication destinations for owned VOA content. Treat them as active internally, but not as publicly advertised brand links right now.

## 8. Recommended Next Actions

1. Keep `/privacy/` and `/data-deletion/` unchanged unless Meta asks for more specificity.
2. Consider softening `/ai-engine/` public copy to distinguish the VOA-owned publishing workflow from EarthStar Command's read-only Meta analytics app.
3. Decide whether public social follow links should exist. If yes, add one canonical social block with verified VOA destinations only.
4. Keep VOA and EarthStar Rising as separate content destinations in EarthStar Command assumptions, reporting, and routing.
5. Review whether `/dashboard/` and `/admin/` should remain public-facing.
6. If EarthStar Command later ingests public-site CTAs, start with email capture, blog inventory, AURA checkout/chat status, and shop click metadata, not social APIs.

