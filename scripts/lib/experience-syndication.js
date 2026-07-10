/**
 * experience-syndication.js
 *
 * Deterministic syndication content generators for VOA interactive
 * experiences (tools/rituals/assessments in static/_data/authority-assets.json).
 *
 * IMPORTANT: this module does not call any API, does not publish anything,
 * and is not wired into scripts/syndicate.js's live pipeline. It exists so
 * that when an experience is ready to syndicate, the same deterministic,
 * template-based approach used for blog posts (see PLATFORM ROUTING /
 * ANTI-DUPLICATION rules in CLAUDE.md) is already available for tools
 * without inventing anything new per-experience. Every output function is a
 * pure function of the asset's own data ~ same input always produces the
 * same output, and every output links back to the canonical VOA experience.
 *
 * Usage (future, manual):
 *   import { buildExperienceSyndicationSet } from "./lib/experience-syndication.js";
 *   const set = buildExperienceSyndicationSet(assetFromAuthorityAssetsJson);
 *   // set.wordpress, set.blogger, set.medium, set.tumblr, set.redditSafe,
 *   // set.pinterest, set.quora, set.backlinkLanding, set.socialSnippet
 */

const BASE = "https://vibrationofawesome.com";

function canonicalUrl(asset) {
  const path = asset.canonical || "/";
  return path.startsWith("http") ? path : `${BASE}${path}`;
}

function experienceOf(asset) {
  return asset.experience || {};
}

/** WordPress/Blogger/Medium share the same "companion article" shape:
 * a short, original framing piece that teases the experience and links back.
 * Each platform gets distinct wording (never copy-paste identical text
 * across platforms, matching the anti-duplication rule already applied to
 * blog post syndication) but all draw from the same deterministic fields. */
function buildLongFormCompanion(asset, platform) {
  const exp = experienceOf(asset);
  const purpose = exp.primaryPurpose || asset.description;
  const outcome = exp.practicalOutcome ? ` You walk away with ${lowerFirst(exp.practicalOutcome)}` : "";
  const time = exp.estimatedMinutes ? ` It takes about ${formatMinutes(exp.estimatedMinutes)}.` : "";

  const openers = {
    wordpress: `There's a small, free tool worth knowing about if this is something you deal with.`,
    blogger: `Here's a short, practical resource for anyone working through this.`,
    medium: `A quick note on a tool I came across that's worth trying.`,
  };

  return [
    openers[platform] || openers.wordpress,
    "",
    purpose,
    `${outcome}${time}`.trim(),
    "",
    `It's called ${asset.title}, and it's free, no account required: ${canonicalUrl(asset)}`,
  ].filter(Boolean).join("\n");
}

/** Tumblr: short, aesthetic, caption-length ~ text post, not an article. */
function buildTumblrCaption(asset) {
  const exp = experienceOf(asset);
  const feeling = exp.emotionalOutcome ? exp.emotionalOutcome.replace(/\.$/, "") : asset.description;
  return `${asset.title} ~ ${feeling.charAt(0).toLowerCase()}${feeling.slice(1)}. ${canonicalUrl(asset)}`;
}

/** Reddit-safe: neutral, non-promotional tone. Reddit penalizes naked
 * self-promotion, so this frames the link as a resource mention, not an ad,
 * and is transparent that it's from VOA rather than pretending otherwise. */
function buildRedditSafeMention(asset) {
  const exp = experienceOf(asset);
  const purpose = exp.primaryPurpose || asset.description;
  return [
    `Found this useful and figured I'd share: ${purpose}`,
    "",
    `It's a free tool from Vibration of Awesome (no account, no signup): ${canonicalUrl(asset)}`,
    "",
    "Not affiliated in any promotional sense beyond finding it genuinely useful ~ sharing because it might help someone else here too.",
  ].join("\n");
}

/** Pinterest: keyword-rich, benefit-forward, board-ready description. */
function buildPinterestDescription(asset) {
  const exp = experienceOf(asset);
  const outcome = exp.emotionalOutcome || exp.practicalOutcome || asset.description;
  return `${asset.title}: ${outcome} Free interactive tool, no signup. ${canonicalUrl(asset)}`;
}

/** Quora: outline format answering an implicit "how do I..." question,
 * ending with the tool as one option among the practical suggestions
 * (not the whole answer, which reads as more genuine and less promotional). */
function buildQuoraOutline(asset) {
  const exp = experienceOf(asset);
  const lines = [
    `A few things that actually help here:`,
    `- Name what you're feeling specifically, not just "bad" or "off"`,
    `- Give yourself a real, short amount of time rather than an open-ended one`,
    `- Have one small, concrete next action ready before you start`,
  ];
  if (exp.primaryPurpose) {
    lines.push(`- If you want something structured for this: ${asset.title} (${canonicalUrl(asset)}) ~ ${lowerFirst(exp.primaryPurpose)}`);
  }
  return lines.join("\n");
}

/** Backlink landing page content: minimal, honest, static page-content
 * shape (title + description + canonical link) suitable for a companion
 * page on a platform that supports a real landing page, not just a post. */
function buildBacklinkLandingContent(asset) {
  const exp = experienceOf(asset);
  return {
    title: asset.title,
    description: asset.description,
    body: [
      exp.primaryPurpose || asset.description,
      exp.practicalOutcome ? `What you get: ${lowerFirst(exp.practicalOutcome)}` : null,
      exp.estimatedMinutes ? `Time: about ${formatMinutes(exp.estimatedMinutes)}.` : null,
      `Try it free: ${canonicalUrl(asset)}`,
    ].filter(Boolean).join("\n\n"),
    canonical: canonicalUrl(asset),
  };
}

/** Single-line social snippet (Bluesky/Mastodon/Threads-style platforms). */
function buildSocialSnippet(asset) {
  const exp = experienceOf(asset);
  const hook = exp.emotionalOutcome || exp.primaryPurpose || asset.description;
  return `${hook.replace(/\.$/, "")}. ${asset.title}, free: ${canonicalUrl(asset)}`;
}

function lowerFirst(text) {
  const t = String(text || "");
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** Numeric estimatedMinutes ("2") reads fine as "2 minutes"; a descriptive
 * string ("5 to 95 (ritual setup...)") already reads fine on its own and
 * should not get a redundant trailing "minutes" appended. */
function formatMinutes(value) {
  const isPureNumber = /^\d+(\.\d+)?$/.test(String(value).trim());
  return isPureNumber ? `${value} minutes` : String(value);
}

/** Builds the full deterministic syndication set for one experience asset. */
export function buildExperienceSyndicationSet(asset) {
  return {
    wordpress: buildLongFormCompanion(asset, "wordpress"),
    blogger: buildLongFormCompanion(asset, "blogger"),
    medium: buildLongFormCompanion(asset, "medium"),
    tumblr: buildTumblrCaption(asset),
    redditSafe: buildRedditSafeMention(asset),
    pinterest: buildPinterestDescription(asset),
    quora: buildQuoraOutline(asset),
    backlinkLanding: buildBacklinkLandingContent(asset),
    socialSnippet: buildSocialSnippet(asset),
  };
}
