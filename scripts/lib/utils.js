/**
 * utils.js — Shared utility functions for VOA scripts
 *
 * Canonical implementations of functions that were previously duplicated
 * across generate-post.js, generate-all-drafts.js, and syndicate.js.
 */

/**
 * Convert any string into a URL-safe slug.
 * Lowercases, strips non-alphanumeric chars, trims, collapses spaces/hyphens.
 */
export function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Return the first `count` words of a string.
 * Handles null/undefined input gracefully; filters empty tokens.
 */
export function firstWords(text, count) {
  return String(text || "").split(/\s+/).filter(Boolean).slice(0, count).join(" ");
}
