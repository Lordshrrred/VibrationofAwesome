/**
 * anthropic-client.js ~ Shared Claude API client factory
 *
 * Centralizes retry/backoff safety so a runaway loop is visible in logs
 * instead of silently burning extra API spend. The SDK already retries
 * 429/5xx/connection errors with exponential backoff; this wraps `fetch`
 * purely to log when that's happening, and pins `maxRetries` explicitly
 * (capped at 3) rather than relying on the SDK default.
 */

import Anthropic from "@anthropic-ai/sdk";
import { costControlledRequest } from "./claude-models.js";

const MAX_RETRIES = 3;

function loggingFetch(label, retries) {
  return async (url, init) => {
    if (typeof init?.body === "string" && String(url).includes("/messages")) {
      init = { ...init, body: JSON.stringify(costControlledRequest(JSON.parse(init.body))) };
    }
    const res = await fetch(url, init);
    if (res.ok && res.headers.get("content-type")?.includes("application/json") && String(url).includes("/messages")) {
      // Usage only: never log prompts, generated text, keys, or account IDs.
      try {
        const data = await res.clone().json();
        if (data.usage) console.log(`CLAUDE_USAGE ${JSON.stringify({ label: label || "unlabelled", model: data.model, stop_reason: data.stop_reason, usage: data.usage })}`);
      } catch { /* Diagnostics must not fail a successful generation. */ }
    }
    if (!res.ok && (res.status === 429 || res.status >= 500)) {
      console.warn(
        `[anthropic${label ? `:${label}` : ""}] HTTP ${res.status} ~ configured retry limit ${retries}.`,
      );
    }
    return res;
  };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.apiKey]
 * @param {string} [opts.label] ~ short tag for retry log lines, e.g. "generate-post"
 * @param {number} [opts.maxRetries] ~ override the default cap (still your responsibility to keep it sane)
 */
export function createAnthropicClient(opts = {}) {
  const { apiKey, label, maxRetries, ...rest } = opts;
  return new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    maxRetries: typeof maxRetries === "number" ? maxRetries : MAX_RETRIES,
    fetch: loggingFetch(label, typeof maxRetries === "number" ? maxRetries : MAX_RETRIES),
    ...rest,
  });
}
