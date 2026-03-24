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
  // Full-width centered author block with circular photo, name in small caps,
  // italic caption, and a subtle click-to-cycle hint. Sits below a thin hr.
  // Click cycles through photos. Renders nothing if folder is empty.
  function injectSignatureStyles() {
    if (document.getElementById("voa-sig-css")) return;
    var el = document.createElement("style");
    el.id = "voa-sig-css";
    el.textContent = [
      ".voa-sig-rule{border:none;border-top:1px solid rgba(212,175,55,0.2);margin:2.5rem 0 1.75rem;}",
      ".voa-sig-block{display:block;width:100%;text-align:center;cursor:pointer;user-select:none;padding-bottom:1rem;}",
      ".voa-sig-photo{display:block;width:160px;height:160px;object-fit:cover;border-radius:50%;border:2px solid rgba(212,175,55,0.4);margin:0 auto 0.75rem;transition:opacity 0.3s ease;}",
      ".voa-sig-name{font-family:'Lora',Georgia,serif;font-variant:small-caps;font-size:1rem;letter-spacing:0.12em;color:rgba(208,255,248,0.65);margin-bottom:0.45rem;}",
      ".voa-sig-caption{font-family:'Lora',Georgia,serif;font-style:italic;font-size:0.88rem;line-height:1.65;color:rgba(208,255,248,0.42);max-width:480px;margin:0 auto 0.6rem;min-height:1.3em;}",
      ".voa-sig-hint{font-size:0.62rem;letter-spacing:0.1em;color:rgba(208,255,248,0.18);}"
    ].join("\n");
    document.head.appendChild(el);
  }

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

    var img = document.createElement("img");
    img.className = "voa-sig-photo";
    img.loading = "lazy";

    var nameEl = document.createElement("p");
    nameEl.className = "voa-sig-name";
    nameEl.textContent = name;
    nameEl.style.display = name ? "" : "none";

    var cap = document.createElement("p");
    cap.className = "voa-sig-caption";

    var hint = document.createElement("p");
    hint.className = "voa-sig-hint";
    hint.textContent = "\u2014 click to cycle \u2014";

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
    block.appendChild(img);
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
