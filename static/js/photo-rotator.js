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
 *   data-mode    — "signature" for a compact float-right post signature block;
 *                  omit for the default full-width rotating display
 *
 * Reads /personal-photos/photo-metadata.json.
 * Shows nothing if folder is empty or metadata fetch fails.
 *
 * photo-metadata.json format:
 *   {
 *     "matt": {
 *       "filename.jpg": { "caption": "...", "year": 2021, "tags": ["personal"] },
 *       ...
 *     },
 *     "jewelry": { ... },
 *     "misc": { ... },
 *     "forest": { ... }
 *   }
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
      // forest images live in /personal-photos/forest/; all others in /personal-photos/<folder>/
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

  // ── Signature mode ───────────────────────────────────────────────────────
  // Full-width centered author block. Rectangular portrait photo (3:4, max
  // 280px) with an SVG vine-root-circuitry ornamental frame, golden glow
  // box-shadow, Lora italic caption in gold, name in small-caps, and a teal
  // ✦ click to cycle ✦ hint. Sits below a thin hr rule.
  function injectSignatureStyles() {
    if (document.getElementById("voa-sig-css")) return;
    var el = document.createElement("style");
    el.id = "voa-sig-css";
    el.textContent = [
      "@keyframes voa-sig-pulse{0%,100%{opacity:0.6}50%{opacity:1}}",
      ".voa-sig-rule{border:none;border-top:1px solid rgba(212,175,55,0.18);margin:2.5rem 0 1.75rem;}",
      ".voa-sig-block{display:block;width:100%;text-align:center;cursor:pointer;user-select:none;padding-bottom:1rem;}",
      ".voa-sig-frame{position:relative;display:inline-block;max-width:280px;width:100%;}",
      ".voa-sig-photo{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:8px;box-shadow:0 0 28px rgba(212,175,55,0.2),0 0 6px rgba(212,175,55,0.1);transition:opacity 0.3s ease;}",
      ".voa-sig-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;}",
      ".voa-sig-svg g{animation:voa-sig-pulse 5s ease-in-out infinite;}",
      ".voa-sig-name{font-family:'Lora',Georgia,serif;font-variant:small-caps;font-size:0.95rem;letter-spacing:0.14em;color:rgba(212,175,55,0.65);margin:0.9rem 0 0.35rem;}",
      ".voa-sig-caption{font-family:'Lora',Georgia,serif;font-style:italic;font-size:0.97rem;line-height:1.7;color:rgba(212,175,55,0.75);max-width:480px;margin:0 auto 0.6rem;min-height:1.4em;}",
      ".voa-sig-hint{font-size:0.58rem;letter-spacing:0.13em;color:#7EB8B0;opacity:0.65;}"
    ].join("\n");
    document.head.appendChild(el);
  }

  // SVG ornamental frame: vine-root-circuitry corner + mid-edge ornaments.
  // viewBox 0 0 100 133 matches the 3:4 portrait aspect ratio.
  // overflow="visible" lets corner nodes bleed slightly outside the image.
  var SIG_SVG_FRAME = '<svg class="voa-sig-svg" viewBox="0 0 100 133" xmlns="http://www.w3.org/2000/svg" overflow="visible" aria-hidden="true">' +
    '<g fill="none" stroke="#D4AF37" stroke-linecap="round" stroke-linejoin="round">' +

    // ── TOP-LEFT ──
    '<path stroke-width="0.9" stroke-opacity="0.62" d="M 0,27 L 0,6 Q 0,0 6,0 L 27,0"/>' +
    '<circle cx="0" cy="0" r="2.8" fill="#D4AF37" fill-opacity="0.55" stroke="none"/>' +
    '<circle cx="0" cy="13" r="1.4" fill="#D4AF37" fill-opacity="0.5" stroke="none"/>' +
    '<circle cx="13" cy="0" r="1.4" fill="#D4AF37" fill-opacity="0.5" stroke="none"/>' +
    '<path stroke-width="0.65" stroke-opacity="0.42" d="M 0,13 Q 5,10 8,15 Q 11,20 6,23"/>' +
    '<path stroke-width="0.65" stroke-opacity="0.42" d="M 13,0 Q 10,5 15,8 Q 20,11 23,6"/>' +
    '<circle cx="6" cy="23" r="1" fill="#D4AF37" fill-opacity="0.38" stroke="none"/>' +
    '<circle cx="23" cy="6" r="1" fill="#D4AF37" fill-opacity="0.38" stroke="none"/>' +

    // ── TOP-RIGHT ──
    '<path stroke-width="0.9" stroke-opacity="0.62" d="M 100,27 L 100,6 Q 100,0 94,0 L 73,0"/>' +
    '<circle cx="100" cy="0" r="2.8" fill="#D4AF37" fill-opacity="0.55" stroke="none"/>' +
    '<circle cx="100" cy="13" r="1.4" fill="#D4AF37" fill-opacity="0.5" stroke="none"/>' +
    '<circle cx="87" cy="0" r="1.4" fill="#D4AF37" fill-opacity="0.5" stroke="none"/>' +
    '<path stroke-width="0.65" stroke-opacity="0.42" d="M 100,13 Q 95,10 92,15 Q 89,20 94,23"/>' +
    '<path stroke-width="0.65" stroke-opacity="0.42" d="M 87,0 Q 90,5 85,8 Q 80,11 77,6"/>' +
    '<circle cx="94" cy="23" r="1" fill="#D4AF37" fill-opacity="0.38" stroke="none"/>' +
    '<circle cx="77" cy="6" r="1" fill="#D4AF37" fill-opacity="0.38" stroke="none"/>' +

    // ── BOTTOM-LEFT ──
    '<path stroke-width="0.9" stroke-opacity="0.62" d="M 0,106 L 0,127 Q 0,133 6,133 L 27,133"/>' +
    '<circle cx="0" cy="133" r="2.8" fill="#D4AF37" fill-opacity="0.55" stroke="none"/>' +
    '<circle cx="0" cy="120" r="1.4" fill="#D4AF37" fill-opacity="0.5" stroke="none"/>' +
    '<circle cx="13" cy="133" r="1.4" fill="#D4AF37" fill-opacity="0.5" stroke="none"/>' +
    '<path stroke-width="0.65" stroke-opacity="0.42" d="M 0,120 Q 5,123 8,118 Q 11,113 6,110"/>' +
    '<path stroke-width="0.65" stroke-opacity="0.42" d="M 13,133 Q 10,128 15,125 Q 20,122 23,127"/>' +
    '<circle cx="6" cy="110" r="1" fill="#D4AF37" fill-opacity="0.38" stroke="none"/>' +
    '<circle cx="23" cy="127" r="1" fill="#D4AF37" fill-opacity="0.38" stroke="none"/>' +

    // ── BOTTOM-RIGHT ──
    '<path stroke-width="0.9" stroke-opacity="0.62" d="M 100,106 L 100,127 Q 100,133 94,133 L 73,133"/>' +
    '<circle cx="100" cy="133" r="2.8" fill="#D4AF37" fill-opacity="0.55" stroke="none"/>' +
    '<circle cx="100" cy="120" r="1.4" fill="#D4AF37" fill-opacity="0.5" stroke="none"/>' +
    '<circle cx="87" cy="133" r="1.4" fill="#D4AF37" fill-opacity="0.5" stroke="none"/>' +
    '<path stroke-width="0.65" stroke-opacity="0.42" d="M 100,120 Q 95,123 92,118 Q 89,113 94,110"/>' +
    '<path stroke-width="0.65" stroke-opacity="0.42" d="M 87,133 Q 90,128 85,125 Q 80,122 77,127"/>' +
    '<circle cx="94" cy="110" r="1" fill="#D4AF37" fill-opacity="0.38" stroke="none"/>' +
    '<circle cx="77" cy="127" r="1" fill="#D4AF37" fill-opacity="0.38" stroke="none"/>' +

    // ── MID-EDGE ORNAMENTS ──
    // Top center: dashes + diamond
    '<path stroke-width="0.7" stroke-opacity="0.38" d="M 40,0 L 46,0"/>' +
    '<path d="M 50,-2.5 L 52.5,0 L 50,2.5 L 47.5,0 Z" fill="#D4AF37" fill-opacity="0.32" stroke="none"/>' +
    '<path stroke-width="0.7" stroke-opacity="0.38" d="M 54,0 L 60,0"/>' +
    // Bottom center
    '<path stroke-width="0.7" stroke-opacity="0.38" d="M 40,133 L 46,133"/>' +
    '<path d="M 50,130.5 L 52.5,133 L 50,135.5 L 47.5,133 Z" fill="#D4AF37" fill-opacity="0.32" stroke="none"/>' +
    '<path stroke-width="0.7" stroke-opacity="0.38" d="M 54,133 L 60,133"/>' +
    // Left center
    '<path stroke-width="0.7" stroke-opacity="0.38" d="M 0,56 L 0,63"/>' +
    '<path d="M -2.5,66.5 L 0,69 L 2.5,66.5 L 0,64 Z" fill="#D4AF37" fill-opacity="0.32" stroke="none"/>' +
    '<path stroke-width="0.7" stroke-opacity="0.38" d="M 0,70 L 0,77"/>' +
    // Right center
    '<path stroke-width="0.7" stroke-opacity="0.38" d="M 100,56 L 100,63"/>' +
    '<path d="M 97.5,66.5 L 100,69 L 102.5,66.5 L 100,64 Z" fill="#D4AF37" fill-opacity="0.32" stroke="none"/>' +
    '<path stroke-width="0.7" stroke-opacity="0.38" d="M 100,70 L 100,77"/>' +

    '</g></svg>';

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

    // Frame wraps image + SVG ornament overlay
    var frame = document.createElement("div");
    frame.className = "voa-sig-frame";

    var img = document.createElement("img");
    img.className = "voa-sig-photo";
    img.loading = "lazy";

    // Inject SVG frame via innerHTML on a temp wrapper
    var svgWrap = document.createElement("div");
    svgWrap.innerHTML = SIG_SVG_FRAME;
    frame.appendChild(img);
    frame.appendChild(svgWrap.firstChild);

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

    // If an image 404s, silently cycle. If all fail, hide entirely.
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

    // Only inject default-mode styles if there are non-signature widgets
    var hasDefault = false;
    containers.forEach(function (c) {
      if ((c.getAttribute("data-mode") || "") !== "signature") hasDefault = true;
    });
    if (hasDefault) injectStyles();

    fetch(METADATA_URL)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (metadata) {
        containers.forEach(function (c) {
          var mode = (c.getAttribute("data-mode") || "").trim();
          if (mode === "signature") {
            initSignature(c, metadata);
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
