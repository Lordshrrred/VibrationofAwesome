#!/usr/bin/env node
/**
 * get-page-tokens.js — Facebook/Instagram OAuth token fetcher
 *
 * Usage:
 *   node scripts/get-page-tokens.js
 *
 * Requires in .env:
 *   META_APP_ID
 *   META_APP_SECRET
 *
 * Writes to .env:
 *   FACEBOOK_PAGE_ID       (first page found)
 *   FACEBOOK_ACCESS_TOKEN  (long-lived page token)
 *   INSTAGRAM_ACCOUNT_ID   (if connected Instagram Business account found)
 *
 * Prerequisites:
 *   - Add http://localhost:3000/callback as a valid OAuth redirect URI
 *     in your Meta App Dashboard → Facebook Login → Settings
 *   npm install express dotenv open
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URLSearchParams } = require('url');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const APP_ID = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const PORT = 3000;
const ENV_PATH = path.join(__dirname, '..', '.env');

const SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

// ── Validation ────────────────────────────────────────────────────────────────

if (!APP_ID || !APP_SECRET) {
  console.error('Error: META_APP_ID and META_APP_SECRET must be set in .env');
  process.exit(1);
}

// ── .env read/write helpers ───────────────────────────────────────────────────

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return '';
  return fs.readFileSync(ENV_PATH, 'utf8');
}

function updateEnvFile(updates) {
  let content = readEnvFile();

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      // Append after the Facebook/Instagram section header if present, else at end
      content = content.trimEnd() + '\n' + line + '\n';
    }
  }

  fs.writeFileSync(ENV_PATH, content, 'utf8');
}

// ── Graph API helpers ─────────────────────────────────────────────────────────

async function graphGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://graph.facebook.com/v19.0${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Graph API error: ${data.error.message}`);
  return data;
}

async function exchangeCodeForToken(code) {
  return graphGet('/oauth/access_token', {
    client_id: APP_ID,
    redirect_uri: REDIRECT_URI,
    client_secret: APP_SECRET,
    code,
  });
}

async function exchangeForLongLivedToken(shortLivedToken) {
  return graphGet('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });
}

async function getPageAccounts(userToken) {
  return graphGet('/me/accounts', { access_token: userToken });
}

async function getInstagramAccountId(pageId, pageToken) {
  try {
    const data = await graphGet(`/${pageId}`, {
      fields: 'instagram_business_account',
      access_token: pageToken,
    });
    return data.instagram_business_account?.id || null;
  } catch {
    return null;
  }
}

// ── Browser opener ────────────────────────────────────────────────────────────

function openBrowser(url) {
  // Try open package first, fall back to platform commands
  try {
    const open = require('open');
    return open(url);
  } catch {
    const { exec } = require('child_process');
    const cmd =
      process.platform === 'win32' ? `start "" "${url}"` :
      process.platform === 'darwin' ? `open "${url}"` :
      `xdg-open "${url}"`;
    exec(cmd);
  }
}

// ── OAuth server ──────────────────────────────────────────────────────────────

function startOAuthServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

      if (reqUrl.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>Authorization denied.</h2><p>You can close this tab.</p>');
        server.close();
        reject(new Error(`OAuth denied: ${reqUrl.searchParams.get('error_description') || error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h2>Missing authorization code.</h2>');
        server.close();
        reject(new Error('No code received in OAuth callback'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
          <h2 style="color:#4CAF50">Authorization successful!</h2>
          <p>Fetching your page tokens now...</p>
          <p>You can close this tab and check your terminal.</p>
        </body></html>
      `);

      server.close();
      resolve(code);
    });

    server.listen(PORT, () => resolve);
    server.on('listening', () => {}); // no-op, resolve happens on callback
    server.on('error', reject);

    // Override resolve to fire after server is listening
    server.once('listening', () => {
      // Build the OAuth URL
      const params = new URLSearchParams({
        client_id: APP_ID,
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        response_type: 'code',
      });
      const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params}`;

      console.log('\nOpening Facebook login in your browser...');
      console.log('If it does not open automatically, visit:\n');
      console.log(' ', authUrl, '\n');

      openBrowser(authUrl);
    });

    // Replace the resolve so it fires on callback, not on listen
    const originalResolve = resolve;
    // We wrap the server creation to capture code from callback
    // This is handled above — the promise resolves when /callback receives code
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Facebook / Instagram Page Token Setup ──────────────\n');
  console.log('App ID:', APP_ID);
  console.log('Permissions:', SCOPES.split(',').join(', '));
  console.log('\nStarting local OAuth server on http://localhost:3000...');

  let code;
  try {
    code = await startOAuthServer();
  } catch (err) {
    console.error('\nError during OAuth:', err.message);
    process.exit(1);
  }

  console.log('\nAuthorization code received. Exchanging for tokens...');

  // Step 1: Short-lived user token
  const shortLived = await exchangeCodeForToken(code);
  console.log('Short-lived user token obtained.');

  // Step 2: Long-lived user token (60 days)
  const longLived = await exchangeForLongLivedToken(shortLived.access_token);
  console.log('Long-lived user token obtained (60-day expiry).');

  // Step 3: Get all pages
  const accountsData = await getPageAccounts(longLived.access_token);
  const pages = accountsData.data || [];

  if (pages.length === 0) {
    console.error('\nNo Facebook Pages found on this account.');
    console.error('Make sure you manage at least one Page before running this script.');
    process.exit(1);
  }

  console.log(`\nFound ${pages.length} page(s):\n`);

  const envUpdates = {};
  let primarySet = false;

  for (const page of pages) {
    console.log(`  Page: "${page.name}" (ID: ${page.id})`);

    // Check for connected Instagram Business account
    const igId = await getInstagramAccountId(page.id, page.access_token);
    if (igId) {
      console.log(`    Instagram Business Account: ${igId}`);
    }

    if (!primarySet) {
      envUpdates['FACEBOOK_PAGE_ID'] = page.id;
      envUpdates['FACEBOOK_ACCESS_TOKEN'] = page.access_token;
      if (igId) {
        envUpdates['INSTAGRAM_ACCOUNT_ID'] = igId;
      }
      primarySet = true;
    }
  }

  // Step 4: Write to .env
  updateEnvFile(envUpdates);

  console.log('\n── .env Updated ────────────────────────────────────────\n');
  console.log('  FACEBOOK_PAGE_ID     =', envUpdates['FACEBOOK_PAGE_ID']);
  console.log('  FACEBOOK_ACCESS_TOKEN= [set — long-lived page token]');
  if (envUpdates['INSTAGRAM_ACCOUNT_ID']) {
    console.log('  INSTAGRAM_ACCOUNT_ID =', envUpdates['INSTAGRAM_ACCOUNT_ID']);
  } else {
    console.log('  INSTAGRAM_ACCOUNT_ID = (not found — check Page is linked to an Instagram Business account)');
  }

  console.log('\n── Notes ───────────────────────────────────────────────\n');
  console.log('  Page access tokens generated from a long-lived user token');
  console.log('  do NOT expire. You should not need to re-run this script');
  console.log('  unless you disconnect the app or revoke permissions.\n');

  if (pages.length > 1) {
    console.log('  Multiple pages found. Only the first page was written to .env.');
    console.log('  To use a different page, manually update FACEBOOK_PAGE_ID and');
    console.log('  FACEBOOK_ACCESS_TOKEN with the values below:\n');
    for (const page of pages.slice(1)) {
      const igId = await getInstagramAccountId(page.id, page.access_token);
      console.log(`  Page: "${page.name}"`);
      console.log(`    FACEBOOK_PAGE_ID=${page.id}`);
      console.log(`    FACEBOOK_ACCESS_TOKEN=${page.access_token}`);
      if (igId) console.log(`    INSTAGRAM_ACCOUNT_ID=${igId}`);
      console.log();
    }
  }

  console.log('Done. You can now run node scripts/syndicate.js\n');
}

main().catch(err => {
  console.error('\nUnexpected error:', err.message);
  process.exit(1);
});
