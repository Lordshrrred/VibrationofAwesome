(function () {
  const FUNCTIONS_BASE =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:8888/.netlify/functions"
      : "https://vibrationofawesome.netlify.app/.netlify/functions";
  const GITHUB_API = "https://api.github.com/repos/Lordshrrred/VibrationofAwesome";
  const GITHUB_BRANCH = "main";

  const SESSION_KEY = "voa_post_studio_auth";

  const state = {
    password: "",
    authMode: "",
    posts: [],
    filteredPosts: [],
    currentPost: null,
    initialSnapshot: "",
    editor: null,
  };

  const els = {
    gate: document.getElementById("gate"),
    gateForm: document.getElementById("gate-form"),
    gateMode: document.getElementById("gate-mode"),
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
    duplicateButton: document.getElementById("duplicate-button"),
    newPostButton: document.getElementById("new-post-button"),
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
      height: "680px",
      initialEditType: "wysiwyg",
      previewStyle: "vertical",
      usageStatistics: false,
      hideModeSwitch: false,
    });

    state.editor.on("change", function () {
      refreshDirtyState();
    });
  }

  async function api(path, options) {
    const requestOptions = options || {};
    const headers = Object.assign({}, requestOptions.headers || {}, {
      "X-Dashboard-Password": state.password,
    });

    const response = await fetch(FUNCTIONS_BASE + path, Object.assign({}, requestOptions, { headers }));
    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
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

  function formState() {
    const slug = els.slug.value.trim();
    const path = (state.currentPost && state.currentPost.path) || (slug ? "content/posts/" + slug + ".md" : "");

    return {
      path: path,
      originalPath: state.currentPost ? state.currentPost.path : "",
      title: els.title.value.trim(),
      slug: slug,
      date: els.date.value ? new Date(els.date.value).toISOString() : "",
      description: els.description.value.trim(),
      thumbnail: els.thumbnail.value.trim(),
      canonical: els.canonical.value.trim(),
      tags: els.tags.value
        .split(",")
        .map(function (tag) { return tag.trim(); })
        .filter(Boolean),
      draft: !!els.draft.checked,
      body: state.editor.getMarkdown(),
    };
  }

  function snapshot() {
    return JSON.stringify(formState());
  }

  function setStatus(message, isDirty) {
    els.entryStatus.textContent = message;
    els.entryStatus.style.color = isDirty ? "var(--accent-warm)" : "var(--muted)";
  }

  function refreshDirtyState() {
    if (!state.currentPost && !els.title.value.trim() && !state.editor.getMarkdown().trim()) {
      setStatus("Ready for a new draft.", false);
      return;
    }

    const dirty = snapshot() !== state.initialSnapshot;
    setStatus(dirty ? "Unsaved changes are waiting." : "All changes saved in the working form.", dirty);
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

  function previewUrlForSlug(slug) {
    return slug ? "/posts/" + slug + "/" : "#";
  }

  function updatePreviewLink() {
    const url = previewUrlForSlug(els.slug.value.trim());
    els.previewLink.href = url;
    els.previewLink.classList.toggle("is-disabled", !els.slug.value.trim());
    const githubPath = (state.currentPost && state.currentPost.path) || "";
    if (githubPath) {
      els.githubLink.href = "https://github.com/Lordshrrred/VibrationofAwesome/edit/" + GITHUB_BRANCH + "/" + githubPath;
      els.githubLink.classList.remove("is-disabled");
    } else {
      els.githubLink.href = "#";
      els.githubLink.classList.add("is-disabled");
    }
  }

  function fillForm(post) {
    state.currentPost = post;
    els.entryHeading.textContent = post.title || "Untitled Post";
    els.title.value = post.title || "";
    els.slug.value = post.slug || "";
    els.date.value = toDatetimeLocal(post.date || "");
    els.description.value = post.description || "";
    els.thumbnail.value = post.thumbnail || "";
    els.canonical.value = post.canonical || "";
    els.tags.value = (post.tags || []).join(", ");
    els.draft.checked = !!post.draft;
    state.editor.setMarkdown(post.body || "");
    state.initialSnapshot = snapshot();
    updatePreviewLink();
    refreshDirtyState();
  }

  function blankPost(seed) {
    const slugSeed = seed || "new-transmission";
    return {
      path: "",
      title: "",
      slug: slugSeed,
      date: new Date().toISOString(),
      description: "",
      thumbnail: "",
      canonical: "",
      tags: [],
      draft: true,
      body: "",
    };
  }

  function renderPostList() {
    const query = els.postSearch.value.trim().toLowerCase();
    state.filteredPosts = state.posts.filter(function (post) {
      if (!query) return true;
      return (post.title || "").toLowerCase().includes(query) || (post.slug || "").toLowerCase().includes(query);
    });

    els.statTotal.textContent = String(state.posts.length);
    els.statDrafts.textContent = String(state.posts.filter(function (post) { return post.draft; }).length);

    if (!state.filteredPosts.length) {
      els.postList.innerHTML = "<div class=\"post-item\"><h3>No posts found</h3><p>Try a different search or start a new draft.</p></div>";
      return;
    }

    els.postList.innerHTML = state.filteredPosts.map(function (post) {
      const active = state.currentPost && state.currentPost.path === post.path;
      return (
        "<article class=\"post-item" + (active ? " active" : "") + "\" data-path=\"" + post.path + "\">" +
          "<h3>" + escapeHtml(post.title || "Untitled Post") + "</h3>" +
          "<p>" + escapeHtml(post.slug || "") + "</p>" +
          "<div class=\"post-item-meta\">" +
            "<span class=\"pill\">" + escapeHtml(formatDate(post.date)) + "</span>" +
            (post.draft ? "<span class=\"pill draft\">Draft</span>" : "<span class=\"pill\">Published</span>") +
          "</div>" +
        "</article>"
      );
    }).join("");

    Array.from(document.querySelectorAll(".post-item[data-path]")).forEach(function (node) {
      node.addEventListener("click", async function () {
        const path = node.getAttribute("data-path");
        await loadPost(path);
      });
    });
  }

  async function loadPosts() {
    const items = await githubRequest("/contents/content/posts?ref=" + encodeURIComponent(GITHUB_BRANCH));
    const fileItems = items.filter(function (item) {
      return item.type === "file" && item.name.endsWith(".md") && item.name !== "_index.md";
    });

    state.posts = await Promise.all(fileItems.map(async function (item) {
      const data = await githubRequest("/contents/" + item.path + "?ref=" + encodeURIComponent(GITHUB_BRANCH));
      const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
      const post = parseMarkdownFile(item.path, decoded);
      return post;
    }));
    state.posts.sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
    renderPostList();
    if (state.posts.length) {
      await loadPost(state.posts[0].path);
    } else {
      fillForm(blankPost());
      state.currentPost = null;
      els.entryHeading.textContent = "New post";
    }
  }

  async function loadPost(path) {
    const data = await githubRequest("/contents/" + path + "?ref=" + encodeURIComponent(GITHUB_BRANCH));
    const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
    fillForm(parseMarkdownFile(path, decoded));
    renderPostList();
  }

  async function savePost() {
    const payload = formState();
    if (!payload.title) throw new Error("Title is required");
    if (!payload.slug) throw new Error("Slug is required");
    if (!payload.date) throw new Error("Date is required");

    els.saveButton.disabled = true;
    els.saveButton.textContent = "Saving...";

    try {
      let result;
      if (state.authMode === "github") {
        result = await saveViaGitHub(payload);
      } else {
        result = await api("/admin-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      await loadPosts();
      const matchingPost = state.posts.find(function (post) {
        return post.path === result.path;
      });
      if (matchingPost) {
        await loadPost(matchingPost.path);
      }
      setStatus("Saved to GitHub and ready for the next deploy.", false);
    } finally {
      els.saveButton.disabled = false;
      els.saveButton.textContent = "Save Changes";
    }
  }

  function createNewPost() {
    const seed = (els.slug.value || "new-transmission").trim() + "-copy";
    state.currentPost = null;
    fillForm(blankPost(seed));
    els.entryHeading.textContent = "New post";
    renderPostList();
  }

  function resetCurrentPost() {
    if (state.currentPost && state.currentPost.path) {
      loadPost(state.currentPost.path).catch(showError);
      return;
    }
    fillForm(blankPost());
    state.currentPost = null;
    els.entryHeading.textContent = "New post";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function unlock(mode, credential) {
    state.password = credential;
    state.authMode = mode;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ mode: mode, credential: credential }));
    els.gate.hidden = true;
    els.app.hidden = false;
    els.authStatus.textContent = mode === "github"
      ? "Auth mode: GitHub token save path."
      : "Auth mode: Netlify function save path.";
  }

  function lockStudio() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.reload();
  }

  function showError(error) {
    setStatus(error.message || "Something went sideways.", true);
  }

  async function attemptUnlock(password) {
    const mode = els.gateMode.value;
    if (mode === "github") {
      if (!password.trim()) {
        throw new Error("GitHub token required");
      }
      await githubRequest("", {}, password);
      unlock(mode, password);
    } else {
      state.password = password;
      await api("/admin-posts?action=list");
      unlock(mode, password);
    }
    await loadPosts();
  }

  function parseFrontMatter(content) {
    const normalized = content.replace(/\r\n/g, "\n");
    if (!normalized.startsWith("---\n")) {
      return { data: {}, body: normalized };
    }
    const endIndex = normalized.indexOf("\n---\n", 4);
    if (endIndex === -1) {
      return { data: {}, body: normalized };
    }
    const rawFrontMatter = normalized.slice(4, endIndex);
    const body = normalized.slice(endIndex + 5);
    const data = {};
    rawFrontMatter.split("\n").forEach(function (line) {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) return;
      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      if (rawValue === "true") {
        data[key] = true;
      } else if (rawValue === "false") {
        data[key] = false;
      } else if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
        try {
          data[key] = JSON.parse(rawValue);
        } catch (_) {
          data[key] = [];
        }
      } else if ((rawValue.startsWith("\"") && rawValue.endsWith("\"")) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
        data[key] = rawValue.slice(1, -1);
      } else {
        data[key] = rawValue;
      }
    });
    return { data: data, body: body };
  }

  function parseMarkdownFile(path, content) {
    const parsed = parseFrontMatter(content);
    const slug = parsed.data.slug || path.split("/").pop().replace(/\.md$/, "");
    return {
      path: path,
      title: parsed.data.title || "",
      slug: slug,
      date: parsed.data.date || "",
      description: parsed.data.description || "",
      thumbnail: parsed.data.thumbnail || "",
      canonical: parsed.data.canonical || "",
      tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
      draft: !!parsed.data.draft,
      body: parsed.body || "",
      previewUrl: previewUrlForSlug(slug),
    };
  }

  function buildMarkdown(post) {
    const lines = [
      'title: ' + JSON.stringify(post.title || ""),
      'slug: ' + JSON.stringify(post.slug || ""),
      'date: ' + JSON.stringify(post.date || ""),
      post.description ? 'description: ' + JSON.stringify(post.description) : null,
      post.thumbnail ? 'thumbnail: ' + JSON.stringify(post.thumbnail) : null,
      post.tags && post.tags.length ? 'tags: ' + JSON.stringify(post.tags) : null,
      post.canonical ? 'canonical: ' + JSON.stringify(post.canonical) : null,
      'draft: ' + (post.draft ? "true" : "false"),
    ].filter(Boolean);

    return "---\n" + lines.join("\n") + "\n---\n\n" + (post.body || "").trim() + "\n";
  }

  async function saveViaGitHub(payload) {
    const path = payload.path || ("content/posts/" + payload.slug + ".md");
    let sha = null;

    try {
      const existing = await githubRequest("/contents/" + path + "?ref=" + encodeURIComponent(GITHUB_BRANCH), {}, state.password);
      sha = existing.sha;
    } catch (_) {
      sha = null;
    }

    const requestBody = {
      message: (sha ? "Update post: " : "Create post: ") + (payload.title || payload.slug),
      content: btoa(unescape(encodeURIComponent(buildMarkdown(payload)))),
      branch: GITHUB_BRANCH,
    };

    if (sha) {
      requestBody.sha = sha;
    }

    await githubRequest("/contents/" + path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }, state.password);

    return { path: path };
  }

  function downloadCurrentPost() {
    const payload = formState();
    const blob = new Blob([buildMarkdown(payload)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = (payload.slug || "post") + ".md";
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    els.gateForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      els.gateError.hidden = true;
      try {
        await attemptUnlock(els.gatePassword.value);
      } catch (error) {
        els.gateError.hidden = false;
        els.gateError.textContent = error.message || "That credential did not unlock the editor.";
      }
    });

    els.gateMode.addEventListener("change", function () {
      els.gatePassword.placeholder = els.gateMode.value === "github"
        ? "GitHub personal access token"
        : "Dashboard password";
    });

    els.postSearch.addEventListener("input", renderPostList);
    els.newPostButton.addEventListener("click", createNewPost);
    els.duplicateButton.addEventListener("click", createNewPost);
    els.resetButton.addEventListener("click", resetCurrentPost);
    els.lockButton.addEventListener("click", lockStudio);
    els.downloadButton.addEventListener("click", downloadCurrentPost);
    els.saveButton.addEventListener("click", function () {
      savePost().catch(showError);
    });

    [els.title, els.slug, els.date, els.description, els.thumbnail, els.canonical, els.tags, els.draft].forEach(function (input) {
      input.addEventListener("input", function () {
        if (input === els.title) {
          els.entryHeading.textContent = els.title.value.trim() || "Untitled Post";
        }
        if (input === els.slug) {
          updatePreviewLink();
        }
        refreshDirtyState();
      });
      input.addEventListener("change", refreshDirtyState);
    });
  }

  async function init() {
    drawStars();
    initEditor();
    bindEvents();

    const savedAuth = sessionStorage.getItem(SESSION_KEY);
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        els.gateMode.value = parsed.mode || "github";
        els.gatePassword.placeholder = els.gateMode.value === "github"
          ? "GitHub personal access token"
          : "Dashboard password";
        await attemptUnlock(parsed.credential || "");
      } catch (_) {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }

  init().catch(showError);
})();
