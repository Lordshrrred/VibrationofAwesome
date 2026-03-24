/**
 * photo-rotator.js — VOA Random Photo Widget
 *
 * Usage:
 *   <div class="voa-photo-rotator" data-folder="matt" data-tag="outdoors"></div>
 *   <script src="/js/photo-rotator.js"></script>
 *
 * Attributes:
 *   data-folder  — key in photo-metadata.json ("matt", "jewelry", "forest", "misc")
 *   data-tag     — optional; filter photos by tag
 *   data-mode    — "signature" for Forest Temple author block (matt lane)
 *                  "boom-signature" for Boom Frequency author block (boom lane)
 *                  omit for the default full-width rotating display
 *   data-name    — override display name under photo (signature/boom-signature modes)
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
  // 4:3 landscape rectangle, fixed via padding-bottom:75% container trick so
  // portrait/square source images never distort the frame shape.
  // Sacred geometry SVG floats OUTSIDE the image border, forest green (#2D5A3D),
  // subtly orbiting / pulsing. Lora italic caption. Teal hint text.

  function injectSignatureStyles() {
    if (document.getElementById("voa-sig-css")) return;
    var el = document.createElement("style");
    el.id = "voa-sig-css";
    el.textContent = [
      // Keyframes
      "@keyframes voa-geo-pulse{0%,100%{opacity:0.45}50%{opacity:0.9}}",
      "@keyframes voa-geo-floatN{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}",
      "@keyframes voa-geo-floatS{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}",
      "@keyframes voa-geo-floatW{0%,100%{transform:translateX(0)}50%{transform:translateX(-4px)}}",
      "@keyframes voa-geo-floatE{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}",
      "@keyframes voa-geo-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
      "@keyframes voa-geo-travel{from{stroke-dashoffset:0}to{stroke-dashoffset:-382}}",
      // Layout
      ".voa-sig-rule{border:none;border-top:1px solid rgba(45,90,61,0.25);margin:2.5rem 0 1.75rem;}",
      ".voa-sig-block{display:block;width:100%;text-align:center;cursor:pointer;user-select:none;padding-bottom:1rem;}",
      // Frame wrapper: max-width, inline-block, relative for SVG overlay
      ".voa-sig-frame{position:relative;display:inline-block;max-width:280px;width:100%;}",
      // Image wrapper: padding-bottom 75% = 4:3 landscape, ALWAYS
      ".voa-sig-img-wrap{position:relative;width:100%;padding-bottom:75%;overflow:hidden;border-radius:8px;box-shadow:0 0 32px rgba(45,90,61,0.35),0 0 8px rgba(45,90,61,0.2);}",
      ".voa-sig-photo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:8px;transition:opacity 0.3s ease;}",
      // SVG overlay (inset on img-wrap, overflow:visible for outside elements)
      ".voa-sig-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;}",
      // Text elements
      ".voa-sig-name{font-family:'Lora',Georgia,serif;font-variant:small-caps;font-size:0.95rem;letter-spacing:0.14em;color:rgba(45,90,61,0.85);margin:0.9rem 0 0.35rem;}",
      ".voa-sig-caption{font-family:'Lora',Georgia,serif;font-style:italic;font-size:0.97rem;line-height:1.7;color:rgba(45,90,61,0.9);max-width:480px;margin:0 auto 0.6rem;min-height:1.4em;}",
      ".voa-sig-hint{font-size:0.58rem;letter-spacing:0.13em;color:#7EB8B0;opacity:0.65;}"
    ].join("\n");
    document.head.appendChild(el);
  }

  // Sacred geometry SVG frame for Forest Temple.
  // viewBox="0 0 100 75" (4:3). All ornaments are placed OUTSIDE 0,0–100,75
  // using overflow:visible. Four layers:
  //   1. Outer perimeter dashed line with traveling-light animation
  //   2. Corner bracket marks + circle nodes at extreme corners
  //   3. Mid-edge diamonds that float away from the image
  //   4. Slow-spinning ring of sacred-geometry micro-nodes (6 outer satellites)
  var SIG_SVG_FRAME = (
    '<svg class="voa-sig-svg" viewBox="0 0 100 75" xmlns="http://www.w3.org/2000/svg" overflow="visible" aria-hidden="true">' +

    // ── Layer 1: Traveling perimeter line ───────────────────────────────────
    // Rect slightly outside image: -5,-5 to 105,80 (perimeter ~380 units)
    '<rect x="-5" y="-5" width="110" height="85" rx="2" ry="2"' +
    '  fill="none" stroke="#2D5A3D" stroke-width="0.6" stroke-opacity="0.5"' +
    '  stroke-dasharray="6 10"' +
    '  style="animation:voa-geo-travel 18s linear infinite;"/>' +

    // ── Layer 2: Corner brackets + corner circle nodes ───────────────────────
    // Top-left bracket
    '<path d="M0,16 L0,0 L16,0" fill="none" stroke="#2D5A3D" stroke-width="1.1" stroke-opacity="0.7" stroke-linecap="round"/>' +
    '<circle cx="0" cy="0" r="2.5" fill="#2D5A3D" fill-opacity="0.7" style="animation:voa-geo-pulse 4s ease-in-out infinite;"/>' +
    // Top-right bracket
    '<path d="M100,16 L100,0 L84,0" fill="none" stroke="#2D5A3D" stroke-width="1.1" stroke-opacity="0.7" stroke-linecap="round"/>' +
    '<circle cx="100" cy="0" r="2.5" fill="#2D5A3D" fill-opacity="0.7" style="animation:voa-geo-pulse 4s ease-in-out infinite 0.5s;"/>' +
    // Bottom-left bracket
    '<path d="M0,59 L0,75 L16,75" fill="none" stroke="#2D5A3D" stroke-width="1.1" stroke-opacity="0.7" stroke-linecap="round"/>' +
    '<circle cx="0" cy="75" r="2.5" fill="#2D5A3D" fill-opacity="0.7" style="animation:voa-geo-pulse 4s ease-in-out infinite 1s;"/>' +
    // Bottom-right bracket
    '<path d="M100,59 L100,75 L84,75" fill="none" stroke="#2D5A3D" stroke-width="1.1" stroke-opacity="0.7" stroke-linecap="round"/>' +
    '<circle cx="100" cy="75" r="2.5" fill="#2D5A3D" fill-opacity="0.7" style="animation:voa-geo-pulse 4s ease-in-out infinite 1.5s;"/>' +

    // ── Layer 3: Mid-edge diamond markers, floating outward ──────────────────
    // Top center diamond — floats up
    '<g style="animation:voa-geo-floatN 5s ease-in-out infinite;">' +
    '<path d="M50,-9 L53,-6 L50,-3 L47,-6 Z" fill="#2D5A3D" fill-opacity="0.55" stroke="#2D5A3D" stroke-width="0.4" stroke-opacity="0.6"/>' +
    '<line x1="50" y1="-3" x2="50" y2="0" stroke="#2D5A3D" stroke-width="0.5" stroke-opacity="0.4"/>' +
    '</g>' +
    // Bottom center diamond — floats down
    '<g style="animation:voa-geo-floatS 5s ease-in-out infinite 0.8s;">' +
    '<path d="M50,84 L53,81 L50,78 L47,81 Z" fill="#2D5A3D" fill-opacity="0.55" stroke="#2D5A3D" stroke-width="0.4" stroke-opacity="0.6"/>' +
    '<line x1="50" y1="75" x2="50" y2="78" stroke="#2D5A3D" stroke-width="0.5" stroke-opacity="0.4"/>' +
    '</g>' +
    // Left center diamond — floats left
    '<g style="animation:voa-geo-floatW 5.5s ease-in-out infinite 0.3s;">' +
    '<path d="M-10,37.5 L-7,34.5 L-4,37.5 L-7,40.5 Z" fill="#2D5A3D" fill-opacity="0.55" stroke="#2D5A3D" stroke-width="0.4" stroke-opacity="0.6"/>' +
    '<line x1="-4" y1="37.5" x2="0" y2="37.5" stroke="#2D5A3D" stroke-width="0.5" stroke-opacity="0.4"/>' +
    '</g>' +
    // Right center diamond — floats right
    '<g style="animation:voa-geo-floatE 5.5s ease-in-out infinite 1.1s;">' +
    '<path d="M110,37.5 L107,34.5 L104,37.5 L107,40.5 Z" fill="#2D5A3D" fill-opacity="0.55" stroke="#2D5A3D" stroke-width="0.4" stroke-opacity="0.6"/>' +
    '<line x1="100" y1="37.5" x2="104" y2="37.5" stroke="#2D5A3D" stroke-width="0.5" stroke-opacity="0.4"/>' +
    '</g>' +

    // ── Layer 4: Slow-spinning sacred ring of 6 micro-nodes ─────────────────
    // These rotate around the image center (50,37.5) — placed at radius 60
    // from center, equally spaced (60° apart).  The <g> rotates with CSS.
    '<g style="transform-origin:50px 37.5px;animation:voa-geo-spin 60s linear infinite;opacity:0.5;">' +
    // Node 0° (top): center + r*sin(0), center - r*cos(0) → (50, -22.5)
    '<circle cx="50" cy="-22.5" r="1.4" fill="#2D5A3D"/>' +
    '<circle cx="50" cy="-22.5" r="3" fill="none" stroke="#2D5A3D" stroke-width="0.4"/>' +
    // Node 60°: (50 + 60*sin60, 37.5 - 60*cos60) = (50+51.96, 37.5-30) = (101.96, 7.5)
    '<circle cx="102" cy="7.5" r="1.1" fill="#2D5A3D"/>' +
    // Node 120°: (50 + 60*sin120, 37.5 - 60*cos120) = (50+51.96, 37.5+30) = (101.96, 67.5)
    '<circle cx="102" cy="67.5" r="1.1" fill="#2D5A3D"/>' +
    // Node 180° (bottom): (50, 97.5)
    '<circle cx="50" cy="97.5" r="1.4" fill="#2D5A3D"/>' +
    '<circle cx="50" cy="97.5" r="3" fill="none" stroke="#2D5A3D" stroke-width="0.4"/>' +
    // Node 240°: (50-51.96, 67.5) = (-1.96, 67.5)
    '<circle cx="-2" cy="67.5" r="1.1" fill="#2D5A3D"/>' +
    // Node 300°: (50-51.96, 7.5) = (-1.96, 7.5)
    '<circle cx="-2" cy="7.5" r="1.1" fill="#2D5A3D"/>' +
    // Thin lines connecting opposite nodes (hexagram)
    '<line x1="50" y1="-22.5" x2="50" y2="97.5" stroke="#2D5A3D" stroke-width="0.3" stroke-opacity="0.35"/>' +
    '<line x1="102" y1="7.5" x2="-2" y2="67.5" stroke="#2D5A3D" stroke-width="0.3" stroke-opacity="0.35"/>' +
    '<line x1="102" y1="67.5" x2="-2" y2="7.5" stroke="#2D5A3D" stroke-width="0.3" stroke-opacity="0.35"/>' +
    '</g>' +

    '</svg>'
  );

  function initSignature(container, metadata) {
    var folder = (container.getAttribute("data-folder") || "matt").trim();
    var name   = (container.getAttribute("data-name")   || (folder === "matt" ? "Matt EarthStar" : "")).trim();
    var photos = buildPhotoList(metadata, folder, "");
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

    // .voa-sig-img-wrap: the 4:3 padding-bottom container (shape is always 4:3)
    var imgWrap = document.createElement("div");
    imgWrap.className = "voa-sig-img-wrap";

    var img = document.createElement("img");
    img.className = "voa-sig-photo";
    img.loading = "lazy";

    // Inject SVG frame via innerHTML on a temp wrapper
    var svgWrap = document.createElement("div");
    svgWrap.innerHTML = SIG_SVG_FRAME;

    imgWrap.appendChild(img);
    imgWrap.appendChild(svgWrap.firstChild);
    frame.appendChild(imgWrap);

    var nameEl = document.createElement("p");
    nameEl.className = "voa-sig-name";
    nameEl.textContent = name;
    nameEl.style.display = name ? "" : "none";

    var cap = document.createElement("p");
    cap.className = "voa-sig-caption";

    var hint = document.createElement("p");
    hint.className = "voa-sig-hint";
    hint.textContent = "\u2736 click to cycle \u2736";

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
    block.appendChild(hint);

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
  // geometry — sharp triangles and lightning lines feel, less organic curves.
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
    // Top center — sharp upward triangle
    '<polygon points="50,-12 54,-5 46,-5" fill="#FFB347" fill-opacity="0.5" style="animation:voa-boom-pulse 3s ease-in-out infinite;"/>' +
    '<line x1="50" y1="-5" x2="50" y2="0" stroke="#FFB347" stroke-width="0.6" stroke-opacity="0.5"/>' +
    // Bottom center — sharp downward triangle
    '<polygon points="50,87 54,80 46,80" fill="#FFB347" fill-opacity="0.5" style="animation:voa-boom-pulse 3s ease-in-out infinite 0.75s;"/>' +
    '<line x1="50" y1="75" x2="50" y2="80" stroke="#FFB347" stroke-width="0.6" stroke-opacity="0.5"/>' +
    // Left center — leftward triangle
    '<polygon points="-12,37.5 -5,33.5 -5,41.5" fill="#FFB347" fill-opacity="0.5" style="animation:voa-boom-pulse 3s ease-in-out infinite 0.4s;"/>' +
    '<line x1="0" y1="37.5" x2="-5" y2="37.5" stroke="#FFB347" stroke-width="0.6" stroke-opacity="0.5"/>' +
    // Right center — rightward triangle
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
    block.appendChild(hint);

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
