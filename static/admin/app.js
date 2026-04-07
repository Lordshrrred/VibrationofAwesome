(function () {
  const GITHUB_API = "https://api.github.com/repos/Lordshrrred/VibrationofAwesome";
  const GITHUB_BRANCH = "main";
  const MATT_POST_PREFIX = "static/blog/matt/posts/";
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
    previewLink: document.getElementById("preview-link"),
    githubLink: document.getElementById("github-link"),
    downloadButton: document.getElementById("download-button"),
    saveButton: document.getElementById("save-button"),
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

  function editableBodyHtml(doc) {
    const bodyContainer = doc.querySelector(".post-body");
    if (!bodyContainer) return "";
    let html = bodyContainer.innerHTML;
    html = html.replace(/^\s*<div class="post-divider"><\/div>\s*/i, "");
    return html.trim();
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
      bodyHtml: editableBodyHtml(doc),
      isArchive: detectArchive(doc),
      originalHtml: content,
    };
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
      return;
    }
    const dirty = currentSnapshot() !== state.initialSnapshot;
    setStatus(dirty ? "Unsaved changes are waiting." : "All changes in sync with the loaded live post.", dirty);
  }

  function updateLinks() {
    const preview = els.preview.value.trim();
    els.previewLink.href = preview || "#";
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
      return;
    }

    els.postList.innerHTML = state.filteredPosts.map(function (post) {
      const active = state.currentPost && state.currentPost.path === post.path;
      return (
        "<article class=\"post-item" + (active ? " active" : "") + "\" data-path=\"" + escapeHtml(post.path) + "\">" +
          "<h3>" + escapeHtml(post.title) + "</h3>" +
          "<p>" + escapeHtml(post.description || post.previewUrl) + "</p>" +
          "<div class=\"post-item-meta\">" +
            "<span class=\"pill\">" + escapeHtml(post.previewUrl) + "</span>" +
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
  }

  async function loadPosts() {
    const tree = await githubRequest("/git/trees/" + encodeURIComponent(GITHUB_BRANCH) + "?recursive=1", {}, state.token);
    const fileItems = (tree.tree || []).filter(function (item) {
      return item.type === "blob" && item.path.startsWith(MATT_POST_PREFIX) && item.path.endsWith(".html");
    });

    state.posts = await Promise.all(fileItems.map(async function (item) {
      const data = await githubRequest("/contents/" + item.path + "?ref=" + encodeURIComponent(GITHUB_BRANCH), {}, state.token);
      const decoded = decodeBase64Unicode(data.content);
      return parseMattPost(item.path, decoded);
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
      postBody.innerHTML = "";
      if (divider) {
        postBody.appendChild(divider);
      }
      const wrapper = doc.createElement("div");
      wrapper.innerHTML = form.bodyHtml;
      while (wrapper.firstChild) {
        postBody.appendChild(wrapper.firstChild);
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
    els.saveButton.textContent = "Saving...";

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
    } finally {
      els.saveButton.disabled = false;
      els.saveButton.textContent = "Save Changes";
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
        await githubRequest("", {}, token);
        state.token = token;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: token }));
        els.gate.hidden = true;
        els.app.hidden = false;
        els.authStatus.textContent = "Auth mode: GitHub token save path.";
        await loadPosts();
      } catch (error) {
        els.gateError.hidden = false;
        els.gateError.textContent = error.message || "That credential did not unlock the editor.";
      }
    });

    els.postSearch.addEventListener("input", renderPostList);
    els.downloadButton.addEventListener("click", downloadCurrentPost);
    els.resetButton.addEventListener("click", resetCurrentPost);
    els.lockButton.addEventListener("click", lockStudio);
    els.saveButton.addEventListener("click", function () {
      savePost().catch(function (error) {
        setStatus(error.message || "Save failed.", true);
      });
    });

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
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.token) {
          state.token = parsed.token;
          await githubRequest("", {}, state.token);
          els.gate.hidden = true;
          els.app.hidden = false;
          els.authStatus.textContent = "Auth mode: GitHub token save path.";
          await loadPosts();
        }
      } catch (_) {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }

  init().catch(function () {});
})();
