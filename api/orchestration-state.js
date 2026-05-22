/**
 * api/orchestration-state.js
 *
 * Read-only Vercel serverless endpoint exposing VOA orchestration state.
 *
 * GET  /api/orchestration-state
 *   Returns the full orchestration state compiled by orchestration-export.js.
 *   Served from static/_data/orchestration-state.json (pre-built on deploy).
 *
 * GET  /api/orchestration-state?section=timeline
 *   Returns a single section: publishing | syndication | visuals | clusters | generation | timeline
 *
 * This endpoint is READ-ONLY. It never mutates any data.
 * It is intended for EarthStar Command ingestion and dashboard visibility.
 *
 * SECURITY: No auth required — all data is already public on the static site.
 * The state file contains no private identifiers.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, "..", "static", "_data", "orchestration-state.json");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

const VALID_SECTIONS = new Set([
  "publishing", "syndication", "visuals", "clusters", "generation", "timeline",
]);

function send(res, status, body) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  res.status(status).json(body);
}

export default function handler(req, res) {
  if (req.method === "OPTIONS") {
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return send(res, 405, { error: "Method not allowed" });
  }

  if (!existsSync(STATE_FILE)) {
    return send(res, 503, {
      error: "Orchestration state not yet generated",
      hint:  "Run: npm run orchestration:export",
    });
  }

  let state;
  try {
    state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return send(res, 500, { error: "Failed to parse orchestration state" });
  }

  const section = req.query?.section;

  if (section) {
    if (!VALID_SECTIONS.has(section)) {
      return send(res, 400, {
        error:    `Unknown section: ${section}`,
        valid:    [...VALID_SECTIONS],
      });
    }
    return send(res, 200, {
      schema_version: state.schema_version,
      generated_at:   state.generated_at,
      source:         state.source,
      section,
      data:           state[section],
    });
  }

  return send(res, 200, state);
}
