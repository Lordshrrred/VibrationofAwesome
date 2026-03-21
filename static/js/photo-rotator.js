/**
 * photo-rotator.js — VOA Random Photo Widget
 *
 * Usage:
 *   <div class="voa-photo-rotator" data-folder="matt" data-tag="outdoors"></div>
 *   <script src="/js/photo-rotator.js"></script>
 *
 * Attributes:
 *   data-folder  — key in photo-metadata.json ("matt", "jewelry", "forest")
 *   data-tag     — optional; filter photos by tag
 *
 * Reads /personal-photos/photo-metadata.json.
 * Shows nothing if folder is empty or metadata fetch fails.
 */
(function () {
  "use strict";

  var METADATA_URL = "/personal-photos/photo-metadata.json";
  var BASE_URL     = "/personal-photos/";

  var css = [
    ".voa-rotator-wrap{position:relative;width:100%;max-width:560px;margin:0 auto;text-align:center;cursor:pointer;user-select:none;}",
    ".voa-rotator-img-wrap{position:relative;overflow:hidden;border-radius:6px;background:#0a1a14;min-height:180px;display:flex;align-items:center;justify-content:center;}",
    ".voa-rotator-img{display:block;width:100%;height:auto;max-height:420px;object-fit:cover;border-radius:6px;transition:opacity 0.5s ease;}",
    ".voa-rotator-img.fade-out{opacity:0;}",
    ".voa-rotator-caption{margin-top:0.65rem;font-family:'Lora',Georgia,serif;font-size:0.9rem;font-style:italic;color:rgba(208,255,248,0.6);line-height:1.5;min-height:1.3em;}",
    ".voa-rotator-hint{margin-top:0.35rem;font-size:0.7rem;letter-spacing:0.08em;color:rgba(208,255,248,0.25);text-transform:uppercase;}",
    ".voa-rotator-placeholder{width:100%;height:200px;background:linear-gradient(135deg,#0d2a1e 0%,#020a0a 100%);border-radius:6px;}"
  ].join("\n");

  function injectStyles() {
    if (document.getElementById("voa-rotator-css")) return;
    var el = document.createElement("style");
    el.id = "voa-rotator-css";
    el.textContent = css;
    document.head.appendChild(el);
  }

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
      // Determine URL path based on folder
      var urlPath = folder === "forest"
        ? BASE_URL + "forest/" + filename
        : BASE_URL + folder + "/" + filename;
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

  function initRotator(container, metadata) {
    var folder  = container.getAttribute("data-folder") || "matt";
    var tag     = container.getAttribute("data-tag")    || "";

    var photos  = buildPhotoList(metadata, folder, tag);
    if (photos.length === 0) return; // nothing to show — fail silently

    var shuffled = shuffle(photos);
    var index    = 0;

    // Build DOM
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
      img.src  = p.url;
      img.alt  = p.caption || "";
    }

    function next() {
      img.classList.add("fade-out");
      setTimeout(function () {
        index = (index + 1) % shuffled.length;
        showPhoto(shuffled[index]);
        img.classList.remove("fade-out");
      }, 480);
    }

    showPhoto(shuffled[index]);

    wrap.addEventListener("click", next);
  }

  function init() {
    injectStyles();
    var containers = document.querySelectorAll(".voa-photo-rotator");
    if (!containers.length) return;

    fetch(METADATA_URL)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (metadata) {
        containers.forEach(function (c) { initRotator(c, metadata); });
      })
      .catch(function (err) {
        // Fail silently — no metadata, no widget
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
