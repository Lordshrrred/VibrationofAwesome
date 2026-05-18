import crypto from "crypto";

const SOFT_CTA_POOLS = {
  bluesky: [
    "Sit with this one.",
    "If this lands, let it change how you move today.",
  ],
  mastodon: [
    "Sit with this one.",
    "The full piece is there if you want to go deeper.",
    "You are probably carrying more than you realize.",
  ],
  facebook: [
    "If this lands, let it change how you move today.",
    "The deeper breakdown is there if you want to stay with it.",
  ],
  pinterest: [
    "Save this for the version of you that forgets.",
    "Come back to this the next time you need the deeper thread.",
  ],
  threads: [
    "Sit with this one.",
    "If this lands, let it change how you move today.",
  ],
};

const PLATFORM_PROBABILITY = {
  bluesky: 0.45,
  mastodon: 0.45,
  facebook: 0.35,
  pinterest: 0.4,
  threads: 0.25,
};

function deterministicRatio(seed) {
  const hex = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16) / 0xffffffff;
}

function pickDeterministic(items, seed) {
  const ratio = deterministicRatio(`${seed}:pick`);
  return items[Math.floor(ratio * items.length) % items.length];
}

function hasPromoLanguage(text) {
  return /\b(matt|matty|this article|this post|read more|follow for more|comment below)\b/i.test(text);
}

function appendBeforeUrl(text, cta) {
  const urlMatch = text.match(/https?:\/\/\S+(?![\s\S]*https?:\/\/\S+)/);
  if (!urlMatch) return `${text.trim()}\n\n${cta}`;
  const urlStart = urlMatch.index;
  const before = text.slice(0, urlStart).trimEnd();
  const after = text.slice(urlStart);
  return `${before}\n\n${cta}\n\n${after}`;
}

function appendSentence(text, cta) {
  return `${text.trim()}\n\n${cta}`;
}

export function applySoftCtas(captions, { slug = "", enabled = true } = {}) {
  if (!enabled) return captions;
  const next = { ...captions };

  for (const [platform, pool] of Object.entries(SOFT_CTA_POOLS)) {
    const value = next[platform];
    if (!value || hasPromoLanguage(value)) continue;
    const seed = `${slug || value}:${platform}`;
    if (deterministicRatio(seed) >= PLATFORM_PROBABILITY[platform]) continue;
    const cta = pickDeterministic(pool, seed);

    if (platform === "threads") {
      next[platform] = appendBeforeUrl(value, cta);
    } else if (platform === "bluesky") {
      const candidate = appendBeforeUrl(value, cta);
      if (candidate.length <= 300) next[platform] = candidate;
    } else {
      next[platform] = appendSentence(value, cta);
    }
  }

  return next;
}

