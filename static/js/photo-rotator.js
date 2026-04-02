/**
 * photo-rotator.js ~ VOA Random Photo Widget
 *
 * Usage:
 *   <div class="voa-photo-rotator" data-folder="matt" data-tag="outdoors"></div>
 *   <script src="/js/photo-rotator.js"></script>
 *
 * Attributes:
 *   data-folder  ~ key in photo-metadata.json ("matt", "jewelry", "forest", "misc")
 *   data-tag     ~ optional; filter photos by tag
 *   data-mode    ~ "signature" for Forest Temple author block (matt lane)
 *                  "boom-signature" for Boom Frequency author block (boom lane)
 *                  omit for the default full-width rotating display
 *   data-name    ~ override display name under photo (signature/boom-signature modes)
 *
 * Reads /personal-photos/photo-metadata.json.
 * Shows nothing if folder is empty or metadata fetch fails.
 */
(function () {
  "use strict";

  var METADATA_URL = "/personal-photos/photo-metadata.json";
  var BASE_URL     = "/personal-photos/";

  // ── Default-mode styles ──────────────────────────────────────────────────
  var defaultCss = [
    ".voa-rotator-wrap{position:relative;width:100%;max-width:560px;margin:0 auto;text-align:center;cursor:pointer;user-select:none;}",
    ".voa-rotator-img-wrap{position:relative;overflow:hidden;border-radius:6px;background:#0a1a14;min-height:180px;display:flex;align-items:center;justify-content:center;}",
    ".voa-rotator-img{display:block;width:100%;height:auto;max-height:420px;object-fit:cover;border-radius:6px;transition:opacity 0.5s ease;}",
    ".voa-rotator-img.fade-out{opacity:0;}",
    ".voa-rotator-caption{margin-top:0.65rem;font-family:'Lora',Georgia,serif;font-size:0.9rem;font-style:italic;color:rgba(208,255,248,0.6);line-height:1.5;min-height:1.3em;}",
    ".voa-rotator-hint{margin-top:0.35rem;font-size:0.7rem;letter-spacing:0.08em;color:rgba(208,255,248,0.25);text-transform:uppercase;}"
  ].join("\n");

  function injectStyles() {
    if (document.getElementById("voa-rotator-css")) return;
    var el = document.createElement("style");
    el.id = "voa-rotator-css";
    el.textContent = defaultCss;
    document.head.appendChild(el);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function buildPhotoList(metadata, folder, tag) {
    var section = metadata[folder];
    if (!section || typeof section !== "object") return [];
    var photos = [];
    Object.keys(section).forEach(function (filename) {
      var entry = section[filename];
      if (tag) {
        var tags = entry.tags || [];
        if (tags.indexOf(tag) === -1) return;
      }
      var urlPath = BASE_URL + folder + "/" + filename;
      photos.push({
        filename: filename,
        url:      urlPath,
        caption:  entry.caption || "",
        year:     entry.year    || null,
        tags:     entry.tags    || []
      });
    });
    return photos;
  }

  // ── Default (full-width rotating display) mode ──────────────────────────
  function initDefault(container, metadata) {
    var folder  = container.getAttribute("data-folder") || "matt";
    var tag     = container.getAttribute("data-tag")    || "";

    var photos  = buildPhotoList(metadata, folder, tag);
    if (photos.length === 0) return;

    var shuffled = shuffle(photos);
    var index    = 0;

    var wrap = document.createElement("div");
    wrap.className = "voa-rotator-wrap";
    wrap.title = "Click to see another photo";

    var imgWrap = document.createElement("div");
    imgWrap.className = "voa-rotator-img-wrap";

    var img = document.createElement("img");
    img.className = "voa-rotator-img";
    img.alt = "";
    img.loading = "lazy";

    var caption = document.createElement("p");
    caption.className = "voa-rotator-caption";

    var hint = document.createElement("p");
    hint.className = "voa-rotator-hint";
    hint.textContent = "click to cycle";

    imgWrap.appendChild(img);
    wrap.appendChild(imgWrap);
    wrap.appendChild(caption);
    wrap.appendChild(hint);
    container.appendChild(wrap);

    function showPhoto(p) {
      var yearSuffix = p.year ? " (" + p.year + ")" : "";
      caption.textContent = p.caption + yearSuffix;
      img.src = p.url;
      img.alt = p.caption || "";
    }

    wrap.addEventListener("click", function () {
      img.classList.add("fade-out");
      setTimeout(function () {
        index = (index + 1) % shuffled.length;
        showPhoto(shuffled[index]);
        img.classList.remove("fade-out");
      }, 480);
    });

    showPhoto(shuffled[index]);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── FOREST TEMPLE signature mode (matt lane) ─────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  // 3:4 portrait default (133.33% padding-bottom), switches to 4:3 landscape
  // for treeyoga/fulllotus. Image always fills container, shape never changes.
  // .voa-sig-frame has 24px padding → creates gap zone between image and SVG.
  // SVG (inset:0 on frame) draws ONLY in that 24px gap ~ never over the image.
  // Electric neon green (#39FF14) energy field: brackets, nodes, triangles,
  // dashed traveling lines, chevrons, organic vines. drop-shadow glow on SVG.

  function injectSignatureStyles() {
    if (document.getElementById("voa-sig-css")) return;
    var el = document.createElement("style");
    el.id = "voa-sig-css";
    el.textContent = [
      // Keyframes ~ neon green energy field
      "@keyframes voa-geo-glow{0%,100%{opacity:0.5}50%{opacity:0.95}}",
      "@keyframes voa-geo-pulse{0%,100%{opacity:0.45}50%{opacity:0.9}}",
      "@keyframes voa-geo-tri{0%,100%{opacity:0.4}50%{opacity:0.85}}",
      "@keyframes voa-geo-travel{from{stroke-dashoffset:0}to{stroke-dashoffset:-8}}",
      "@keyframes voa-tri-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
      "@keyframes voa-tri-breathe{0%,100%{opacity:0.4}50%{opacity:0.9}}",
      // Layout
      ".voa-sig-rule{border:none;border-top:1px solid rgba(57,255,20,0.12);margin:2.5rem 0 1.75rem;}",
      ".voa-sig-block{display:block;width:100%;text-align:center;cursor:pointer;user-select:none;padding-bottom:1rem;}",
      // Frame: 24px padding creates the gap zone; SVG covers this full area (inset:0 on frame)
      ".voa-sig-frame{position:relative;display:inline-block;max-width:268px;width:100%;padding:24px;box-sizing:border-box;}",
      // Image wrapper: fills frame content area (268-48=220px); no box-shadow here
      ".voa-sig-img-wrap{position:relative;width:100%;padding-bottom:133.33%;overflow:hidden;border-radius:8px;}",
      ".voa-sig-photo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:8px;transition:opacity 0.3s ease;}",
      // Glow overlay: sits above image, provides neon border + inner glow
      ".voa-sig-img-glow{position:absolute;inset:0;border-radius:8px;border:1px solid rgba(57,255,20,0.22);box-shadow:inset 0 0 14px rgba(57,255,20,0.15);pointer-events:none;z-index:2;}",
      // SVG: covers full frame including 24px padding gap zone; drop-shadow set inline on SVG element
      ".voa-sig-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;}",
      // Text elements ~ electric green tone (matt theme default)
      ".voa-sig-name{font-family:'Lora',Georgia,serif;font-variant:small-caps;font-size:0.95rem;letter-spacing:0.14em;color:rgba(57,255,20,0.7);margin:0.9rem 0 0.35rem;}",
      ".voa-sig-caption{font-family:'Lora',Georgia,serif;font-style:italic;font-size:0.97rem;line-height:1.7;color:rgba(57,255,20,0.55);max-width:480px;margin:0 auto 0.6rem;min-height:1.4em;}",
      ".voa-sig-hint{font-size:0.58rem;letter-spacing:0.13em;color:#7EB8B0;opacity:0.65;}",
      // Boom theme overrides ~ electric cyan (#00FFFF) palette
      ".voa-photo-rotator[data-theme='boom'] .voa-sig-rule{border-top-color:rgba(0,255,255,0.12);}",
      ".voa-photo-rotator[data-theme='boom'] .voa-sig-img-glow{border:1px solid rgba(0,255,255,0.2);box-shadow:inset 0 0 12px rgba(0,255,255,0.15);}",
      ".voa-photo-rotator[data-theme='boom'] .voa-sig-name{color:rgba(0,223,223,0.7);}",
      ".voa-photo-rotator[data-theme='boom'] .voa-sig-caption{color:rgba(215,230,225,0.65);font-size:11px;font-style:italic;font-family:'Space Grotesk',sans-serif;line-height:1.6;min-height:0;}"
    ].join("\n");
    document.head.appendChild(el);
  }

  // Sacred geometry energy field SVG for Forest Temple.
  // viewBox="0 0 268 341" matches the padded frame at max-width (portrait).
  // Image zone: x:24-244, y:24-317. All ornaments drawn in the 24px margin gap
  // zone OUTSIDE that rectangle ~ the image itself is never covered.
  // SVG is positioned inset:0 on .voa-sig-frame (which has padding:24px),
  // so the SVG coordinate space exactly maps to the full padded frame.
  // For landscape images, render() updates viewBox to "0 0 268 213".
  var SIG_SVG_FRAME = (
    '<svg class="voa-sig-svg" viewBox="0 0 268 341" preserveAspectRatio="none" ' +
    'xmlns="http://www.w3.org/2000/svg" overflow="visible" aria-hidden="true" ' +
    'style="filter:drop-shadow(0 0 6px #39FF14);">' +

    // ── Layer 1: Corner L-brackets (photo corner mount style) ────────────────
    // Arms: 18px, inset 4px from corner edge. stroke-linecap:square for crisp ends.
    '<g fill="none" stroke="#39FF14" stroke-width="1.8" stroke-linecap="square" ' +
    'style="animation:voa-geo-glow 9s ease-in-out infinite;">' +
    '<path d="M4,22 L4,4 L22,4" stroke-opacity="0.72"/>' +
    '<path d="M264,22 L264,4 L246,4" stroke-opacity="0.72"/>' +
    '<path d="M4,319 L4,337 L22,337" stroke-opacity="0.72"/>' +
    '<path d="M264,319 L264,337 L246,337" stroke-opacity="0.72"/>' +
    '</g>' +

    // ── Layer 2: Circle nodes at bracket corners and arm endpoints ────────────
    '<g fill="#39FF14" stroke="none" style="animation:voa-geo-pulse 8s ease-in-out infinite;">' +
    '<circle cx="4"   cy="4"   r="2.5" fill-opacity="0.75"/>' +
    '<circle cx="264" cy="4"   r="2.5" fill-opacity="0.75" style="animation-delay:0.5s"/>' +
    '<circle cx="4"   cy="337" r="2.5" fill-opacity="0.75" style="animation-delay:1s"/>' +
    '<circle cx="264" cy="337" r="2.5" fill-opacity="0.75" style="animation-delay:1.5s"/>' +
    '<circle cx="22"  cy="4"   r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="4"   cy="22"  r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="246" cy="4"   r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="264" cy="22"  r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="22"  cy="337" r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="4"   cy="319" r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="246" cy="337" r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="264" cy="319" r="1.3" fill-opacity="0.55"/>' +
    '</g>' +

    // ── Layer 3: Small triangles near corners pointing outward ────────────────
    // Top strip (y<24): triangles pointing downward from top edge
    // Left/right strips: triangles pointing inward from side edges
    // Bottom strip (y>317): triangles pointing upward from bottom edge
    '<g fill="#39FF14" style="animation:voa-geo-tri 11s ease-in-out infinite;">' +
    '<polygon points="28,4  36,4  32,12"  fill-opacity="0.55"/>' +
    '<polygon points="4,28  4,36  12,32"  fill-opacity="0.55"/>' +
    '<polygon points="32,4  38,4  35,9"   fill-opacity="0.30"/>' +
    '<polygon points="240,4  232,4  236,12"  fill-opacity="0.55"/>' +
    '<polygon points="264,28 264,36 256,32"  fill-opacity="0.55"/>' +
    '<polygon points="228,4  234,4  231,9"   fill-opacity="0.30"/>' +
    '<polygon points="28,337  36,337  32,329"  fill-opacity="0.55"/>' +
    '<polygon points="4,305   4,313  12,309"   fill-opacity="0.55"/>' +
    '<polygon points="32,337  38,337  35,332"  fill-opacity="0.30"/>' +
    '<polygon points="240,337 232,337 236,329"  fill-opacity="0.55"/>' +
    '<polygon points="264,313 264,305 256,309"  fill-opacity="0.55"/>' +
    '<polygon points="228,337 234,337 231,332"  fill-opacity="0.30"/>' +
    '</g>' +

    // ── Layer 4: Dashed edge lines ~ corner to midpoint, traveling light ──────
    // Run along center of each 24px margin strip (y=12, y=329, x=12, x=256).
    // Lines stop before midpoint creating a fade-out-at-center effect.
    '<g fill="none" stroke="#39FF14" stroke-width="0.9" stroke-dasharray="3 5" stroke-linecap="round">' +
    '<line x1="22"  y1="12"  x2="108" y2="12"  stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite;"/>' +
    '<line x1="246" y1="12"  x2="160" y2="12"  stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite;"/>' +
    '<line x1="22"  y1="329" x2="108" y2="329" stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 2.5s;"/>' +
    '<line x1="246" y1="329" x2="160" y2="329" stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 2.5s;"/>' +
    '<line x1="12"  y1="22"  x2="12"  y2="138" stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 5s;"/>' +
    '<line x1="12"  y1="319" x2="12"  y2="203" stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 5s;"/>' +
    '<line x1="256" y1="22"  x2="256" y2="138" stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 7.5s;"/>' +
    '<line x1="256" y1="319" x2="256" y2="203" stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 7.5s;"/>' +
    '</g>' +

    // ── Layer 5: Arrow/chevron marks at corner tips, pointing outward ─────────
    '<g fill="none" stroke="#39FF14" stroke-width="1.1" stroke-linecap="round" stroke-opacity="0.45">' +
    '<path d="M7,11  L2,2   L11,7"/>' +
    '<path d="M261,11 L266,2  L257,7"/>' +
    '<path d="M7,330  L2,339  L11,334"/>' +
    '<path d="M261,330 L266,339 L257,334"/>' +
    '</g>' +

    // ── Layer 6: Organic vine strokes at TR and BL corners ────────────────────
    // Contrast the angular geometry ~ one organic tendril at each of two corners.
    '<g fill="none" stroke="#39FF14" stroke-width="0.9" stroke-linecap="round" stroke-opacity="0.38">' +
    '<path d="M246,4 C250,1 258,2 262,6 C265,10 262,16 258,18 C254,20 250,18 249,22"/>' +
    '<circle cx="262" cy="6" r="1.5" fill="#39FF14" fill-opacity="0.35" stroke="none"/>' +
    '<path d="M22,337 C18,340 10,340 6,336 C2,332 2,325 6,322 C10,319 16,322 18,318"/>' +
    '<circle cx="6" cy="336" r="1.5" fill="#39FF14" fill-opacity="0.35" stroke="none"/>' +
    '</g>' +

    // ── Layer 7: Triforces ~ three rotating sacred triangle formations ────────
    // Classic Zelda triforce: two equilateral triangles on bottom, one on top.
    // Stroke only (no fill) so they feel ethereal. Each group rotates around its
    // own center via transform-box:fill-box + transform-origin:center.
    // Three different speeds (15s, 22s, 30s) so they never sync.

    // Large triforce at TR corner (side s=10, bx=248, by=2, h=8.66)
    '<g fill="none" stroke="#39FF14" stroke-width="0.9" stroke-linejoin="round" stroke-opacity="0.75" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 15s linear infinite,voa-tri-breathe 7s ease-in-out infinite;">' +
    '<polygon points="248,19.3 258,19.3 253,10.7"/>' +
    '<polygon points="258,19.3 268,19.3 263,10.7"/>' +
    '<polygon points="253,10.7 263,10.7 258,2"/>' +
    '</g>' +

    // Small triforce at BL corner (side s=7, bx=4, by=324, h=6.06)
    '<g fill="none" stroke="#39FF14" stroke-width="0.8" stroke-linejoin="round" stroke-opacity="0.65" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 22s linear infinite 3s,voa-tri-breathe 8s ease-in-out infinite 1s;">' +
    '<polygon points="4,336.1 11,336.1 7.5,330.1"/>' +
    '<polygon points="11,336.1 18,336.1 14.5,330.1"/>' +
    '<polygon points="7.5,330.1 14.5,330.1 11,324"/>' +
    '</g>' +

    // Tiny triforce at TL corner (side s=5, bx=6, by=4, h=4.33) ~ more faded
    '<g fill="none" stroke="#39FF14" stroke-width="0.65" stroke-linejoin="round" stroke-opacity="0.45" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 30s linear infinite 1.5s,voa-tri-breathe 10s ease-in-out infinite 4s;">' +
    '<polygon points="6,12.7 11,12.7 8.5,8.3"/>' +
    '<polygon points="11,12.7 16,12.7 13.5,8.3"/>' +
    '<polygon points="8.5,8.3 13.5,8.3 11,4"/>' +
    '</g>' +

    // ── Layer 8: Fragment triangles ~ single drifting broken triforce pieces ───
    // Four standalone equilateral triangles scattered at other corners/edges.
    // Each rotates independently on its own axis at a different speed + phase.

    // BR corner fragment (side s=6, pointing up)
    '<polygon fill="none" stroke="#39FF14" stroke-width="0.75" stroke-linejoin="round" stroke-opacity="0.6" ' +
    'points="258,325 255,330.2 261,330.2" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 25s linear infinite 6s,voa-tri-breathe 9s ease-in-out infinite 2s;"/>' +

    // Right edge mid-height fragment (side s=5, pointing up)
    '<polygon fill="none" stroke="#39FF14" stroke-width="0.65" stroke-linejoin="round" stroke-opacity="0.5" ' +
    'points="259,168 256.5,172.3 261.5,172.3" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 35s linear infinite 2s,voa-tri-breathe 6s ease-in-out infinite 5s;"/>' +

    // Bottom center edge fragment (side s=4)
    '<polygon fill="none" stroke="#39FF14" stroke-width="0.6" stroke-linejoin="round" stroke-opacity="0.45" ' +
    'points="134,320 132,323.5 136,323.5" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 20s linear infinite 8s,voa-tri-breathe 11s ease-in-out infinite 3s;"/>' +

    // Left edge mid-height fragment (side s=4)
    '<polygon fill="none" stroke="#39FF14" stroke-width="0.6" stroke-linejoin="round" stroke-opacity="0.45" ' +
    'points="7,198 5,201.5 9,201.5" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 28s linear infinite 4s,voa-tri-breathe 8s ease-in-out infinite 7s;"/>' +

    '</svg>'
  );

  // Landscape version of the sacred geometry frame (viewBox 0 0 268 213).
  // Frame: 268x213px ~ image 220x165 (4:3) inside 24px padding.
  // Image zone: x:24-244, y:24-189. Bottom zone: y:189-213.
  // All top-zone elements are IDENTICAL to portrait.
  // Bottom-zone elements shifted -128 (portrait 341px ~ landscape 213px = 128 diff).
  // Edge line midpoints recalculated: portrait mid=170.5 -> landscape mid=106.5.
  var SIG_SVG_LANDSCAPE = (
    '<svg class="voa-sig-svg" viewBox="0 0 268 213" preserveAspectRatio="none" ' +
    'xmlns="http://www.w3.org/2000/svg" overflow="visible" aria-hidden="true" ' +
    'style="filter:drop-shadow(0 0 6px #39FF14);">' +

    '<g fill="none" stroke="#39FF14" stroke-width="1.8" stroke-linecap="square" ' +
    'style="animation:voa-geo-glow 9s ease-in-out infinite;">' +
    '<path d="M4,22 L4,4 L22,4" stroke-opacity="0.72"/>' +
    '<path d="M264,22 L264,4 L246,4" stroke-opacity="0.72"/>' +
    '<path d="M4,191 L4,209 L22,209" stroke-opacity="0.72"/>' +
    '<path d="M264,191 L264,209 L246,209" stroke-opacity="0.72"/>' +
    '</g>' +

    '<g fill="#39FF14" stroke="none" style="animation:voa-geo-pulse 8s ease-in-out infinite;">' +
    '<circle cx="4"   cy="4"   r="2.5" fill-opacity="0.75"/>' +
    '<circle cx="264" cy="4"   r="2.5" fill-opacity="0.75" style="animation-delay:0.5s"/>' +
    '<circle cx="4"   cy="209" r="2.5" fill-opacity="0.75" style="animation-delay:1s"/>' +
    '<circle cx="264" cy="209" r="2.5" fill-opacity="0.75" style="animation-delay:1.5s"/>' +
    '<circle cx="22"  cy="4"   r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="4"   cy="22"  r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="246" cy="4"   r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="264" cy="22"  r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="22"  cy="209" r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="4"   cy="191" r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="246" cy="209" r="1.3" fill-opacity="0.55"/>' +
    '<circle cx="264" cy="191" r="1.3" fill-opacity="0.55"/>' +
    '</g>' +

    '<g fill="#39FF14" style="animation:voa-geo-tri 11s ease-in-out infinite;">' +
    '<polygon points="28,4  36,4  32,12"  fill-opacity="0.55"/>' +
    '<polygon points="4,28  4,36  12,32"  fill-opacity="0.55"/>' +
    '<polygon points="32,4  38,4  35,9"   fill-opacity="0.30"/>' +
    '<polygon points="240,4  232,4  236,12"  fill-opacity="0.55"/>' +
    '<polygon points="264,28 264,36 256,32"  fill-opacity="0.55"/>' +
    '<polygon points="228,4  234,4  231,9"   fill-opacity="0.30"/>' +
    '<polygon points="28,209  36,209  32,201"  fill-opacity="0.55"/>' +
    '<polygon points="4,177   4,185  12,181"   fill-opacity="0.55"/>' +
    '<polygon points="32,209  38,209  35,204"  fill-opacity="0.30"/>' +
    '<polygon points="240,209 232,209 236,201"  fill-opacity="0.55"/>' +
    '<polygon points="264,185 264,177 256,181"  fill-opacity="0.55"/>' +
    '<polygon points="228,209 234,209 231,204"  fill-opacity="0.30"/>' +
    '</g>' +

    '<g fill="none" stroke="#39FF14" stroke-width="0.9" stroke-dasharray="3 5" stroke-linecap="round">' +
    '<line x1="22"  y1="12"  x2="108" y2="12"  stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite;"/>' +
    '<line x1="246" y1="12"  x2="160" y2="12"  stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite;"/>' +
    '<line x1="22"  y1="201" x2="108" y2="201" stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 2.5s;"/>' +
    '<line x1="246" y1="201" x2="160" y2="201" stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 2.5s;"/>' +
    '<line x1="12"  y1="22"  x2="12"  y2="74"  stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 5s;"/>' +
    '<line x1="12"  y1="191" x2="12"  y2="139" stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 5s;"/>' +
    '<line x1="256" y1="22"  x2="256" y2="74"  stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 7.5s;"/>' +
    '<line x1="256" y1="191" x2="256" y2="139" stroke-opacity="0.5" style="animation:voa-geo-travel 10s linear infinite 7.5s;"/>' +
    '</g>' +

    '<g fill="none" stroke="#39FF14" stroke-width="1.1" stroke-linecap="round" stroke-opacity="0.45">' +
    '<path d="M7,11   L2,2   L11,7"/>' +
    '<path d="M261,11 L266,2  L257,7"/>' +
    '<path d="M7,202  L2,211  L11,206"/>' +
    '<path d="M261,202 L266,211 L257,206"/>' +
    '</g>' +

    '<g fill="none" stroke="#39FF14" stroke-width="0.9" stroke-linecap="round" stroke-opacity="0.38">' +
    '<path d="M246,4 C250,1 258,2 262,6 C265,10 262,16 258,18 C254,20 250,18 249,22"/>' +
    '<circle cx="262" cy="6"   r="1.5" fill="#39FF14" fill-opacity="0.35" stroke="none"/>' +
    '<path d="M22,209 C18,212 10,212 6,208 C2,204 2,197 6,194 C10,191 16,194 18,190"/>' +
    '<circle cx="6"   cy="208" r="1.5" fill="#39FF14" fill-opacity="0.35" stroke="none"/>' +
    '</g>' +

    '<g fill="none" stroke="#39FF14" stroke-width="0.9" stroke-linejoin="round" stroke-opacity="0.75" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 15s linear infinite,voa-tri-breathe 7s ease-in-out infinite;">' +
    '<polygon points="248,19.3 258,19.3 253,10.7"/>' +
    '<polygon points="258,19.3 268,19.3 263,10.7"/>' +
    '<polygon points="253,10.7 263,10.7 258,2"/>' +
    '</g>' +
    '<g fill="none" stroke="#39FF14" stroke-width="0.8" stroke-linejoin="round" stroke-opacity="0.65" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 22s linear infinite 3s,voa-tri-breathe 8s ease-in-out infinite 1s;">' +
    '<polygon points="4,208.1 11,208.1 7.5,202.1"/>' +
    '<polygon points="11,208.1 18,208.1 14.5,202.1"/>' +
    '<polygon points="7.5,202.1 14.5,202.1 11,196"/>' +
    '</g>' +
    '<g fill="none" stroke="#39FF14" stroke-width="0.65" stroke-linejoin="round" stroke-opacity="0.45" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 30s linear infinite 1.5s,voa-tri-breathe 10s ease-in-out infinite 4s;">' +
    '<polygon points="6,12.7 11,12.7 8.5,8.3"/>' +
    '<polygon points="11,12.7 16,12.7 13.5,8.3"/>' +
    '<polygon points="8.5,8.3 13.5,8.3 11,4"/>' +
    '</g>' +

    '<polygon fill="none" stroke="#39FF14" stroke-width="0.75" stroke-linejoin="round" stroke-opacity="0.6" ' +
    'points="258,197 255,202.2 261,202.2" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 25s linear infinite 6s,voa-tri-breathe 9s ease-in-out infinite 2s;"/>' +
    '<polygon fill="none" stroke="#39FF14" stroke-width="0.65" stroke-linejoin="round" stroke-opacity="0.5" ' +
    'points="259,105 256.5,109.3 261.5,109.3" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 35s linear infinite 2s,voa-tri-breathe 6s ease-in-out infinite 5s;"/>' +
    '<polygon fill="none" stroke="#39FF14" stroke-width="0.6" stroke-linejoin="round" stroke-opacity="0.45" ' +
    'points="134,192 132,195.5 136,195.5" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 20s linear infinite 8s,voa-tri-breathe 11s ease-in-out infinite 3s;"/>' +
    '<polygon fill="none" stroke="#39FF14" stroke-width="0.6" stroke-linejoin="round" stroke-opacity="0.45" ' +
    'points="7,122 5,125.5 9,125.5" ' +
    'style="transform-box:fill-box;transform-origin:center;animation:voa-tri-spin 28s linear infinite 4s,voa-tri-breathe 8s ease-in-out infinite 7s;"/>' +

    '</svg>'
  );

  // Returns the correct SVG string for the given orientation and theme color.
  // Replaces all #39FF14 occurrences with the supplied color so both portrait
  // and landscape variants can be tinted for any theme (green, cyan, etc.).
  function getSigSVG(landscape, color) {
    var s = landscape ? SIG_SVG_LANDSCAPE : SIG_SVG_FRAME;
    if (color && color !== "#39FF14") {
      s = s.replace(/#39FF14/g, color);
    }
    return s;
  }

  function initSignature(container, metadata) {
    var folder      = (container.getAttribute("data-folder") || "matt").trim();
    // boom uses matt photos (no dedicated boom photo folder yet)
    var photoFolder = (folder === "boom") ? "matt" : folder;
    // theme determines color palette; any non-matt folder gets cyan boom theme
    var theme       = (folder === "matt") ? "matt" : "boom";
    var sigColor    = (theme === "matt")  ? "#39FF14" : "#00FFFF";
    var name        = (container.getAttribute("data-name") ||
                       (folder === "matt" ? "Matt EarthStar" :
                        (folder === "boom" || folder === "boombot") ? "Matty BoomBoom" : "")).trim();
    var photos = buildPhotoList(metadata, photoFolder, "");
    // stamp theme on container so CSS overrides can target it
    container.setAttribute("data-theme", theme);
    if (photos.length === 0) return;

    injectSignatureStyles();

    var deck = shuffle(photos);
    var idx  = 0;
    var loadAttempts = 0;

    var rule = document.createElement("hr");
    rule.className = "voa-sig-rule";

    var block = document.createElement("div");
    block.className = "voa-sig-block";
    block.title = "Click to cycle photos";

    // .voa-sig-frame: max-width wrapper
    var frame = document.createElement("div");
    frame.className = "voa-sig-frame";

    // .voa-sig-img-wrap: portrait padding-bottom container (shape locked via CSS)
    var imgWrap = document.createElement("div");
    imgWrap.className = "voa-sig-img-wrap";

    var img = document.createElement("img");
    img.className = "voa-sig-photo";
    img.loading = "lazy";

    // Glow overlay: sits above the image, provides neon border + inner glow
    var glow = document.createElement("div");
    glow.className = "voa-sig-img-glow";

    // SVG container: holds the active SVG frame (swapped on orientation change).
    // Position absolute inset:0 on .voa-sig-frame so it covers the full padding gap.
    var svgContainer = document.createElement("div");
    svgContainer.style.cssText = "position:absolute;inset:0;pointer-events:none;";

    imgWrap.appendChild(img);
    imgWrap.appendChild(glow);
    frame.appendChild(imgWrap);
    frame.appendChild(svgContainer);

    var nameEl = document.createElement("p");
    nameEl.className = "voa-sig-name";
    nameEl.textContent = name;
    nameEl.style.display = name ? "" : "none";

    var cap = document.createElement("p");
    cap.className = "voa-sig-caption";

    var hint = document.createElement("p");
    hint.className = "voa-sig-hint";
    hint.textContent = "\u2736 click to cycle \u2736";

    // These two images are landscape ~ switch container to 4:3 for them
    var LANDSCAPE_FILES = ["treeyoga.jpeg", "treeyoga.jpg", "fulllotus.jpeg", "fulllotus.jpg"];
    var currentOrientation = null; // "P" portrait | "L" landscape — avoid redundant SVG swaps

    // Boom theme: fixed byline HTML set once (not driven by individual photo captions)
    if (theme === "boom") {
      cap.innerHTML = "This was written by the AI persona of Matt EarthStar known as Matty BoomBoom. To learn how to fully automate a content creation machine of your own start with the <a href='/field-guide/' style='color:#00FFFF;'>Field Guide</a> \u2014 and to read Matt\u2019s words without the AI influence check out the very real and down to Earth <a href='/blog/matt/' style='color:#4eb868;'>Forest Temple Blog</a> \u2014 all human generated content from the heart, mind, and soul of Matt EarthStar.";
      cap.style.display = "";
    }

    function render(photo) {
      var isLandscape = LANDSCAPE_FILES.indexOf(photo.filename) !== -1;
      imgWrap.style.paddingBottom = isLandscape ? "75%" : "133.33%";
      // Swap the entire SVG frame when orientation changes so all element positions
      // are correct for the new container shape (portrait 268x341 / landscape 268x213).
      var orient = isLandscape ? "L" : "P";
      if (orient !== currentOrientation) {
        currentOrientation = orient;
        svgContainer.innerHTML = getSigSVG(isLandscape, sigColor);
      }
      img.alt = photo.caption || name || "";
      img.src = photo.url;
      // Boom theme uses a fixed byline; never overwrite with individual photo captions
      if (theme !== "boom") {
        cap.textContent = photo.caption || "";
        cap.style.display = photo.caption ? "" : "none";
      }
    }

    img.onerror = function () {
      loadAttempts++;
      if (loadAttempts >= deck.length) {
        rule.style.display = "none";
        block.style.display = "none";
        return;
      }
      idx = (idx + 1) % deck.length;
      render(deck[idx]);
    };

    render(deck[idx]);
    block.appendChild(frame);
    block.appendChild(nameEl);
    block.appendChild(cap);

    block.addEventListener("click", function () {
      img.style.opacity = "0";
      setTimeout(function () {
        loadAttempts = 0;
        idx = (idx + 1) % deck.length;
        render(deck[idx]);
        img.style.opacity = "1";
      }, 280);
    });

    container.appendChild(rule);
    container.appendChild(block);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── BOOM FREQUENCY signature mode (boom lane) ────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  // Same 4:3 locked rectangle. Amber/electric accent (#FFB347). Angular
  // geometry ~ sharp triangles and lightning lines feel, less organic curves.
  // Label: "Matty BoomBoom". data-folder="misc" by default.

  function injectBoomSignatureStyles() {
    if (document.getElementById("voa-boom-sig-css")) return;
    var el = document.createElement("style");
    el.id = "voa-boom-sig-css";
    el.textContent = [
      "@keyframes voa-boom-pulse{0%,100%{opacity:0.4}50%{opacity:0.95}}",
      "@keyframes voa-boom-travel{from{stroke-dashoffset:0}to{stroke-dashoffset:-382}}",
      "@keyframes voa-boom-spinR{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
      "@keyframes voa-boom-spinL{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}",
      "@keyframes voa-boom-zap{0%,90%,100%{opacity:0.35}95%{opacity:0.9}}",
      ".voa-boom-rule{border:none;border-top:1px solid rgba(255,179,71,0.2);margin:2.5rem 0 1.75rem;}",
      ".voa-boom-block{display:block;width:100%;text-align:center;cursor:pointer;user-select:none;padding-bottom:1rem;}",
      ".voa-boom-frame{position:relative;display:inline-block;max-width:280px;width:100%;}",
      ".voa-boom-img-wrap{position:relative;width:100%;padding-bottom:75%;overflow:hidden;border-radius:4px;box-shadow:0 0 32px rgba(255,179,71,0.3),0 0 8px rgba(255,179,71,0.15);}",
      ".voa-boom-photo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:4px;transition:opacity 0.3s ease;}",
      ".voa-boom-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;}",
      ".voa-boom-name{font-family:'Rajdhani','Space Grotesk',sans-serif;font-weight:700;font-size:0.9rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,179,71,0.8);margin:0.9rem 0 0.35rem;}",
      ".voa-boom-caption{font-family:'Space Grotesk','Rajdhani',sans-serif;font-size:0.92rem;line-height:1.65;color:rgba(255,179,71,0.7);max-width:480px;margin:0 auto 0.6rem;min-height:1.4em;}",
      ".voa-boom-hint{font-size:0.58rem;letter-spacing:0.16em;color:#00e5ff;opacity:0.6;text-transform:uppercase;}"
    ].join("\n");
    document.head.appendChild(el);
  }

  // Angular electric geometry SVG for Boom Frequency.
  // Sharp triangles, lightning/chevron lines, minimal circles.
  // viewBox="0 0 100 75" (4:3). Overflow visible for outside elements.
  var BOOM_SVG_FRAME = (
    '<svg class="voa-boom-svg" viewBox="0 0 100 75" xmlns="http://www.w3.org/2000/svg" overflow="visible" aria-hidden="true">' +

    // ── Outer perimeter: fast-traveling dashed line ──────────────────────────
    '<rect x="-4" y="-4" width="108" height="83" rx="0" ry="0"' +
    '  fill="none" stroke="#FFB347" stroke-width="0.7" stroke-opacity="0.45"' +
    '  stroke-dasharray="4 6"' +
    '  style="animation:voa-boom-travel 10s linear infinite;"/>' +

    // ── Corner chevrons: sharp angular cuts, no curves ────────────────────────
    // Top-left: two lines, small filled triangle at corner
    '<path d="M0,14 L0,0 L14,0" fill="none" stroke="#FFB347" stroke-width="1.3" stroke-opacity="0.8" stroke-linecap="square"/>' +
    '<polygon points="0,0 5,0 0,5" fill="#FFB347" fill-opacity="0.7"/>' +
    // Top-right
    '<path d="M100,14 L100,0 L86,0" fill="none" stroke="#FFB347" stroke-width="1.3" stroke-opacity="0.8" stroke-linecap="square"/>' +
    '<polygon points="100,0 95,0 100,5" fill="#FFB347" fill-opacity="0.7"/>' +
    // Bottom-left
    '<path d="M0,61 L0,75 L14,75" fill="none" stroke="#FFB347" stroke-width="1.3" stroke-opacity="0.8" stroke-linecap="square"/>' +
    '<polygon points="0,75 5,75 0,70" fill="#FFB347" fill-opacity="0.7"/>' +
    // Bottom-right
    '<path d="M100,61 L100,75 L86,75" fill="none" stroke="#FFB347" stroke-width="1.3" stroke-opacity="0.8" stroke-linecap="square"/>' +
    '<polygon points="100,75 95,75 100,70" fill="#FFB347" fill-opacity="0.7"/>' +

    // ── Mid-edge: upward/downward/left/right pointing triangles ───────────────
    // Top center ~ sharp upward triangle
    '<polygon points="50,-12 54,-5 46,-5" fill="#FFB347" fill-opacity="0.5" style="animation:voa-boom-pulse 3s ease-in-out infinite;"/>' +
    '<line x1="50" y1="-5" x2="50" y2="0" stroke="#FFB347" stroke-width="0.6" stroke-opacity="0.5"/>' +
    // Bottom center ~ sharp downward triangle
    '<polygon points="50,87 54,80 46,80" fill="#FFB347" fill-opacity="0.5" style="animation:voa-boom-pulse 3s ease-in-out infinite 0.75s;"/>' +
    '<line x1="50" y1="75" x2="50" y2="80" stroke="#FFB347" stroke-width="0.6" stroke-opacity="0.5"/>' +
    // Left center ~ leftward triangle
    '<polygon points="-12,37.5 -5,33.5 -5,41.5" fill="#FFB347" fill-opacity="0.5" style="animation:voa-boom-pulse 3s ease-in-out infinite 0.4s;"/>' +
    '<line x1="0" y1="37.5" x2="-5" y2="37.5" stroke="#FFB347" stroke-width="0.6" stroke-opacity="0.5"/>' +
    // Right center ~ rightward triangle
    '<polygon points="112,37.5 105,33.5 105,41.5" fill="#FFB347" fill-opacity="0.5" style="animation:voa-boom-pulse 3s ease-in-out infinite 1.1s;"/>' +
    '<line x1="100" y1="37.5" x2="105" y2="37.5" stroke="#FFB347" stroke-width="0.6" stroke-opacity="0.5"/>' +

    // ── Outer ring: fast-spinning square "crosshair" reticle ─────────────────
    // Inner ring rotates clockwise
    '<g style="transform-origin:50px 37.5px;animation:voa-boom-spinR 20s linear infinite;opacity:0.45;">' +
    '<rect x="35.5" y="22" width="29" height="31" rx="0" fill="none" stroke="#FFB347" stroke-width="0.4" stroke-dasharray="3 14"/>' +
    '</g>' +
    // Outer ring rotates counter-clockwise (larger)
    '<g style="transform-origin:50px 37.5px;animation:voa-boom-spinL 35s linear infinite;opacity:0.3;">' +
    '<rect x="26" y="14" width="48" height="47" rx="0" fill="none" stroke="#FFB347" stroke-width="0.35" stroke-dasharray="2 18"/>' +
    '</g>' +

    // ── "Zap" flash lines: occasional lightning flicker ─────────────────────
    '<line x1="-8" y1="20" x2="-4" y2="25" stroke="#FFB347" stroke-width="0.7" stroke-opacity="0.6" stroke-linecap="square" style="animation:voa-boom-zap 6s step-end infinite;"/>' +
    '<line x1="-4" y1="25" x2="-8" y2="30" stroke="#FFB347" stroke-width="0.7" stroke-opacity="0.6" stroke-linecap="square" style="animation:voa-boom-zap 6s step-end infinite 0.1s;"/>' +
    '<line x1="108" y1="45" x2="104" y2="50" stroke="#FFB347" stroke-width="0.7" stroke-opacity="0.6" stroke-linecap="square" style="animation:voa-boom-zap 7s step-end infinite 2s;"/>' +
    '<line x1="104" y1="50" x2="108" y2="55" stroke="#FFB347" stroke-width="0.7" stroke-opacity="0.6" stroke-linecap="square" style="animation:voa-boom-zap 7s step-end infinite 2.1s;"/>' +

    '</svg>'
  );

  function initBoomSignature(container, metadata) {
    var folder = (container.getAttribute("data-folder") || "misc").trim();
    var name   = (container.getAttribute("data-name")   || "Matty BoomBoom").trim();
    var photos = buildPhotoList(metadata, folder, "");
    if (photos.length === 0) return;

    injectBoomSignatureStyles();

    var deck = shuffle(photos);
    var idx  = 0;
    var loadAttempts = 0;

    var rule = document.createElement("hr");
    rule.className = "voa-boom-rule";

    var block = document.createElement("div");
    block.className = "voa-boom-block";
    block.title = "Click to cycle photos";

    var frame = document.createElement("div");
    frame.className = "voa-boom-frame";

    var imgWrap = document.createElement("div");
    imgWrap.className = "voa-boom-img-wrap";

    var img = document.createElement("img");
    img.className = "voa-boom-photo";
    img.loading = "lazy";

    var svgWrap = document.createElement("div");
    svgWrap.innerHTML = BOOM_SVG_FRAME;

    imgWrap.appendChild(img);
    imgWrap.appendChild(svgWrap.firstChild);
    frame.appendChild(imgWrap);

    var nameEl = document.createElement("p");
    nameEl.className = "voa-boom-name";
    nameEl.textContent = name;
    nameEl.style.display = name ? "" : "none";

    var cap = document.createElement("p");
    cap.className = "voa-boom-caption";

    var hint = document.createElement("p");
    hint.className = "voa-boom-hint";
    hint.textContent = "\u26a1 click to cycle \u26a1";

    function render(photo) {
      img.alt = photo.caption || name || "";
      img.src = photo.url;
      cap.textContent = photo.caption || "";
      cap.style.display = photo.caption ? "" : "none";
    }

    img.onerror = function () {
      loadAttempts++;
      if (loadAttempts >= deck.length) {
        rule.style.display = "none";
        block.style.display = "none";
        return;
      }
      idx = (idx + 1) % deck.length;
      render(deck[idx]);
    };

    render(deck[idx]);
    block.appendChild(frame);
    block.appendChild(nameEl);
    block.appendChild(cap);

    block.addEventListener("click", function () {
      img.style.opacity = "0";
      setTimeout(function () {
        loadAttempts = 0;
        idx = (idx + 1) % deck.length;
        render(deck[idx]);
        img.style.opacity = "1";
      }, 280);
    });

    container.appendChild(rule);
    container.appendChild(block);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    var containers = document.querySelectorAll(".voa-photo-rotator");
    if (!containers.length) return;

    var hasDefault = false;
    containers.forEach(function (c) {
      var mode = (c.getAttribute("data-mode") || "").trim();
      if (mode !== "signature" && mode !== "boom-signature") hasDefault = true;
    });
    if (hasDefault) injectStyles();

    fetch(METADATA_URL)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (metadata) {
        containers.forEach(function (c) {
          var mode = (c.getAttribute("data-mode") || "").trim();
          if (mode === "signature") {
            initSignature(c, metadata);
          } else if (mode === "boom-signature") {
            initBoomSignature(c, metadata);
          } else {
            initDefault(c, metadata);
          }
        });
      })
      .catch(function (err) {
        if (typeof console !== "undefined") {
          console.debug("[photo-rotator] metadata not loaded:", err);
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
