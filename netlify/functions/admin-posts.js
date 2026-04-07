"use strict";

const crypto = require("crypto");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Dashboard-Password",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

function safeEqual(a, b) {
  const left = Buffer.from(a || "", "utf8");
  const right = Buffer.from(b || "", "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseValue(rawValue) {
  const value = rawValue.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value);
    } catch (_) {
      return [];
    }
  }
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
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
    if (!line.trim()) return;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) return;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    data[key] = parseValue(value);
  });

  return { data, body };
}

function serializeValue(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined || value === "") return null;
  return JSON.stringify(String(value));
}

function buildFrontMatter(post) {
  const ordered = [
    ["title", post.title],
    ["slug", post.slug],
    ["date", post.date],
    ["description", post.description],
    ["thumbnail", post.thumbnail],
    ["tags", post.tags],
    ["canonical", post.canonical],
    ["draft", !!post.draft],
  ];

  const lines = ordered
    .map(function (entry) {
      const key = entry[0];
      const value = serializeValue(entry[1]);
      return value === null ? null : key + ": " + value;
    })
    .filter(Boolean);

  return "---\n" + lines.join("\n") + "\n---\n\n";
}

function buildMarkdown(post) {
  return buildFrontMatter(post) + (post.body || "").trim() + "\n";
}

function baseHeaders(token) {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "User-Agent": "VOA-Post-Studio",
  };
}

async function githubJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(function () {
    return {};
  });

  if (!response.ok) {
    throw new Error(data.message || "GitHub API request failed");
  }

  return data;
}

function previewUrl(slug) {
  return "/posts/" + slug + "/";
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const password = event.headers["x-dashboard-password"] || event.headers["X-Dashboard-Password"] || "";
  const expectedPassword = process.env.DASHBOARD_PASSWORD || "";

  if (!expectedPassword || !safeEqual(password, expectedPassword)) {
    return {
      statusCode: 401,
      headers: CORS,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || "Lordshrrred/VibrationofAwesome";
  const branch = process.env.GITHUB_BRANCH || "main";
  const postsFolder = "content/posts";

  if (!githubToken) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Missing GITHUB_TOKEN environment variable" }),
    };
  }

  try {
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      const action = params.action || "list";

      if (action === "list") {
        const items = await githubJson(
          "https://api.github.com/repos/" + repo + "/contents/" + postsFolder + "?ref=" + encodeURIComponent(branch),
          { headers: baseHeaders(githubToken) }
        );

        const fileItems = items.filter(function (item) {
          return item.type === "file" && item.name.endsWith(".md") && item.name !== "_index.md";
        });

        const posts = await Promise.all(fileItems.map(async function (item) {
          const file = await githubJson(
            "https://api.github.com/repos/" + repo + "/contents/" + item.path + "?ref=" + encodeURIComponent(branch),
            { headers: baseHeaders(githubToken) }
          );
          const decoded = Buffer.from(file.content, "base64").toString("utf8");
          const parsed = parseFrontMatter(decoded);
          return {
            path: item.path,
            title: parsed.data.title || item.name.replace(/\.md$/, ""),
            slug: parsed.data.slug || item.name.replace(/\.md$/, ""),
            date: parsed.data.date || "",
            description: parsed.data.description || "",
            thumbnail: parsed.data.thumbnail || "",
            canonical: parsed.data.canonical || "",
            tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
            draft: !!parsed.data.draft,
            previewUrl: previewUrl(parsed.data.slug || item.name.replace(/\.md$/, "")),
          };
        }));

        posts.sort(function (a, b) {
          return String(b.date || "").localeCompare(String(a.date || ""));
        });

        return {
          statusCode: 200,
          headers: CORS,
          body: JSON.stringify({ posts: posts }),
        };
      }

      if (action === "get") {
        const path = params.path;
        if (!path) {
          return {
            statusCode: 400,
            headers: CORS,
            body: JSON.stringify({ error: "Missing path" }),
          };
        }

        const file = await githubJson(
          "https://api.github.com/repos/" + repo + "/contents/" + path + "?ref=" + encodeURIComponent(branch),
          { headers: baseHeaders(githubToken) }
        );
        const decoded = Buffer.from(file.content, "base64").toString("utf8");
        const parsed = parseFrontMatter(decoded);
        const slug = parsed.data.slug || path.split("/").pop().replace(/\.md$/, "");

        return {
          statusCode: 200,
          headers: CORS,
          body: JSON.stringify({
            post: {
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
              previewUrl: previewUrl(slug),
            },
          }),
        };
      }
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const slug = String(body.slug || "").trim();
      const targetPath = body.path || (postsFolder + "/" + slug + ".md");

      if (!slug) {
        return {
          statusCode: 400,
          headers: CORS,
          body: JSON.stringify({ error: "Slug is required" }),
        };
      }

      const markdown = buildMarkdown(body);
      let existingSha = null;

      try {
        const existingFile = await githubJson(
          "https://api.github.com/repos/" + repo + "/contents/" + targetPath + "?ref=" + encodeURIComponent(branch),
          { headers: baseHeaders(githubToken) }
        );
        existingSha = existingFile.sha;
      } catch (_) {
        existingSha = null;
      }

      const savePayload = {
        message: existingSha
          ? "Update post: " + (body.title || slug)
          : "Create post: " + (body.title || slug),
        content: Buffer.from(markdown, "utf8").toString("base64"),
        branch: branch,
      };

      if (existingSha) {
        savePayload.sha = existingSha;
      }

      await githubJson(
        "https://api.github.com/repos/" + repo + "/contents/" + targetPath,
        {
          method: "PUT",
          headers: Object.assign({}, baseHeaders(githubToken), {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(savePayload),
        }
      );

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          path: targetPath,
          previewUrl: previewUrl(slug),
        }),
      };
    }

    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: error.message || "Admin request failed" }),
    };
  }
};
