(function () {
  const GITHUB_API = "https://api.github.com/repos/Lordshrrred/VibrationofAwesome";
  const GITHUB_BRANCH = "main";
  const MATT_POST_PREFIX = "static/blog/matt/posts/";
  const RAW_BASE = "https://raw.githubusercontent.com/Lordshrrred/VibrationofAwesome/main/";
  const SESSION_KEY = "voa_post_studio_auth";
  const AUTOSAVE_PREFIX = "voa_forest_temple_autosave:";

  const state = {
    token: "",
    posts: [],
    filteredPosts: [],
    currentPost: null,
    initialSnapshot: "",
    editor: null,
  };

  const els = {
    gate: document.getElementById("gate"),
    gateForm: document.getElementById("gate-form"),
    gatePassword: document.getElementById("gate-password"),
    gateError: document.getElementById("gate-error"),
    app: document.getElementById("app"),
    postList: document.getElementById("post-list"),
    postSearch: document.getElementById("post-search"),
    entryHeading: document.getElementById("entry-heading"),
    entryStatus: document.getElementById("entry-status"),
    authStatus: document.getElementById("auth-status"),
    saveChip: document.getElementById("save-chip"),
    saveBannerTitle: document.getElementById("save-banner-title"),
    saveBannerCopy: document.getElementById("save-banner-copy"),
    previewLink: document.getElementById("preview-link"),
    githubLink: document.getElementById("github-link"),
    downloadButton: document.getElementById("download-button"),
    saveButton: document.getElementById("save-button"),
    saveButtonSticky: document.getElementById("save-button-sticky"),
    resetButton: document.getElementById("reset-button"),
    lockButton: document.getElementById("lock-button"),
    statTotal: document.getElementById("stat-total"),
    statDrafts: document.getElementById("stat-drafts"),
    title: document.getElementById("field-title"),
    slug: document.getElementById("field-slug"),
    date: document.getElementById("field-date"),
    description: document.getElementById("field-description"),
    thumbnail: document.getElementById("field-thumbnail"),
    canonical: document.getElementById("field-canonical"),
    tags: document.getElementById("field-tags"),
    draft: document.getElementById("field-draft"),
    path: document.getElementById("field-path"),
    preview: document.getElementById("field-preview"),
    notes: document.getElementById("field-notes"),
    snapshotTitle: document.getElementById("snapshot-title"),
    snapshotStatus: document.getElementById("snapshot-status"),
    snapshotDescription: document.getElementById("snapshot-description"),
  };

  function drawStars() {
    const canvas = document.getElementById("stars-canvas");
    const ctx = canvas.getContext("2d");
    let stars = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = Array.from({ length: 120 }, function () {
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.4 + 0.2,
          a: Math.random() * 0.6 + 0.1,
          s: Math.random() * 0.18 + 0.03,
        };
      });
    }

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255," + star.a + ")";
        ctx.fill();
        star.y += star.s;
        if (star.y > canvas.height) {
          star.y = -4;
          star.x = Math.random() * canvas.width;
        }
      }
      window.requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize);
    resize();
    tick();
  }

  function initEditor() {
    state.editor = new toastui.Editor({
      el: document.getElementById("editor"),
      height: "760px",
      initialEditType: "wysiwyg",
      previewStyle: "vertical",
      usageStatistics: false,
      hideModeSwitch: false,
      initialValue: "<p>Select a Forest Temple post to begin editing.</p>",
    });

    state.editor.on("change", function () {
      refreshDirtyState();
      writeAutosave();
    });
  }

  async function githubRequest(path, options, token) {
    const requestOptions = options || {};
    const headers = Object.assign({
      Accept: "application/vnd.github+json",
    }, requestOptions.headers || {});

    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    const response = await fetch(GITHUB_API + path, Object.assign({}, requestOptions, { headers }));
    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(data.message || "GitHub request failed");
    }

    return data;
  }

  function friendlyGithubError(error) {
    const message = error && error.message ? error.message : "GitHub request failed";
    if (/resource not accessible by personal access token/i.test(message)) {
      return "This GitHub token can see the repo but cannot write to it. Create a token for the account that has write access to Lordshrrred/VibrationofAwesome and give it Contents: Read and write.";
    }
    if (/bad credentials/i.test(message)) {
      return "GitHub rejected this token. Paste a valid personal access token and try again.";
    }
    return message;
  }

  async function validateTokenForStudio(token) {
    const repo = await githubRequest("", {}, token);
    const permissions = repo.permissions || {};
    const canPush = !!(permissions.admin || permissions.maintain || permissions.push);

    if (!canPush) {
      throw new Error("This token is connected, but the GitHub account behind it does not have write access to Lordshrrred/VibrationofAwesome.");
    }

    await githubRequest("/contents/static/blog/matt/index.html?ref=" + encodeURIComponent(GITHUB_BRANCH), {}, token);
    return repo;
  }

  async function fetchText(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load " + url);
    }
    return response.text();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function decodeBase64Unicode(base64) {
    return decodeURIComponent(escape(atob(base64.replace(/\n/g, ""))));
  }

  function encodeBase64Unicode(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function previewUrlForPath(path) {
    const relative = path.replace(/^static/, "");
    if (relative.endsWith("/index.html")) {
      return relative.slice(0, -10) + "/";
    }
    return relative;
  }

  function slugFromPath(path) {
    let slug = path.replace(MATT_POST_PREFIX, "");
    if (slug.endsWith("/index.html")) {
      slug = slug.slice(0, -11);
    } else if (slug.endsWith(".html")) {
      slug = slug.slice(0, -5);
    }
    return "/" + slug.replace(/^\/+/, "");
  }

  function pathFromSlug(slug) {
    const clean = String(slug || "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    if (!clean) return "";
    if (clean.endsWith(".html")) {
      return MATT_POST_PREFIX + clean;
    }
    return MATT_POST_PREFIX + clean + "/index.html";
  }

  function formatDate(dateString) {
    if (!dateString) return "No date";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function toDatetimeLocal(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    const pad = function (value) { return String(value).padStart(2, "0"); };
    return (
      date.getFullYear() + "-" +
      pad(date.getMonth() + 1) + "-" +
      pad(date.getDate()) + "T" +
      pad(date.getHours()) + ":" +
      pad(date.getMinutes())
    );
  }

  function readJsonLd(doc) {
    const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    for (const node of scripts) {
      try {
        const parsed = JSON.parse(node.textContent);
        if (parsed && (parsed["@type"] === "BlogPosting" || parsed["@type"] === "Article")) {
          return { node: node, data: parsed };
        }
      } catch (_) {}
    }
    return { node: null, data: null };
  }

  function extractHeroImage(doc) {
    const hero = doc.querySelector(".post-hero");
    const style = hero ? hero.getAttribute("style") || hero.style.background || "" : "";
    const html = hero ? hero.outerHTML : "";
    const match = (style || html).match(/url\((['"]?)(.*?)\1\)/);
    return match ? match[2] : "";
  }

  function splitEditableBody(doc) {
    const bodyContainer = doc.querySelector(".post-body");
    if (!bodyContainer) {
      return { editableHtml: "", lockedTailHtml: "" };
    }

    const working = bodyContainer.cloneNode(true);
    const divider = working.querySelector(".post-divider");
    if (divider) {
      divider.remove();
    }

    const lockedAnchor =
      findLockedTailAnchor(working) ||
      working.querySelector(".voa-photo-rotator, [data-ebook-cta], footer");

    let lockedTailHtml = "";
    if (lockedAnchor) {
      let node = lockedAnchor;
      while (node) {
        const next = node.nextSibling;
        lockedTailHtml += node.outerHTML || node.textContent || "";
        node.remove();
        node = next;
      }
    }

    return {
      editableHtml: working.innerHTML.trim(),
      lockedTailHtml: lockedTailHtml.trim(),
    };
  }

  function findLockedTailAnchor(bodyContainer) {
    const firstWidget = bodyContainer.querySelector(".voa-photo-rotator, [data-ebook-cta], footer");
    if (!firstWidget) return null;

    let anchor = firstWidget;
    let node = firstWidget.previousSibling;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "HR") {
        anchor = node;
        break;
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.textContent.trim()) {
        anchor = node;
      }
      node = node.previousSibling;
    }

    return anchor;
  }

  function detectArchive(doc) {
    return !!doc.querySelector(".archive-badge") || /Archive/i.test(doc.body.innerHTML);
  }

  function parseMattPost(path, content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const jsonLd = readJsonLd(doc).data || {};
    const title =
      (doc.querySelector(".post-title") && doc.querySelector(".post-title").textContent.trim()) ||
      jsonLd.headline ||
      doc.title.replace(/\s+\|.*$/, "").trim();
    const description =
      (doc.querySelector('meta[name="description"]') && doc.querySelector('meta[name="description"]').getAttribute("content")) ||
      jsonLd.description ||
      "";
    const canonical =
      (doc.querySelector('link[rel="canonical"]') && doc.querySelector('link[rel="canonical"]').getAttribute("href")) ||
      "";
    const robots =
      (doc.querySelector('meta[name="robots"]') && doc.querySelector('meta[name="robots"]').getAttribute("content")) ||
      "index, follow";
    const datePublished = jsonLd.datePublished || "";

    const bodyParts = splitEditableBody(doc);

    return {
      path: path,
      slug: slugFromPath(path),
      previewUrl: previewUrlForPath(path),
      title: title,
      description: description,
      canonical: canonical,
      robots: robots,
      noindex: /noindex/i.test(robots),
      date: datePublished,
      heroImage: extractHeroImage(doc),
      bodyHtml: bodyParts.editableHtml,
      lockedTailHtml: bodyParts.lockedTailHtml,
      isArchive: detectArchive(doc),
      originalHtml: content,
    };
  }

  function extractMattPathsFromIndex(indexHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(indexHtml, "text/html");
    const links = Array.from(doc.querySelectorAll('.post-title a'));
    const seen = new Set();
    const paths = [];

    for (const link of links) {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("/blog/matt/posts/")) continue;
      const relative = href.replace(/^\/+/, "");
      const path = relative.endsWith(".html")
        ? "static/" + relative
        : "static/" + relative.replace(/\/+$/, "") + "/index.html";
      if (seen.has(path)) continue;
      seen.add(path);
      paths.push(path);
    }

    return paths;
  }

  function currentSnapshot() {
    return JSON.stringify({
      title: els.title.value.trim(),
      slug: els.slug.value.trim(),
      date: els.date.value,
      description: els.description.value.trim(),
      heroImage: els.thumbnail.value.trim(),
      canonical: els.canonical.value.trim(),
      noindex: !!els.draft.checked,
      bodyHtml: state.editor.getHTML(),
      path: els.path.value.trim(),
    });
  }

  function setStatus(message, dirty) {
    els.entryStatus.textContent = message;
    els.entryStatus.style.color = dirty ? "var(--accent-warm)" : "var(--muted)";
  }

  function setSaveControls(options) {
    const config = options || {};
    const disabled = !!config.disabled;
    const label = config.label || "Save Live Edit";
    const chipText = config.chipText || "Locked";
    const chipState = config.chipState || "";

    [els.saveButton, els.saveButtonSticky].forEach(function (button) {
      button.disabled = disabled;
      button.textContent = label;
    });

    els.saveChip.textContent = chipText;
    els.saveChip.classList.toggle("ready", chipState === "ready");
    els.saveChip.classList.toggle("dirty", chipState === "dirty");
  }

  function autosaveKey() {
    return state.currentPost ? AUTOSAVE_PREFIX + state.currentPost.path : "";
  }

  function writeAutosave() {
    const key = autosaveKey();
    if (!key) return;
    try {
      localStorage.setItem(key, currentSnapshot());
    } catch (_) {}
  }

  function clearAutosave() {
    const key = autosaveKey();
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function refreshDirtyState() {
    if (!state.currentPost) {
      setStatus("Choose a live Matt post on the left to open its edit view.", false);
      els.saveBannerTitle.textContent = "No post selected yet";
      els.saveBannerCopy.textContent = state.token
        ? "Pick a Matt post from the left to load it, then use Save Live Edit to write changes back to the live blog."
        : "Unlock the studio, open a Matt post, make your edits, then press Save Live Edit.";
      setSaveControls({
        disabled: true,
        label: "Save Live Edit",
        chipText: state.token ? "Ready" : "Locked",
        chipState: state.token ? "ready" : "",
      });
      return;
    }
    const dirty = currentSnapshot() !== state.initialSnapshot;
    setStatus(dirty ? "Unsaved changes are waiting. Press Save Live Edit when you're ready." : "All changes in sync with the loaded live post.", dirty);
    els.saveBannerTitle.textContent = dirty ? "Live edits are ready to submit" : "This post matches the current live version";
    els.saveBannerCopy.textContent = dirty
      ? "Your updates are local in this browser right now. Press Save Live Edit to push them to GitHub and update the live Matt post source."
      : "Make changes in the fields or WYSIWYG editor, then press Save Live Edit to update the real file behind this post.";
    setSaveControls({
      disabled: !state.token,
      label: dirty ? "Save Live Edit" : "Save Live Edit",
      chipText: dirty ? "Unsaved" : "Ready",
      chipState: dirty ? "dirty" : "ready",
    });
  }

  function updateLinks() {
    const preview = els.preview.value.trim();
    els.previewLink.href = preview ? "https://vibrationofawesome.com" + preview : "#";
    els.previewLink.classList.toggle("is-disabled", !preview);

    const githubPath = els.path.value.trim();
    els.githubLink.href = githubPath ? "https://github.com/Lordshrrred/VibrationofAwesome/edit/" + GITHUB_BRANCH + "/" + githubPath : "#";
    els.githubLink.classList.toggle("is-disabled", !githubPath);
  }

  function updateSnapshot(post) {
    els.snapshotTitle.textContent = post ? (post.title || "Untitled") : "None selected";
    els.snapshotStatus.textContent = post ? (post.isArchive ? "Archive Post" : "Live Post") : "Waiting";
    els.snapshotDescription.textContent = post ? (post.description || "No description set yet.") : "Pick a post from the list to load its live metadata.";
  }

  function fillForm(post) {
    state.currentPost = post;
    els.entryHeading.textContent = post.title || "Untitled Post";
    els.title.value = post.title || "";
    els.slug.value = post.previewUrl || "";
    els.date.value = toDatetimeLocal(post.date || "");
    els.description.value = post.description || "";
    els.thumbnail.value = post.heroImage || "";
    els.canonical.value = post.canonical || "";
    els.tags.value = post.robots || "index, follow";
    els.draft.checked = !!post.noindex;
    els.path.value = post.path || "";
    els.preview.value = post.previewUrl || "";
    els.notes.value = post.isArchive
      ? "Archive post. Expect legacy markup, older canonical patterns, and occasional embedded legacy widgets."
      : "Live Matt post. Safe for content and metadata tweaks.";

    state.editor.setHTML(post.bodyHtml || "<p></p>");
    state.initialSnapshot = currentSnapshot();
    els.authStatus.textContent = "Editing " + post.path;
    updateLinks();
    updateSnapshot(post);
    refreshDirtyState();
  }

  function renderPostList() {
    const query = els.postSearch.value.trim().toLowerCase();
    state.filteredPosts = state.posts.filter(function (post) {
      if (!query) return true;
      return post.title.toLowerCase().includes(query) || post.slug.toLowerCase().includes(query);
    });

    els.statTotal.textContent = String(state.posts.filter(function (post) { return !post.isArchive; }).length);
    els.statDrafts.textContent = String(state.posts.filter(function (post) { return post.isArchive; }).length);

    if (!state.filteredPosts.length) {
      els.postList.innerHTML = "<div class=\"post-item\"><h3>No Matt posts found</h3><p>Try a different search.</p></div>";
      els.saveBannerTitle.textContent = "No matching post in this view";
      els.saveBannerCopy.textContent = "Clear the search or try a different title or slug.";
      return;
    }

    els.postList.innerHTML = state.filteredPosts.map(function (post) {
      const active = state.currentPost && state.currentPost.path === post.path;
      return (
        "<article class=\"post-item" + (active ? " active" : "") + "\" data-path=\"" + escapeHtml(post.path) + "\">" +
          "<h3>" + escapeHtml(post.title) + "</h3>" +
          "<p>" + escapeHtml(post.description || post.previewUrl) + "</p>" +
          "<div class=\"post-item-meta\">" +
            "<a class=\"pill post-link\" href=\"" + escapeHtml("https://vibrationofawesome.com" + post.previewUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + escapeHtml(post.previewUrl) + "</a>" +
            "<span class=\"pill\">" + escapeHtml(formatDate(post.date)) + "</span>" +
            (post.isArchive ? "<span class=\"pill draft\">Archive</span>" : "<span class=\"pill\">Live</span>") +
          "</div>" +
        "</article>"
      );
    }).join("");

    Array.from(document.querySelectorAll(".post-item[data-path]")).forEach(function (node) {
      node.addEventListener("click", function () {
        const match = state.posts.find(function (post) {
          return post.path === node.getAttribute("data-path");
        });
        if (match) {
          fillForm(match);
        }
      });
    });

    Array.from(document.querySelectorAll(".post-link")).forEach(function (node) {
      node.addEventListener("click", function (event) {
        event.stopPropagation();
      });
    });
  }

  async function loadPosts() {
    const mattIndexHtml = await fetchText(RAW_BASE + "static/blog/matt/index.html");
    const paths = extractMattPathsFromIndex(mattIndexHtml);

    state.posts = await Promise.all(paths.map(async function (path) {
      const html = await fetchText(RAW_BASE + path);
      return parseMattPost(path, html);
    }));

    state.posts.sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });

    renderPostList();
    if (state.posts.length) {
      fillForm(state.posts[0]);
    } else {
      updateSnapshot(null);
      refreshDirtyState();
    }
  }

  function rewriteHtml(originalHtml, form) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(originalHtml, "text/html");

    if (doc.querySelector(".post-title")) {
      doc.querySelector(".post-title").textContent = form.title;
    }
    doc.title = form.title + (doc.title.includes("|") ? " | " + doc.title.split("|").slice(1).join("|").trim() : "");

    function setMeta(selector, content) {
      const node = doc.querySelector(selector);
      if (node) node.setAttribute("content", content);
    }

    setMeta('meta[name="description"]', form.description);
    setMeta('meta[property="og:description"]', form.description);
    setMeta('meta[name="twitter:description"]', form.description);
    setMeta('meta[property="og:title"]', form.title + " ~ From the Forest Temple");
    setMeta('meta[name="twitter:title"]', form.title + " ~ From the Forest Temple");
    setMeta('meta[name="robots"]', form.noindex ? "noindex, follow" : "index, follow");

    const canonical = doc.querySelector('link[rel="canonical"]');
    if (canonical && form.canonical) {
      canonical.setAttribute("href", form.canonical);
    }
    setMeta('meta[property="og:url"]', form.canonical || form.previewUrl);

    const hero = doc.querySelector(".post-hero");
    if (hero && form.heroImage) {
      const style = hero.getAttribute("style");
      if (style) {
        hero.setAttribute("style", style.replace(/url\((['"]?)(.*?)\1\)/, 'url("' + form.heroImage + '")'));
      } else if (hero.style && hero.style.background) {
        hero.style.background = hero.style.background.replace(/url\((['"]?)(.*?)\1\)/, 'url("' + form.heroImage + '")');
      } else {
        hero.style.backgroundImage = 'url("' + form.heroImage + '")';
      }
    }

    const heroTitle = doc.querySelector(".post-title");
    if (heroTitle) {
      heroTitle.textContent = form.title;
    }

    const postBody = doc.querySelector(".post-body");
    if (postBody) {
      const divider = postBody.querySelector(".post-divider");
      const lockedTailHtml = state.currentPost.lockedTailHtml || "";
      postBody.innerHTML = "";
      if (divider) {
        postBody.appendChild(divider);
      }
      const wrapper = doc.createElement("div");
      wrapper.innerHTML = form.bodyHtml;
      while (wrapper.firstChild) {
        postBody.appendChild(wrapper.firstChild);
      }
      if (lockedTailHtml) {
        const lockedWrapper = doc.createElement("div");
        lockedWrapper.innerHTML = lockedTailHtml;
        while (lockedWrapper.firstChild) {
          postBody.appendChild(lockedWrapper.firstChild);
        }
      }
    }

    const jsonLd = readJsonLd(doc);
    if (jsonLd.node && jsonLd.data) {
      jsonLd.data.headline = form.title;
      jsonLd.data.description = form.description;
      jsonLd.data.url = form.canonical || ("https://vibrationofawesome.com" + form.previewUrl);
      if (form.date) {
        jsonLd.data.datePublished = new Date(form.date).toISOString();
      }
      jsonLd.node.textContent = JSON.stringify(jsonLd.data);
    }

    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  function currentFormState() {
    return {
      path: els.path.value.trim(),
      title: els.title.value.trim(),
      slug: els.slug.value.trim(),
      previewUrl: els.preview.value.trim(),
      date: els.date.value ? new Date(els.date.value).toISOString() : "",
      description: els.description.value.trim(),
      heroImage: els.thumbnail.value.trim(),
      canonical: els.canonical.value.trim(),
      noindex: !!els.draft.checked,
      bodyHtml: state.editor.getHTML(),
    };
  }

  async function savePost() {
    if (!state.currentPost) {
      throw new Error("Select a Matt post first");
    }

    const form = currentFormState();
    if (!form.title) throw new Error("Title is required");
    if (!form.path) throw new Error("Post path is missing");

    els.saveButton.disabled = true;
    els.saveButtonSticky.disabled = true;
    els.saveButton.textContent = "Saving...";
    els.saveButtonSticky.textContent = "Saving...";
    els.saveChip.textContent = "Saving";
    els.saveChip.classList.remove("dirty");
    els.saveChip.classList.add("ready");

    try {
      const existing = await githubRequest("/contents/" + form.path + "?ref=" + encodeURIComponent(GITHUB_BRANCH), {}, state.token);
      const updatedHtml = rewriteHtml(state.currentPost.originalHtml, form);
      await githubRequest("/contents/" + form.path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Update Matt post: " + form.title,
          content: encodeBase64Unicode(updatedHtml),
          sha: existing.sha,
          branch: GITHUB_BRANCH,
        }),
      }, state.token);

      clearAutosave();
      await loadPosts();
      const refreshed = state.posts.find(function (post) { return post.path === form.path; });
      if (refreshed) {
        fillForm(refreshed);
      }
      els.authStatus.textContent = "Saved to GitHub on branch " + GITHUB_BRANCH + ".";
      setStatus("Saved to GitHub and ready for the next deploy.", false);
    } catch (error) {
      throw new Error(friendlyGithubError(error));
    } finally {
      refreshDirtyState();
    }
  }

  function downloadCurrentPost() {
    if (!state.currentPost) return;
    const form = currentFormState();
    const html = rewriteHtml(state.currentPost.originalHtml, form);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = state.currentPost.path.split("/").slice(-2).join("-").replace(/\//g, "-");
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetCurrentPost() {
    if (!state.currentPost) return;
    fillForm(state.currentPost);
    clearAutosave();
  }

  function lockStudio() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.reload();
  }

  function bindEvents() {
    els.gateForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      els.gateError.hidden = true;
      try {
        const token = els.gatePassword.value.trim();
        if (!token) throw new Error("GitHub token required");
        await validateTokenForStudio(token);
        state.token = token;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: token }));
        els.authStatus.textContent = "GitHub token accepted with write access. Save is enabled.";
        els.gate.hidden = true;
        els.app.hidden = false;
        await loadPosts();
      } catch (error) {
        els.gateError.hidden = false;
        els.gateError.textContent = friendlyGithubError(error) || "That credential did not unlock the editor.";
      }
    });

    els.postSearch.addEventListener("input", renderPostList);
    els.downloadButton.addEventListener("click", downloadCurrentPost);
    els.resetButton.addEventListener("click", resetCurrentPost);
    els.lockButton.addEventListener("click", lockStudio);
    function handleSave() {
      savePost().catch(function (error) {
        setStatus(error.message || "Save failed.", true);
        els.saveBannerTitle.textContent = "Save failed";
        els.saveBannerCopy.textContent = error.message || "GitHub rejected the save. Check your token permissions and try again.";
        setSaveControls({
          disabled: !state.token,
          label: "Save Live Edit",
          chipText: "Attention",
          chipState: "dirty",
        });
      });
    }

    els.saveButton.addEventListener("click", handleSave);
    els.saveButtonSticky.addEventListener("click", handleSave);

    [els.title, els.date, els.description, els.thumbnail, els.canonical, els.draft].forEach(function (input) {
      input.addEventListener("input", function () {
        updateSnapshot({
          title: els.title.value.trim() || "Untitled",
          description: els.description.value.trim() || "No description set yet.",
          isArchive: !!state.currentPost && state.currentPost.isArchive,
        });
        refreshDirtyState();
        writeAutosave();
      });
      input.addEventListener("change", function () {
        const robots = els.draft.checked ? "noindex, follow" : "index, follow";
        els.tags.value = robots;
        refreshDirtyState();
        writeAutosave();
      });
    });
  }

  async function init() {
    drawStars();
    initEditor();
    bindEvents();

    const saved = sessionStorage.getItem(SESSION_KEY);
    setSaveControls({
      disabled: true,
      label: "Save Live Edit",
      chipText: "Locked",
      chipState: "",
    });
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.token) {
          state.token = parsed.token;
          await validateTokenForStudio(state.token);
          await loadPosts();
          els.gate.hidden = true;
          els.app.hidden = false;
          els.authStatus.textContent = "GitHub token already active with write access. Save is enabled.";
          refreshDirtyState();
        }
      } catch (_) {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }

  init().catch(function (error) {
    setStatus(error && error.message ? error.message : "Studio failed to initialize.", true);
  });
})();
