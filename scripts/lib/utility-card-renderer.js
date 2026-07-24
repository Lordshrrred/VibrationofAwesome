/**
 * utility-card-renderer.js ~ Deterministic text-rendered social utility cards
 *
 * Renders VOA's list/resource/curiosity/mini-guide/comparison Instagram
 * archetypes as a 1080x1080 PNG using sharp + hand-built SVG. No image model
 * is asked to spell any word ~ every character on the card is the exact
 * string this module was given, laid out and rasterized deterministically.
 * This is the enforcement mechanism for the repo's visual-text-verification
 * rule (see docs/social-content-product.md): generated imagery containing
 * AI-spelled text cannot safely publish, so text-heavy formats never ask an
 * image model to render text at all.
 *
 * Background is a programmatic gradient in VOA's teal-on-dark palette, not
 * an AI image call ~ keeps utility cards near-zero cost and removes any
 * chance of a background model silently baking in its own stray text.
 *
 * Used by: scripts/generate-instagram-visual.js
 */

import sharp from "sharp";

const SIZE = 1080;
const FONT_STACK = "DejaVu Sans, Arial, Helvetica, sans-serif";
const TEAL  = "#00e5cc";
const WHITE = "#f5faf9";
const MUTED = "#7fa39d";

function escapeXml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Greedy word-wrap for SVG (no native text wrapping). Returns an array of
 * lines, each within maxChars ~ approximate, tuned per font-size/weight at
 * call sites rather than measured (no headless font metrics available here).
 */
function wrapText(text, maxChars) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Wrap text to at most maxLines, truncating with an ellipsis if it would
 * otherwise overflow ~ never silently drops trailing words mid-sentence
 * (caught in local rendering verification: a naive lines.slice(0, N) cut
 * "Not 5am meditation if you're a night" and "Showing up is" mid-thought
 * with no indication anything was cut).
 */
function wrapTextLimited(text, maxChars, maxLines) {
  const full = wrapText(text, maxChars);
  if (full.length <= maxLines) return full;

  // Shrink the truncation point until re-wrapping the truncated text + ellipsis
  // itself fits within maxLines ~ appending "…" can push a borderline cut back
  // over the line limit, which a single fixed-budget slice does not account
  // for (caught in local rendering verification: the ellipsis itself was
  // silently dropped when that happened).
  let budget = maxChars * maxLines - 1;
  while (budget > 0) {
    const truncated = String(text ?? "").slice(0, budget).replace(/\s+\S*$/, "") + "…";
    const rewrapped = wrapText(truncated, maxChars);
    if (rewrapped.length <= maxLines) return rewrapped;
    budget -= 8;
  }
  return wrapText("…", maxChars);
}

function tspanLines(lines, x, startY, lineHeight) {
  return lines
    .map((line, i) => `<tspan x="${x}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
}

function backgroundLayer() {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stop-color="#031212"/>
        <stop offset="55%" stop-color="#020a0a"/>
        <stop offset="100%" stop-color="#010606"/>
      </linearGradient>
      <linearGradient id="accentFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="${TEAL}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="${TEAL}" stop-opacity="0.15"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
    <rect x="0" y="0" width="10" height="${SIZE}" fill="url(#accentFade)"/>
  `;
}

function renderHeader({ eyebrow, headline }) {
  const parts = [];
  let y = 150;
  if (eyebrow) {
    parts.push(`<text x="80" y="${y}" font-family="${FONT_STACK}" font-size="34" font-weight="700" letter-spacing="2" fill="${TEAL}">${escapeXml(eyebrow.toUpperCase())}</text>`);
    y += 64;
  } else {
    y += 10;
  }
  const headlineLines = wrapText(headline, 22);
  parts.push(`<text x="80" y="${y}" font-family="${FONT_STACK}" font-size="62" font-weight="800" fill="${WHITE}">${tspanLines(headlineLines, 80, y, 74)}</text>`);
  const headlineBottom = y + (headlineLines.length - 1) * 74;
  return { svg: parts.join("\n"), bottomY: headlineBottom };
}

/** format: "list_resource" ~ numbered items, each a short label + one-line detail */
function renderListResource(concept) {
  const { svg: headerSvg, bottomY } = renderHeader(concept);
  const allItems = concept.items || [];
  const numberX = 80;
  const textX   = 150;
  const labelMaxChars  = 34; // narrower than detail: bold/larger font
  const detailMaxChars = 46;
  const footerReserve  = concept.footer ? 90 : 40;

  // Variable per-item height (label can wrap too) ~ a fixed row height caused
  // real overlap with any 2-line detail, caught in local rendering verification
  // before this ever reached a real post. Truncate rather than overlap if the
  // concept has more items than the card can fit.
  const startY = bottomY + 110;
  const maxY = SIZE - footerReserve;
  const rows = [];
  let y = startY;

  for (const item of allItems) {
    const labelLines  = wrapText(item.label || "", labelMaxChars);
    const detailLines = item.detail ? wrapTextLimited(item.detail, detailMaxChars, 2) : [];
    const labelHeight  = labelLines.length * 46;
    const detailHeight = detailLines.length * 34;
    const itemHeight = labelHeight + detailHeight + 26; // + gap before next item

    if (y + itemHeight - 26 > maxY && rows.length > 0) break; // stop before overflow, keep at least one item

    rows.push(`
      <text x="${numberX}" y="${y}" font-family="${FONT_STACK}" font-size="40" font-weight="800" fill="${TEAL}">${rows.length + 1}.</text>
      <text x="${textX}" y="${y}" font-family="${FONT_STACK}" font-size="38" font-weight="700" fill="${WHITE}">${tspanLines(labelLines, textX, y, 46)}</text>
      ${detailLines.length ? `<text x="${textX}" y="${y + labelHeight}" font-family="${FONT_STACK}" font-size="27" font-weight="400" fill="${MUTED}">${tspanLines(detailLines, textX, y + labelHeight, 34)}</text>` : ""}
    `);

    y += itemHeight;
  }

  return `${backgroundLayer()}${headerSvg}${rows.join("\n")}${renderFooter(concept)}`;
}

/** format: "curiosity_hook" ~ one bold hook line, minimal, high negative space */
function renderCuriosityHook(concept) {
  const { svg: headerSvg, bottomY } = renderHeader(concept);
  const hookLines = concept.hookLine ? wrapText(concept.hookLine, 34) : [];
  const y = bottomY + 160;
  const hook = hookLines.length
    ? `<text x="80" y="${y}" font-family="${FONT_STACK}" font-size="44" font-weight="500" fill="${MUTED}">${tspanLines(hookLines, 80, y, 58)}</text>`
    : "";
  return `${backgroundLayer()}${headerSvg}${hook}${renderFooter(concept)}`;
}

/** format: "mini_guide" ~ short numbered steps, framework-style */
function renderMiniGuide(concept) {
  return renderListResource(concept); // same visual grammar, step-labeled items
}

/** format: "comparison" ~ two-column myth/reality or before/after */
function renderComparison(concept) {
  const { svg: headerSvg, bottomY } = renderHeader(concept);
  const allItems = concept.items || [];
  const colLeftX = 80;
  const colRightX = 560;
  const colMaxChars = 24;
  const footerReserve = concept.footer ? 90 : 40;
  const startY = bottomY + 90;
  const maxY = SIZE - footerReserve;

  const rows = [];
  let y = startY;

  for (const item of allItems) {
    const leftLines  = wrapTextLimited(item.label  || "", colMaxChars, 3);
    const rightLines = wrapTextLimited(item.detail || "", colMaxChars, 3);
    const rowHeight = Math.max(leftLines.length, rightLines.length) * 38 + 34;

    if (y + rowHeight - 34 > maxY && rows.length > 0) break;

    rows.push(`
      <text x="${colLeftX}"  y="${y}" font-family="${FONT_STACK}" font-size="32" font-weight="700" fill="${MUTED}">${tspanLines(leftLines, colLeftX, y, 38)}</text>
      <text x="${colRightX}" y="${y}" font-family="${FONT_STACK}" font-size="32" font-weight="700" fill="${WHITE}">${tspanLines(rightLines, colRightX, y, 38)}</text>
      <line x1="${colRightX - 30}" y1="${y - 34}" x2="${colRightX - 30}" y2="${y + rowHeight - 34}" stroke="${TEAL}" stroke-opacity="0.25" stroke-width="1"/>
    `);
    y += rowHeight;
  }

  return `${backgroundLayer()}${headerSvg}${rows.join("\n")}${renderFooter(concept)}`;
}

function renderFooter(concept) {
  if (!concept.footer) return "";
  return `<text x="80" y="${SIZE - 70}" font-family="${FONT_STACK}" font-size="26" font-weight="400" fill="${MUTED}">${escapeXml(concept.footer)}</text>`;
}

const RENDERERS = {
  list_resource:  renderListResource,
  curiosity_hook: renderCuriosityHook,
  mini_guide:     renderMiniGuide,
  comparison:     renderComparison,
};

/**
 * Render a utility-card concept to a 1080x1080 PNG buffer.
 *
 * @param {object} concept - { format, eyebrow?, headline, hookLine?, items?, footer? }
 * @returns {Promise<Buffer>}
 */
export async function renderUtilityCardPNG(concept) {
  const build = RENDERERS[concept.format];
  if (!build) throw new Error(`utility-card-renderer: unknown format "${concept.format}"`);

  const inner = build(concept);
  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const UTILITY_CARD_FORMATS = Object.keys(RENDERERS);
