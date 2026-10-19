/**
 * pin-renderer.js ~ Pinterest pins that say what you get when you click.
 *
 * Pinterest audit (2026-10-19): pins that carried a readable promise on a
 * vertical design earned VOA's reach; since Ideogram died in September the
 * fallback pinned bare NASA photos, which reached almost no one and sent 8
 * site visits in 90 days. Every pin now gets the headline typeset from a real
 * font file (Anton, via sharp's Pango text input) over whatever background
 * exists, plus the domain, so the click target is never ambiguous.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_FILE = path.join(__dirname, "..", "assets", "fonts", "Anton-Regular.ttf");
const W = 1000;
const H = 1500;
const TEAL = "#00e5cc";

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Split a long blog title into a short headline and the promise that follows
 * it ("AI Advantage Bootcamp Cost" / "Here is exactly what $995 gets you").
 */
export function pinHeadline(title) {
  const t = String(title || "").replace(/\s+/g, " ").trim();
  const m = /^(.{8,}?)\s*(?::|\s[~\u2013\u2014]\s|\s\()\s*(.+?)\)?$/.exec(t);
  const clip = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);
  if (m && m[1].split(" ").length >= 2) return { headline: clip(m[1], 70), kicker: clip(m[2], 70) };
  // A plain title still needs a click cue.
  return { headline: clip(t, 100), kicker: "Read the full post" };
}

async function textLayer(text, { size, color, width, align = "centre" }) {
  return sharp({
    text: {
      text: `<span foreground="${color}">${esc(text)}</span>`,
      font: `Anton ${size}`,
      fontfile: FONT_FILE,
      width,
      align,
      rgba: true,
      spacing: Math.round(size * 0.08),
    },
  }).png().toBuffer({ resolveWithObject: true });
}

async function loadBackground(source) {
  if (!source) return null;
  try {
    if (Buffer.isBuffer(source)) return source;
    if (/^https?:/.test(source)) {
      const r = await fetch(source);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    }
    if (fs.existsSync(source)) return fs.readFileSync(source);
    // Site-relative paths (og:image, hero fields) live under static/ or on the live site.
    if (source.startsWith("/")) {
      const local = path.join(__dirname, "..", "..", "static", source);
      if (fs.existsSync(local)) return fs.readFileSync(local);
      const r = await fetch(`https://vibrationofawesome.com${source}`);
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    }
    return null;
  } catch {
    return null;
  }
}

// Teal glow on near-black: on-brand, carries no third-party marks (the blog's
// NASA-cache heroes include observatory copyrights and camera timestamps).
function brandBackground(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <radialGradient id="g" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#0f3b3a"/><stop offset="0.55" stop-color="#0a1c20"/><stop offset="1" stop-color="#05090b"/>
    </radialGradient>
    <radialGradient id="h" cx="80%" cy="92%" r="45%">
      <stop offset="0" stop-color="#00e5cc" stop-opacity="0.18"/><stop offset="1" stop-color="#00e5cc" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#h)"/>
</svg>`;
}

/**
 * @param {{ headline: string, background?: string|Buffer|null, kicker?: string, footer?: string, width?: number, height?: number }} opts
 * @returns {Promise<Buffer>} PNG
 */
export async function renderPin({ headline, background = null, kicker = "", footer = "VIBRATIONOFAWESOME.COM", width = W, height = H }) {
  if (!String(headline || "").trim()) throw new Error("renderPin: headline is required");
  const bgBuf = await loadBackground(background);
  const base = bgBuf
    ? sharp(bgBuf).resize(width, height, { fit: "cover", position: "attention" }).modulate({ brightness: 0.55, saturation: 0.85 })
    : sharp(Buffer.from(brandBackground(width, height)));

  // Fit the headline: largest size whose block stays within ~45% of the height.
  let head;
  for (let size = 120; size >= 56; size -= 6) {
    head = await textLayer(headline.toUpperCase(), { size, color: "#ffffff", width: width - 140 });
    if (head.info.height <= height * 0.45) break;
  }
  const headTop = Math.round(height * 0.5 - head.info.height / 2);
  const layers = [
    { input: { create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.25 } } }, top: 0, left: 0 },
    { input: { create: { width: 120, height: 8, channels: 4, background: TEAL } }, top: headTop - 50, left: Math.round((width - 120) / 2) },
    { input: head.data, top: headTop, left: Math.round((width - head.info.width) / 2) },
  ];
  if (kicker) {
    const k = await textLayer(kicker.toUpperCase(), { size: 52, color: TEAL, width: width - 200 });
    layers.push({ input: k.data, top: headTop + head.info.height + 56, left: Math.round((width - k.info.width) / 2) });
  }
  const foot = await textLayer(footer, { size: 38, color: TEAL, width: width - 100 });
  layers.push({ input: foot.data, top: height - 120, left: Math.round((width - foot.info.width) / 2) });

  return base.composite(layers).png().toBuffer();
}
