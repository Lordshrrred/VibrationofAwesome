#!/usr/bin/env node
/**
 * get-pinterest-token.js ~ Fresh Pinterest OAuth with correct scopes
 *
 * Pinterest requires explicit OAuth authorization for boards:write and pins:write.
 *
 * Usage:
 *   node scripts/get-pinterest-token.js --account ESR   (EarthStar Rising account)
 *   node scripts/get-pinterest-token.js --account VOA   (Vibration of Awesome account)
 *   node scripts/get-pinterest-token.js                 (defaults to ESR)
 *
 * Reads:  {PREFIX}_PINTEREST_APP_ID and {PREFIX}_PINTEREST_APP_SECRET from .env
 * Output: paste {PREFIX}_PINTEREST_ACCESS_TOKEN and {PREFIX}_PINTEREST_REFRESH_TOKEN into .env
 *
 * Pinterest Developer Console:
 *   https://developers.pinterest.com/apps/
 *   Add http://localhost:9877/callback as a redirect URI in your app settings.
 */

import dotenv from "dotenv";
import http from "http";
import https from "https";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const args    = process.argv.slice(2);
const accIdx  = args.indexOf("--account");
const ACCOUNT = (accIdx !== -1 ? args[accIdx + 1] : "ESR").toUpperCase();

if (!["ESR", "VOA"].includes(ACCOUNT)) {
  console.error(`Unknown account: ${ACCOUNT}. Use --account ESR or --account VOA`);
  process.exit(1);
}

const PREFIX   = ACCOUNT;
const APP_ID   = process.env[`${PREFIX}_PINTEREST_APP_ID`];
const APP_SECRET = process.env[`${PREFIX}_PINTEREST_APP_SECRET`];
const PORT     = 9877;
const REDIRECT = `http://localhost:${PORT}/callback`;

if (!APP_ID || !APP_SECRET) {
  console.error(`Error: ${PREFIX}_PINTEREST_APP_ID and ${PREFIX}_PINTEREST_APP_SECRET must be set in .env`);
  process.exit(1);
}

// Full scope set required for creating pins and managing boards
const SCOPES = [
  "boards:read",
  "boards:write",
  "pins:read",
  "pins:write",
  "user_accounts:read",
].join(",");

const STATE = Math.random().toString(36).slice(2);

const authUrl =
  `https://www.pinterest.com/oauth/` +
  `?client_id=${APP_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&state=${STATE}`;

console.log(`\n=== Pinterest OAuth Token Refresh [${PREFIX}] ===`);
console.log("IMPORTANT: Make sure your Pinterest app has this redirect URI registered:");
console.log(`  ${REDIRECT}`);
console.log("  → Go to https://developers.pinterest.com/apps/ → your app → Edit → Add redirect URI\n");
console.log("Opening browser for Pinterest OAuth...");
console.log("If it doesn't open automatically, visit:\n");
console.log(authUrl + "\n");

const openCmd =
  process.platform === "win32" ? `start "" "${authUrl}"` :
  process.platform === "darwin" ? `open "${authUrl}"` :
  `xdg-open "${authUrl}"`;
exec(openCmd);

const server = http.createServer(async (req, res) => {
  const url      = new URL(req.url, `http://localhost:${PORT}`);
  const code     = url.searchParams.get("code");
  const retState = url.searchParams.get("state");
  const errMsg   = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (errMsg) {
    res.end("OAuth error: " + errMsg + ". You can close this tab.");
    console.error("\nOAuth error:", errMsg);
    server.close();
    return;
  }

  if (!code) { res.end("No code received."); return; }

  if (retState !== STATE) {
    res.end("State mismatch ~ possible CSRF. You can close this tab.");
    console.error("\nState mismatch ~ aborting.");
    server.close();
    return;
  }

  res.end("Token received! Check your terminal. You can close this tab.");
  server.close();

  try {
    // Exchange code → access token
    const credentials = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64");
    const tokenResp = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type:   "authorization_code",
        code,
        redirect_uri: REDIRECT,
      }),
    });

    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      throw new Error(tokenData.message || tokenData.error || JSON.stringify(tokenData));
    }

    const accessToken  = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn    = tokenData.expires_in;
    const scopes       = tokenData.scope;

    console.log("✓ Got Pinterest access token");
    console.log(`  Scopes granted: ${scopes}`);
    console.log(`  Expires in: ${Math.round(expiresIn / 86400)} days`);
    if (refreshToken) console.log("  Refresh token: received");

    // Fetch boards so user can pick the right PINTEREST_BOARD_ID
    const boardsResp = await fetch(
      "https://api.pinterest.com/v5/boards?page_size=25",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const boardsData = await boardsResp.json();
    const boards     = boardsData.items || [];
    console.log(`\n✓ Found ${boards.length} board(s):`);
    boards.forEach(b => console.log(`  ${b.id}  ~  ${b.name}`));

    console.log("\n═══════════════════════════════════════════════");
    console.log("  PASTE THESE INTO YOUR .env FILE:");
    console.log("═══════════════════════════════════════════════\n");
    console.log(`${PREFIX}_PINTEREST_ACCESS_TOKEN=${accessToken}`);
    if (refreshToken) console.log(`${PREFIX}_PINTEREST_REFRESH_TOKEN=${refreshToken}`);
    console.log();
    console.log(`# Set ${PREFIX}_PINTEREST_BOARD_ID to the board ID from the list above.`);
    console.log(`# Current value: ${process.env[`${PREFIX}_PINTEREST_BOARD_ID`] || "(not set)"}`);
    console.log("\n═══════════════════════════════════════════════\n");

    // Verify the token has the required write scopes
    const grantedScopes = (scopes || "").split(",").map(s => s.trim());
    const missing = ["boards:write", "pins:write"].filter(s => !grantedScopes.includes(s));
    if (missing.length) {
      console.log(`⚠️  WARNING: Token is missing scopes: ${missing.join(", ")}`);
      console.log("   The Pinterest app may need broader permissions enabled.");
      console.log("   Contact Pinterest developer support or check app settings.\n");
    } else {
      console.log("✓ Token has all required write scopes (boards:write, pins:write)\n");
    }

  } catch (err) {
    console.error("Error:", err.message);
  }
});

server.listen(PORT, () => {
  console.log(`Waiting for OAuth callback on http://localhost:${PORT}/callback ...`);
});

server.on("error", err => {
  console.error("Server error:", err.message);
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is busy. Kill whatever is using it and retry.`);
  }
  process.exit(1);
});
