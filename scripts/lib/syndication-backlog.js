import fs from "fs";

export const BACKLINK_CAPABLE_PLATFORMS = [
  "devto",
  "devto2",
  "tumblr_voa",
  "blogger",
  "wordpress_earthstar",
];

export const FEEDER_PLATFORMS = ["feeder"];

export const DISTRIBUTION_PLATFORMS = [
  "bluesky_voa",
  "mastodon_voa",
  "facebook_voa",
  "pinterest",
  "threads",
  "instagram",
];

export const PLATFORM_LABELS = {
  blogger: "Blogger",
  wordpress_earthstar: "WordPress",
  tumblr_voa: "Tumblr",
  devto: "Dev.to",
  devto2: "Dev.to 2",
  pinterest: "Pinterest",
  feeder: "VOA Feeder",
  bluesky_voa: "Bluesky VOA",
  mastodon_voa: "Mastodon VOA",
  facebook_voa: "Facebook VOA",
  threads: "Threads",
  instagram: "Instagram",
};

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_POSTS_PER_DAY = 5;

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function envNumber(key, fallback) {
  const value = Number(process.env[key] || fallback);
  return Number.isFinite(value) ? value : fallback;
}

export function isArtOrCampaign(row) {
  const syn = row.syndication || {};
  return Boolean(syn.devto2 || row.niche === "art-buyer-intent" || row.syndication_profile === "campaign-seo");
}

export function expectedBacklinkPlatforms(row) {
  return [
    isArtOrCampaign(row) ? "devto2" : "devto",
    "tumblr_voa",
    "blogger",
    "wordpress_earthstar",
  ];
}

export function expectedFeederPlatforms(row) {
  return isArtOrCampaign(row) ? [] : ["feeder"];
}

export function platformStatus(row, key) {
  return (row.syndication || {})[key] || null;
}

export function isPlatformComplete(row, key) {
  return platformStatus(row, key)?.status === "success";
}

export function missingBacklinkPlatforms(row) {
  return expectedBacklinkPlatforms(row).filter(key => !isPlatformComplete(row, key));
}

export function latestPlatformTimestamp(row, keys = null) {
  const wanted = keys ? new Set(keys) : null;
  const times = Object.entries(row.syndication || {})
    .filter(([key]) => !wanted || wanted.has(key))
    .map(([, value]) => Date.parse(value?.timestamp || ""))
    .filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

function topBlockers(results, keys) {
  const counts = new Map();
  for (const row of results) {
    for (const key of keys) {
      const item = platformStatus(row, key);
      if (!item || item.status === "success" || item.status === "skipped") continue;
      const reason = item.error || "missing local success record";
      const label = `${key}: ${reason}`;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([reason, count]) => ({ reason, count }));
}

function platformTable(results, key, expectedPredicate, windowCutoff, windowDays) {
  let eligible = 0;
  let complete = 0;
  let missing = 0;
  let confirmed = 0;
  let verificationGaps = 0;
  let completedInWindow = 0;
  const blockers = new Map();

  for (const row of results) {
    if (!expectedPredicate(row, key)) continue;
    eligible++;
    const item = platformStatus(row, key);
    if (item?.status === "success") {
      complete++;
      if (item.backlink_confirmed === true) confirmed++;
      else verificationGaps++;
      const ts = Date.parse(item.timestamp || "");
      if (Number.isFinite(ts) && ts >= windowCutoff) completedInWindow++;
      continue;
    }
    missing++;
    const reason = item?.error || (item?.status ? `${item.status}` : "missing local success record");
    blockers.set(reason, (blockers.get(reason) || 0) + 1);
  }

  const mainBlocker = [...blockers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return {
    key,
    platform: PLATFORM_LABELS[key] || key,
    eligiblePosts: eligible,
    complete,
    missing,
    successRate: eligible ? Math.round((complete / eligible) * 1000) / 10 : 100,
    averagePerDay: Math.round((completedInWindow / Math.max(windowDays, 1)) * 10) / 10,
    confirmed,
    verificationGaps,
    mainBlocker,
  };
}

export function buildSyndicationBacklogStatus(results, opts = {}) {
  const safeResults = Array.isArray(results) ? results : [];
  const now = opts.now ? new Date(opts.now) : new Date();
  const windowDays = Number(opts.windowDays || envNumber("BACKLINK_THROUGHPUT_WINDOW_DAYS", DEFAULT_WINDOW_DAYS));
  const postsPerDay = Number(opts.postsPerDay || envNumber("SEO_PUBLISHING_POSTS_PER_DAY", DEFAULT_POSTS_PER_DAY));
  const catchupUnitThreshold = Number(opts.catchupUnitThreshold || envNumber("BACKLINK_CATCHUP_UNIT_THRESHOLD", 25));
  const catchupDaysThreshold = Number(opts.catchupDaysThreshold || envNumber("BACKLINK_CATCHUP_DAYS_THRESHOLD", 7));
  const maintenanceThreshold = Number(opts.maintenanceThreshold || envNumber("BACKLINK_MAINTENANCE_UNIT_THRESHOLD", 4));
  const windowCutoff = now.getTime() - windowDays * 86400000;
  const freshCutoff = now.getTime() - 24 * 60 * 60 * 1000;

  let backlogPosts = 0;
  let backlogUnits = 0;
  let completedUnits = 0;
  let verificationGaps = 0;
  let freshPostsAwaiting = 0;
  let freshMissingUnits = 0;
  let feederMissingUnits = 0;
  let distributionIncompleteUnits = 0;
  const backlogRows = [];

  for (const row of safeResults) {
    const missing = missingBacklinkPlatforms(row);
    if (missing.length) {
      backlogPosts++;
      backlogUnits += missing.length;
      backlogRows.push({ row, missing });
      const latest = latestPlatformTimestamp(row, [...expectedBacklinkPlatforms(row), ...DISTRIBUTION_PLATFORMS, ...FEEDER_PLATFORMS]);
      if (latest && latest >= freshCutoff) {
        freshPostsAwaiting++;
        freshMissingUnits += missing.length;
      }
    }

    for (const key of expectedBacklinkPlatforms(row)) {
      const item = platformStatus(row, key);
      if (item?.status === "success") {
        if (item.backlink_confirmed !== true) verificationGaps++;
        const ts = Date.parse(item.timestamp || "");
        if (Number.isFinite(ts) && ts >= windowCutoff) completedUnits++;
      }
    }

    for (const key of expectedFeederPlatforms(row)) {
      if (!isPlatformComplete(row, key)) feederMissingUnits++;
    }

    for (const key of DISTRIBUTION_PLATFORMS) {
      const item = platformStatus(row, key);
      if (!item || item.skipped || item.status === "skipped") continue;
      if (item.status !== "success") distributionIncompleteUnits++;
    }
  }

  const completedPerDay = Math.round((completedUnits / Math.max(windowDays, 1)) * 10) / 10;
  const averageRequiredBacklinkUnits = safeResults.length
    ? safeResults.reduce((sum, row) => sum + expectedBacklinkPlatforms(row).length, 0) / safeResults.length
    : 4;
  const newUnitsPerDay = Math.round(postsPerDay * averageRequiredBacklinkUnits * 10) / 10;
  const netBacklogChangePerDay = Math.round((newUnitsPerDay - completedPerDay) * 10) / 10;
  const catchupRatePerDay = Math.round((completedPerDay - newUnitsPerDay) * 10) / 10;
  const estimatedCatchUpDays = backlogUnits === 0
    ? 0
    : catchupRatePerDay > 0
      ? Math.round((backlogUnits / catchupRatePerDay) * 10) / 10
      : null;

  const mode = backlogUnits <= maintenanceThreshold
    ? "maintenance"
    : (backlogUnits > catchupUnitThreshold || estimatedCatchUpDays === null || estimatedCatchUpDays > catchupDaysThreshold || netBacklogChangePerDay > 0)
      ? "catch-up"
      : "maintenance";

  const platformBacklinks = ["blogger", "wordpress_earthstar", "tumblr_voa", "devto", "devto2"]
    .map(key => platformTable(safeResults, key, (row, platform) => expectedBacklinkPlatforms(row).includes(platform), windowCutoff, windowDays));
  const platformFeeder = platformTable(safeResults, "feeder", (row, platform) => expectedFeederPlatforms(row).includes(platform), windowCutoff, windowDays);
  const platformDistribution = DISTRIBUTION_PLATFORMS
    .map(key => platformTable(safeResults, key, (row, platform) => Boolean(platformStatus(row, platform)) && platformStatus(row, platform)?.status !== "skipped", windowCutoff, windowDays));

  const largestDelay = [...platformBacklinks, platformFeeder, ...platformDistribution]
    .filter(row => row.missing > 0)
    .sort((a, b) => b.missing - a.missing)[0] || null;

  return {
    generatedAt: now.toISOString(),
    definitions: {
      backlogPosts: "Published VOA posts missing at least one expected backlink-capable platform success.",
      platformLinkUnits: "One expected backlink-capable platform task for one post: Dev.to/Dev.to2, Tumblr, Blogger, or WordPress.",
      completedPerDay: `Successful backlink-capable platform tasks completed in the last ${windowDays} days divided by ${windowDays}.`,
      excludedFromBacklinkBacklog: "Feeder canonical/source pages, Pinterest/social distribution, Instagram non-clickable captions, skipped policy destinations, and verification-only gaps.",
    },
    mode,
    thresholds: {
      catchupUnitThreshold,
      catchupDaysThreshold,
      maintenanceThreshold,
      windowDays,
    },
    summary: {
      totalTrackedPosts: safeResults.length,
      backlogPosts,
      backlinkCapableMissingUnits: backlogUnits,
      backlinkVerificationGaps: verificationGaps,
      feederMissingUnits,
      distributionIncompleteUnits,
      freshPostsAwaitingBacklinks: freshPostsAwaiting,
      freshMissingBacklinkUnits: freshMissingUnits,
      completedBacklinkUnitsInWindow: completedUnits,
      completedBacklinkUnitsPerDay: completedPerDay,
      newPostsPerDay: postsPerDay,
      newBacklinkUnitsPerDay: newUnitsPerDay,
      netBacklogChangePerDay,
      estimatedCatchUpDays,
      largestDelayPlatform: largestDelay?.platform || null,
      largestDelayMissingUnits: largestDelay?.missing || 0,
    },
    platformTable: {
      backlinkCapable: platformBacklinks,
      feeder: [platformFeeder],
      distribution: platformDistribution,
    },
    blockers: topBlockers(safeResults, [...BACKLINK_CAPABLE_PLATFORMS, ...DISTRIBUTION_PLATFORMS]),
    prioritizedBacklog: backlogRows
      .sort((a, b) => {
        const aLatest = latestPlatformTimestamp(a.row) || 0;
        const bLatest = latestPlatformTimestamp(b.row) || 0;
        const aFresh = aLatest >= freshCutoff ? 0 : 1;
        const bFresh = bLatest >= freshCutoff ? 0 : 1;
        if (aFresh !== bFresh) return aFresh - bFresh;
        const aPartial = a.missing.length <= 2 ? 0 : 1;
        const bPartial = b.missing.length <= 2 ? 0 : 1;
        if (aPartial !== bPartial) return aPartial - bPartial;
        return String(a.row.date || "").localeCompare(String(b.row.date || ""));
      })
      .map(({ row, missing }) => ({
        slug: row.slug,
        lane: row.lane || "boom",
        title: row.title || row.slug,
        date: row.date || null,
        missing,
      })),
  };
}
