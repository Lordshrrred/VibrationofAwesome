/**
 * refresh-orchestration.js
 *
 * Fire-and-forget orchestration export refresh.
 * Call after successful publishing/syndication/retry completion.
 *
 * GUARANTEES:
 *   - Never throws. Never rejects. Wraps all errors internally.
 *   - Never blocks the calling script — publishing always completes first.
 *   - Writes orchestration-state.json with freshness metadata.
 *   - Writes orchestration-health.json with export history.
 *   - On failure: logs the error, increments consecutive_failures, exits cleanly.
 *
 * USAGE:
 *   import { refreshOrchestration } from "./lib/refresh-orchestration.js";
 *   await refreshOrchestration("drip_publish");
 *
 * SOURCE EVENTS:
 *   "drip_publish"  — drip-publish.js completed successfully
 *   "syndication"   — syndicate.js CLI completed successfully
 *   "retry"         — retry-failed-syndication.js completed successfully
 *   "manual"        — npm run orchestration:export
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildOrchestrationState } from "./orchestration-export.js";

const __dirname     = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT     = join(__dirname, "..", "..");
const DATA_DIR      = join(REPO_ROOT, "static", "_data");
const STATE_PATH    = join(DATA_DIR, "orchestration-state.json");
const HEALTH_PATH   = join(DATA_DIR, "orchestration-health.json");

const STALE_AFTER_MINUTES = 60;

function readHealth() {
  if (!existsSync(HEALTH_PATH)) {
    return {
      last_successful_export_at: null,
      last_attempt_at:           null,
      last_source_event:         null,
      consecutive_failures:      0,
      last_error:                null,
      export_count:              0,
    };
  }
  try {
    return JSON.parse(readFileSync(HEALTH_PATH, "utf8"));
  } catch {
    return {
      last_successful_export_at: null,
      last_attempt_at:           null,
      last_source_event:         null,
      consecutive_failures:      0,
      last_error:                null,
      export_count:              0,
    };
  }
}

function writeHealth(health) {
  try {
    writeFileSync(HEALTH_PATH, JSON.stringify(health, null, 2), "utf8");
  } catch (err) {
    console.warn(`[orchestration] Could not write health file: ${err.message}`);
  }
}

/**
 * Refresh orchestration state after a successful publishing/syndication event.
 * @param {string} sourceEvent - "drip_publish" | "syndication" | "retry" | "manual"
 * @returns {Promise<{ok: boolean, durationMs?: number, error?: string}>}
 */
export async function refreshOrchestration(sourceEvent = "manual") {
  const health      = readHealth();
  const attemptedAt = new Date().toISOString();
  health.last_attempt_at   = attemptedAt;
  health.last_source_event = sourceEvent;

  const t0 = Date.now();

  try {
    const state       = buildOrchestrationState();
    const durationMs  = Date.now() - t0;

    // Inject freshness metadata into the state
    state._freshness = {
      last_export_at:       attemptedAt,
      source_event:         sourceEvent,
      export_duration_ms:   durationMs,
      schema_version:       state.schema_version,
      stale_after_minutes:  STALE_AFTER_MINUTES,
    };

    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");

    // Update health — success path
    health.last_successful_export_at = attemptedAt;
    health.consecutive_failures      = 0;
    health.last_error                = null;
    health.export_count              = (health.export_count || 0) + 1;
    writeHealth(health);

    console.log(`[orchestration] ✓ State refreshed (${durationMs}ms, source: ${sourceEvent})`);
    return { ok: true, durationMs };

  } catch (err) {
    const durationMs = Date.now() - t0;

    // Update health — failure path
    health.consecutive_failures = (health.consecutive_failures || 0) + 1;
    health.last_error           = err.message || String(err);
    writeHealth(health);

    // Log but never throw — publishing already succeeded
    console.warn(`[orchestration] Export failed (${durationMs}ms): ${err.message}`);
    console.warn(`[orchestration] Publishing was not affected. Consecutive failures: ${health.consecutive_failures}`);

    return { ok: false, durationMs, error: err.message };
  }
}
