/**
 * faq-eligibility.js
 *
 * Deterministic FAQ qualification policy for Boom Frequency generation.
 * No API/LLM call is used to decide eligibility ~ it's evaluated from the
 * post's own title, keyword, and cluster before generation even starts, so
 * the same generation call can be told (or not told) to write an FAQ section,
 * with zero extra requests.
 *
 * Posts that usually qualify: tutorials, how-to guides, reviews,
 * comparisons, practical decision guides, troubleshooting posts, reference
 * articles, posts answering recurring factual questions.
 *
 * Posts that usually do not: personal reflections, stories, rants,
 * spiritual essays, manifestos, emotional writing, poetic writing, short
 * opinion pieces ~ anywhere an FAQ would feel bolted on.
 */

const FAQ_QUALIFYING_PATTERNS = [
  /how (to|do i|does)/i, /step[- ]by[- ]step/i, /guide (to|for)/i, /tutorial/i,
  /\bvs\.?\b|\bversus\b/i, /\breview\b/i, /alternatives?/i, /checklist/i,
  /template/i, /\btools?\b/i, /best .+ for/i, /what is/i, /what are/i,
  /troubleshoot/i, /\bfix(ing)?\b/i, /\bsetup\b/i, /cost|pricing|price/i,
  /worth it/i, /comparison/i, /which .+ should/i, /is .+ (legit|real|worth)/i,
];

const FAQ_DISQUALIFYING_PATTERNS = [
  /^why i /i, /the truth about/i, /nobody tells you/i, /a letter to/i,
  /confession/i, /my journey/i, /manifesto/i, /^on being/i, /^what it means/i,
];

// Clusters whose content is usually reflective/emotional writing, where an
// FAQ section would feel bolted on even if no disqualifying title phrase
// matched. A strong practical-title match above still overrides this.
const REFLECTIVE_CLUSTERS = new Set([
  "nervous-system-creativity", "emotional-regulation", "dopamine-attention",
  "authentic-self-expression", "spiritual-productivity", "purpose-direction",
  "building-life-that-fits",
]);

// Clusters that are usually practical/tool-oriented even without a
// practical-sounding title (e.g. a post titled just around a tool name).
const PRACTICAL_CLUSTERS = new Set([
  "ai-creator-tools", "creator-automation", "art-buying-online", "consciousness-technology",
]);

/**
 * @param {{ title?: string, keyword?: string, cluster?: string|null }} post
 * @returns {{ eligible: boolean, format: string, reason: string }}
 */
export function assessFaqEligibility({ title = "", keyword = "", cluster = null } = {}) {
  const text = `${title} ${keyword}`.trim();
  if (!text) {
    return { eligible: false, format: "unknown", reason: "no title or keyword to evaluate" };
  }

  if (FAQ_DISQUALIFYING_PATTERNS.some((p) => p.test(text))) {
    return { eligible: false, format: "reflective", reason: "title reads as personal reflection or essay, not a practical guide" };
  }

  if (FAQ_QUALIFYING_PATTERNS.some((p) => p.test(text))) {
    return { eligible: true, format: "practical", reason: "title matches a how-to, review, comparison, or reference format" };
  }

  if (cluster && REFLECTIVE_CLUSTERS.has(cluster)) {
    return { eligible: false, format: "reflective", reason: `cluster "${cluster}" is typically reflective/emotional and the title has no practical-question shape` };
  }

  if (cluster && PRACTICAL_CLUSTERS.has(cluster)) {
    return { eligible: true, format: "practical", reason: `cluster "${cluster}" is typically practical/tool-oriented` };
  }

  return { eligible: false, format: "general", reason: "no clear practical-question signal in title, keyword, or cluster" };
}

/**
 * Applies a manual override on top of the automatic assessment.
 * @param {"on"|"off"|undefined} override
 */
export function resolveFaqEligibility(post, override) {
  const auto = assessFaqEligibility(post);
  if (override === "on") return { eligible: true, format: auto.format, reason: "manual override: forced on (--faq=on)" };
  if (override === "off") return { eligible: false, format: auto.format, reason: "manual override: forced off (--faq=off)" };
  return auto;
}
