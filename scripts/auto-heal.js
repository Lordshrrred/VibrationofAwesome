#!/usr/bin/env node
/**
 * auto-heal.js ~ Self-healing system for VOA blog/syndication engine
 *
 * Tier 1 (deterministic, no AI):
 *   - Em-dash violations: scan + replace with ~, commit, re-trigger drip
 *   - Drip queue validation: alert if queue missing or corrupted
 *
 * Tier 2/3 (Claude Haiku powered):
 *   - Platform health failures: diagnose root cause, attempt code patch if confident
 *   - Surfaces human-required fixes via email
 *
 * Email: Gmail SMTP via nodemailer (GMAIL_ADDRESS + GMAIL_APP_PASSWORD secrets)
 * Triggered by .github/workflows/voa-watchdog.yml
 */

import fs          from "fs";
import path        from "path";
import { fileURLToPath } from "url";
import { execSync, spawnSync } from "child_process";
import { createAnthropicClient } from "./lib/anthropic-client.js";
import nodemailer  from "nodemailer";
import dotenv      from "dotenv";

import { pathToFileURL as __voaPathToFileURL } from "node:url";
dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────────

const ALERT_TO       = "earthlingoflight@gmail.com";
const GH_REPO        = process.env.GITHUB_REPOSITORY || "Lordshrrred/VibrationofAwesome";
const FAILED_WORKFLOW = process.env.FAILED_WORKFLOW_NAME || "";
const FAILED_RUN_URL  = process.env.FAILED_RUN_URL  || "";
const GITHUB_TOKEN    = process.env.GITHUB_TOKEN    || process.env.GH_PAT || "";

const HEALTH_FILE    = path.join(ROOT, "static", "_data", "syndication-health.json");
const HEAL_LOG_FILE  = path.join(ROOT, "static", "_data", "heal-log.json");
const TIMESTAMP_FILE = path.join(ROOT, "scripts", ".last-autoheal-timestamp");

// ── Cooldown / rate cap ──────────────────────────────────────────────────────
// voa-watchdog.yml can trigger this on every drip/catchup failure PLUS a daily
// schedule PLUS manual dispatch ~ with no cap that's an unbounded self-retrigger
// risk (tier1's retriggerDrip() can cause the very workflow that re-triggers us).
// Gate on TIMESTAMP_FILE (last-run cooldown) and HEAL_LOG_FILE (today's run
// count, naturally resets at UTC midnight since it's an ISO-date string match)
// before doing anything else, including the Claude call.
const HEAL_COOLDOWN_MS   = 60 * 60 * 1000; // 1 hour between runs
const HEAL_MAX_PER_DAY   = 3;              // hard cap; beyond this, log and stop

// Only these script files may receive Claude-generated code patches
const PATCHABLE_FILES = new Set([
  "scripts/syndicate.js",
  "scripts/drip-publish.js",
  "scripts/generate-captions.js",
  "scripts/post-live-syndicate.js",
  "scripts/retry-failed-syndication.js",
  "scripts/check-syndication-config.js",
]);

// Auth failures that are NEVER retryable or diagnosable by AI.
// These require external user action (OAuth consent, permission grant) and
// must never trigger a paid Claude call — the diagnosis is deterministic.
const AUTH_FAILURE_PATTERNS = [
  /invalid_grant/i,
  /token has been expired/i,
  /token has been revoked/i,
  /pages_manage_posts/i,
  /missing required.*scope/i,
  /missing.*page.*posting.*scope/i,
];

function isAuthFailure(check) {
  const d = check.detail || "";
  return AUTH_FAILURE_PATTERNS.some(p => p.test(d));
}

function buildAuthFailureDiagnosis(check) {
  const d = check.detail || "";
  const isOAuthRevoked = /invalid_grant|token has been expired|token has been revoked/i.test(d);
  const isScopeMissing = /pages_manage_posts|missing required.*scope|missing.*page.*posting.*scope/i.test(d);

  if (isOAuthRevoked) {
    const renewCmd = /blogger/i.test(check.name) ? "npm run blogger-token" : "See docs/syndication-auth-repair.md";
    return {
      checkName: check.name,
      diagnosis: "OAuth refresh token expired or revoked. External Google/OAuth consent flow required. AI self-healing cannot repair OAuth tokens.",
      fix_type: "auth_reconnect_required",
      confidence: "high",
      action: {
        instructions: [
          `1. Run token renewal locally: ${renewCmd}`,
          "2. Complete the OAuth consent flow in the browser that opens.",
          "3. Re-run: npm run check:syndication -- --write",
          "Note: AI self-healing cannot create a new valid OAuth refresh token. This requires external user consent.",
        ].join("\n"),
      },
    };
  }
  if (isScopeMissing) {
    return {
      checkName: check.name,
      diagnosis: "Missing required OAuth scope (pages_manage_posts). Provider or app-level permission repair required. AI self-healing cannot grant API permissions.",
      fix_type: "auth_reconnect_required",
      confidence: "high",
      action: {
        instructions: [
          "1. See docs/syndication-auth-repair.md for the repair procedure.",
          "2. Do not use the direct Meta provider until pages_manage_posts scope is granted.",
          "3. Consider routing Facebook VOA through Publer after verifying the correct account mapping.",
          "Note: AI self-healing cannot grant API scopes or modify app permissions.",
        ].join("\n"),
      },
    };
  }
  return {
    checkName: check.name,
    diagnosis: "Auth failure detected. External reauth or permission repair required. AI self-healing cannot repair.",
    fix_type: "auth_reconnect_required",
    confidence: "high",
    action: { instructions: "See docs/syndication-auth-repair.md and re-run: npm run check:syndication -- --write" },
  };
}

// Mirrors check-no-emdash.js scope
const EMDASH_SCAN_DIRS = ["README.md", "CLAUDE.md", ".github", "layouts", "netlify", "scripts", "static"];
const EMDASH_TEXT_EXTS = new Set([".html", ".md", ".txt"]);
const EM_DASH          = "—";

// ── Utility helpers ───────────────────────────────────────────────────────────

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Returns { blocked: true, status, reason } if this run should stop before doing
 * anything (including the Claude call) ~ either the daily cap is hit or the
 * last run was too recent. Returns { blocked: false, status: "ran" } otherwise.
 *
 * Daily cap is checked first: an outage that keeps tripping the cooldown boundary
 * every ~61 minutes should still hit the hard 3/day ceiling, not just cycle
 * cooldown skips forever.
 */
function checkHealCooldown() {
  const today = new Date().toISOString().slice(0, 10); // resets naturally at UTC midnight

  const healLog = readJson(HEAL_LOG_FILE) || [];
  const todayRuns = healLog.filter((r) => r.healedAt && r.healedAt.slice(0, 10) === today);
  if (todayRuns.length >= HEAL_MAX_PER_DAY) {
    return {
      blocked: true,
      status: "skipped-max-attempts",
      reason: `Auto-heal max attempts reached for today ~ manual intervention needed (${todayRuns.length}/${HEAL_MAX_PER_DAY} already run today).`,
    };
  }

  let lastRunAt = null;
  try {
    lastRunAt = fs.readFileSync(TIMESTAMP_FILE, "utf8").trim() || null;
  } catch { /* no prior run recorded */ }

  if (lastRunAt) {
    const elapsedMs = Date.now() - new Date(lastRunAt).getTime();
    if (Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < HEAL_COOLDOWN_MS) {
      const waitMin = Math.ceil((HEAL_COOLDOWN_MS - elapsedMs) / 60000);
      return {
        blocked: true,
        status: "skipped-cooldown",
        reason: `Auto-heal skipped ~ cooldown active (last run ${Math.round(elapsedMs / 60000)} min ago, ${HEAL_COOLDOWN_MS / 60000} min required, ~${waitMin} min remaining).`,
      };
    }
  }

  return { blocked: false, status: "ran" };
}

function run(cmd, { cwd = ROOT, silent = true } = {}) {
  try {
    const out = execSync(cmd, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return { ok: true, out: out.trim() };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
}

function readHead(filePath, maxLines = 120) {
  try {
    return fs.readFileSync(filePath, "utf8").split("\n").slice(0, maxLines).join("\n");
  } catch { return ""; }
}

function readTail(filePath, maxLines = 60) {
  try {
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    return lines.slice(Math.max(0, lines.length - maxLines)).join("\n");
  } catch { return ""; }
}

// ── Git ───────────────────────────────────────────────────────────────────────

function gitConfig() {
  run(`git config user.name "voa-auto-healer[bot]"`);
  run(`git config user.email "auto-healer@voa.invalid"`);
}

function commitAndPush(files, message) {
  gitConfig();
  for (const f of files) run(`git add "${f}"`);
  // Check for staged changes: exit 0 = nothing staged, exit 1 = staged changes exist
  const noStaged = spawnSync("git", ["diff", "--staged", "--quiet"], { cwd: ROOT });
  if (noStaged.status === 0) return { ok: true, note: "nothing to commit" };

  // Write commit message to temp file to avoid shell escaping issues
  const tmpMsg = path.join(ROOT, ".git", "HEAL_COMMIT_MSG");
  fs.writeFileSync(tmpMsg, message, "utf8");
  const commitRes = run(`git commit -F "${tmpMsg}"`);
  try { fs.unlinkSync(tmpMsg); } catch {}
  if (!commitRes.ok) return { ok: false, note: `commit failed: ${commitRes.out}` };

  run("git fetch origin main");
  run("git merge --no-edit -X ours origin/main");
  const pushRes = run("git push");
  return { ok: pushRes.ok, note: pushRes.ok ? "" : pushRes.out };
}

// ── Tier 1: Em-dash auto-fix ──────────────────────────────────────────────────

function walkForEmDash(targetPath, offenders) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    const skip = new Set(["node_modules", "public", "resources", ".git"]);
    for (const entry of fs.readdirSync(targetPath)) {
      if (skip.has(entry)) continue;
      walkForEmDash(path.join(targetPath, entry), offenders);
    }
    return;
  }
  if (!EMDASH_TEXT_EXTS.has(path.extname(targetPath))) return;
  try {
    const text = fs.readFileSync(targetPath, "utf8");
    if (text.includes(EM_DASH)) offenders.push(targetPath);
  } catch {}
}

function tier1EmDashFix() {
  const offenders = [];
  for (const dir of EMDASH_SCAN_DIRS) {
    walkForEmDash(path.join(ROOT, dir), offenders);
  }
  if (offenders.length === 0) {
    return { healed: false, detail: "No em dashes found." };
  }

  const fixed = [];
  for (const filePath of offenders) {
    try {
      const original = fs.readFileSync(filePath, "utf8");
      const patched  = original.split(EM_DASH).join("~");
      if (patched !== original) {
        fs.writeFileSync(filePath, patched, "utf8");
        fixed.push(path.relative(ROOT, filePath));
      }
    } catch {}
  }

  if (fixed.length === 0) return { healed: false, detail: "Em dashes found but could not patch." };

  const relPaths = fixed.map(f => `"${f}"`).join(" ");
  const result = commitAndPush(
    fixed,
    `Auto-heal: replace em dashes with ~ in ${fixed.length} file(s)\n\nFiles: ${fixed.join(", ")}\nTier 1 fix ~ deterministic, no AI.\n\nCo-Authored-By: Claude Haiku <noreply@anthropic.com>`
  );

  if (!result.ok && result.note !== "nothing to commit") {
    return { healed: false, detail: `Patched ${fixed.length} file(s) but push failed: ${result.note}`, files: fixed };
  }

  return {
    healed: true,
    detail: `Replaced em dashes with ~ in ${fixed.length} file(s): ${fixed.join(", ")}`,
    files: fixed,
  };
}

// ── Tier 2/3: Claude diagnosis ────────────────────────────────────────────────

async function askClaude(failingChecks) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = createAnthropicClient({ apiKey, label: "auto-heal" });

  const healthJson = JSON.stringify(readJson(HEALTH_FILE) || {}, null, 2);
  const syndicateSnip = readHead(path.join(ROOT, "scripts", "syndicate.js"), 80);
  const dripSnip      = readHead(path.join(ROOT, "scripts", "drip-publish.js"), 60);

  const failureSummary = failingChecks
    .map(c => `- ${c.name}: ${c.detail || "no detail"}`)
    .join("\n");

  const prompt = `You are the automated self-healing system for "Vibration of Awesome" (vibrationofawesome.com), a Node.js/ESM blog and social syndication platform.

FAILING HEALTH CHECKS:
${failureSummary}

== FULL HEALTH JSON ==
${healthJson}

== syndicate.js (first 80 lines) ==
${syndicateSnip}

== drip-publish.js (first 60 lines) ==
${dripSnip}

Diagnose the root cause of each failure and return ONLY a valid JSON array with one object per failing check. No markdown fences, no extra text.

Each object must have exactly:
{
  "checkName": "exact name from FAILING HEALTH CHECKS",
  "diagnosis": "one sentence root cause",
  "fix_type": "code_patch|config_update|token_expired|platform_outage|human_required",
  "confidence": "high|medium|low",
  "action": {}
}

action depends on fix_type:
- code_patch: {"file": "scripts/filename.js", "old_code": "exact verbatim substring to replace", "new_code": "replacement", "explanation": "one line"}
- config_update: {"secret_name": "SECRET_NAME", "new_value": "value", "reason": "why"}
- token_expired: {"token_name": "SECRET_NAME", "renewal_command": "npm run blogger-token OR npm run fb-token"}
- platform_outage: {"platform": "name", "retry_in_hours": 2}
- human_required: {"instructions": "numbered steps"}

Safety rules:
1. Only return confidence "high" for code_patch if old_code is verbatim from the file excerpts shown above.
2. Never invent secret values for config_update.
3. When uncertain, use human_required.
4. code_patch files must be in: ${[...PATCHABLE_FILES].join(", ")}`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    let text = msg.content[0].text.trim();
    // Strip markdown fences if present
    text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(text);
  } catch (e) {
    console.error(`[Claude] Error: ${e.message}`);
    return null;
  }
}

// ── Code patch application ────────────────────────────────────────────────────

function applyCodePatch(fileRel, oldCode, newCode) {
  if (!PATCHABLE_FILES.has(fileRel)) {
    return { ok: false, note: `${fileRel} not in patchable allow-list` };
  }
  const filePath = path.join(ROOT, fileRel);
  if (!fs.existsSync(filePath)) return { ok: false, note: "file not found" };
  const content = fs.readFileSync(filePath, "utf8");
  if (!content.includes(oldCode)) {
    return { ok: false, note: "old_code not found verbatim in file (already patched or wrong excerpt)" };
  }
  fs.writeFileSync(filePath, content.replace(oldCode, newCode), "utf8");
  return { ok: true };
}

// ── Re-trigger drip ───────────────────────────────────────────────────────────

function retriggerDrip() {
  const res = run(`gh workflow run drip-posts.yml --repo ${GH_REPO}`);
  if (res.ok) {
    console.log("[HEAL] Drip re-triggered successfully.");
    return true;
  }
  console.log(`[HEAL] Could not re-trigger drip: ${res.out}`);
  return false;
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendEmail(subject, body) {
  const gmailUser = process.env.GMAIL_ADDRESS;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    console.log("[HEAL] Email credentials not configured ~ skipping notification.");
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from: gmailUser,
      to: ALERT_TO,
      subject,
      text: body,
    });
    console.log(`[HEAL] Email sent: ${subject}`);
  } catch (e) {
    console.error(`[HEAL] Email failed: ${e.message}`);
  }
}

// ── Build email body ──────────────────────────────────────────────────────────

function buildEmailBody({ trigger, tier1Result, tier2Results, retriggered }) {
  const ts = new Date().toUTCString();
  const lines = [
    "Vibration of Awesome ~ Auto-Heal Report",
    `Time: ${ts}`,
    FAILED_WORKFLOW ? `Triggered by: ${FAILED_WORKFLOW} failure` : "Triggered by: scheduled health check",
    FAILED_RUN_URL ? `Failed run: ${FAILED_RUN_URL}` : "",
    "",
  ].filter(l => l !== null && (l !== "" || true));

  // Tier 1
  lines.push("── Tier 1: Em-Dash Check ──");
  if (tier1Result.healed) {
    lines.push("  SELF-HEALED ~");
    lines.push(`  Fixed files: ${(tier1Result.files || []).join(", ")}`);
    if (retriggered) lines.push("  Drip re-triggered to resume publishing.");
  } else {
    lines.push(`  ${tier1Result.detail}`);
  }
  lines.push("");

  // Tier 2/3
  if (tier2Results && tier2Results.length > 0) {
    lines.push("── Tier 2/3: Platform Health Diagnoses ──");
    for (const r of tier2Results) {
      lines.push(`  ${r.checkName}`);
      lines.push(`    Diagnosis: ${r.diagnosis}`);
      lines.push(`    Fix type:  ${r.fix_type} (confidence: ${r.confidence})`);
      if (r.appliedPatch) {
        lines.push(`    SELF-HEALED ~ Code patch applied to ${r.action?.file}`);
        lines.push(`    Change: ${r.action?.explanation}`);
      } else if (r.fix_type === "auth_reconnect_required") {
        lines.push(`    REAUTH REQUIRED (AI cannot repair): ${r.action?.instructions || r.diagnosis}`);
      } else if (r.fix_type === "token_expired") {
        lines.push(`    ACTION NEEDED: Run locally ~ ${r.action?.renewal_command}`);
      } else if (r.fix_type === "platform_outage") {
        lines.push(`    Platform outage ~ retry in ~${r.action?.retry_in_hours}h, no action needed.`);
      } else if (r.fix_type === "human_required") {
        lines.push(`    ACTION NEEDED: ${r.action?.instructions}`);
      } else if (r.patchFailed) {
        lines.push(`    Patch attempted but failed: ${r.patchNote}`);
        lines.push(`    Manual investigation required.`);
      } else {
        lines.push(`    Low confidence ~ manual investigation recommended.`);
      }
      lines.push("");
    }
  } else {
    lines.push("── Platform Health ──");
    lines.push("  All health checks passed.");
    lines.push("");
  }

  lines.push("~ VOA Auto-Healer");
  return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[HEAL] VOA Self-Healer starting...");
  console.log(`[HEAL] Trigger: ${FAILED_WORKFLOW || "scheduled/manual"}`);

  const cooldown = checkHealCooldown();
  if (cooldown.blocked) {
    console.log(`[HEAL] ${cooldown.reason}`);
    console.log(`AUTOHEAL_STATUS=${cooldown.status}`);
    return;
  }

  // Timestamp file is written only when a run actually executes (below, after
  // the run completes) ~ never on a skip, so the cooldown always measures from
  // the last real run, not from a skip that did nothing.
  const healRecord = {
    healedAt: new Date().toISOString(),
    trigger: FAILED_WORKFLOW || "scheduled",
    failedRunUrl: FAILED_RUN_URL || null,
    tier1: null,
    tier2: [],
    retriggered: false,
  };

  // ── Tier 1: Em-dash ───────────────────────────────────────────────────────
  console.log("[HEAL] Running Tier 1: em-dash scan...");
  const tier1Result = tier1EmDashFix();
  healRecord.tier1 = tier1Result;
  console.log(`[HEAL] Tier 1: ${tier1Result.healed ? "HEALED" : "clean"} ~ ${tier1Result.detail}`);

  // If we fixed em dashes, re-trigger the drip (that's why it failed)
  let retriggered = false;
  if (tier1Result.healed && FAILED_WORKFLOW?.includes("Drip")) {
    retriggered = retriggerDrip();
    healRecord.retriggered = retriggered;
  }

  // ── Run fresh health check ────────────────────────────────────────────────
  console.log("[HEAL] Running fresh syndication health check...");
  run("npm run check:syndication -- --write", { silent: false });

  const health = readJson(HEALTH_FILE);
  const failingChecks = (health?.checks || []).filter(c => !c.ok);
  console.log(`[HEAL] Health: ${failingChecks.length} failing check(s)`);

  // ── Tier 2/3: Claude diagnosis ────────────────────────────────────────────
  let tier2Results = [];
  if (failingChecks.length > 0) {
    // Split: auth failures are pre-classified deterministically (no AI call).
    // Only non-auth failures (code/config/transient) go to Claude.
    const authFailures    = failingChecks.filter(isAuthFailure);
    const healableFailures = failingChecks.filter(c => !isAuthFailure(c));

    // Pre-classify auth failures without spending Claude credits
    for (const c of authFailures) {
      const diag = buildAuthFailureDiagnosis(c);
      console.log(`[HEAL] ${diag.checkName}: auth_reconnect_required (pre-classified, no AI call)`);
      tier2Results.push(diag);
      healRecord.tier2.push(diag);
    }

    if (healableFailures.length > 0) {
      console.log(`[HEAL] Consulting Claude for ${healableFailures.length} non-auth failure(s)...`);
      const claudeResponse = await askClaude(healableFailures);

      if (claudeResponse && Array.isArray(claudeResponse)) {
        for (const diagnosis of claudeResponse) {
          console.log(`[HEAL] ${diagnosis.checkName}: ${diagnosis.fix_type} (${diagnosis.confidence})`);

          if (
            diagnosis.fix_type === "code_patch" &&
            diagnosis.confidence === "high" &&
            diagnosis.action?.file &&
            diagnosis.action?.old_code &&
            diagnosis.action?.new_code
          ) {
            const patchResult = applyCodePatch(
              diagnosis.action.file,
              diagnosis.action.old_code,
              diagnosis.action.new_code
            );
            if (patchResult.ok) {
              const commitResult = commitAndPush(
                [diagnosis.action.file],
                `Auto-heal: ${diagnosis.checkName} ~ ${diagnosis.action.explanation || "code patch"}\n\nDiagnosis: ${diagnosis.diagnosis}\n\nCo-Authored-By: Claude Haiku <noreply@anthropic.com>`
              );
              diagnosis.appliedPatch = commitResult.ok || commitResult.note === "nothing to commit";
              diagnosis.patchFailed  = !diagnosis.appliedPatch;
              diagnosis.patchNote    = commitResult.note;
            } else {
              diagnosis.appliedPatch = false;
              diagnosis.patchFailed  = true;
              diagnosis.patchNote    = patchResult.note;
            }
          }

          tier2Results.push(diagnosis);
          healRecord.tier2.push(diagnosis);
        }
      } else {
        console.log("[HEAL] Claude unavailable or returned unparseable response.");
        const fallback = healableFailures.map(c => ({
          checkName: c.name,
          diagnosis: c.detail || "unknown error",
          fix_type: "human_required",
          confidence: "low",
          action: { instructions: `Check ${c.name} manually. Detail: ${c.detail}` },
        }));
        tier2Results.push(...fallback);
        healRecord.tier2.push(...fallback);
      }
    } else {
      console.log(`[HEAL] All ${authFailures.length} failure(s) are auth-related. Skipping Claude call ~ no credits spent.`);
    }
  }

  // ── Persist heal log ──────────────────────────────────────────────────────
  const healLog = readJson(HEAL_LOG_FILE) || [];
  healLog.push(healRecord);
  // Keep last 50 entries
  const trimmed = healLog.slice(-50);
  writeJson(HEAL_LOG_FILE, trimmed);

  // Cooldown timestamp: only written here, on an actual completed run ~ never
  // on a skip (see checkHealCooldown() above), so a skip never resets the clock.
  fs.writeFileSync(TIMESTAMP_FILE, healRecord.healedAt, "utf8");

  gitConfig();
  run(`git add "${HEAL_LOG_FILE}" "${TIMESTAMP_FILE}"`);
  const staged = spawnSync("git", ["diff", "--staged", "--quiet"], { cwd: ROOT });
  if (staged.status !== 0) {
    const tmpMsg = path.join(ROOT, ".git", "HEALLOG_MSG");
    fs.writeFileSync(tmpMsg, `Auto: heal log ${new Date().toISOString().slice(0, 10)} [automated]`, "utf8");
    run(`git commit -F "${tmpMsg}"`);
    try { fs.unlinkSync(tmpMsg); } catch {}
    run("git fetch origin main");
    run("git merge --no-edit -X ours origin/main");
    run("git push");
  }

  console.log("AUTOHEAL_STATUS=ran");

  // ── Email summary ─────────────────────────────────────────────────────────
  const anyHealed    = tier1Result.healed || tier2Results.some(r => r.appliedPatch);
  const anyNeedsHuman = tier2Results.some(r =>
    r.fix_type === "token_expired" ||
    r.fix_type === "human_required" ||
    r.fix_type === "auth_reconnect_required" ||
    r.patchFailed
  );

  let subject;
  if (anyHealed && !anyNeedsHuman) {
    subject = `VOA Self-Healed ~ engine back online`;
  } else if (anyHealed && anyNeedsHuman) {
    subject = `VOA Partial Heal ~ some issues need your attention`;
  } else if (failingChecks.length > 0 || FAILED_WORKFLOW) {
    subject = `VOA Needs Attention ~ health check failed`;
  } else {
    subject = `VOA Health Check ~ all systems nominal`;
  }

  const emailBody = buildEmailBody({ trigger: FAILED_WORKFLOW, tier1Result, tier2Results, retriggered });
  await sendEmail(subject, emailBody);

  // ── Exit code ─────────────────────────────────────────────────────────────
  const stillBroken = failingChecks.length > 0 && !tier2Results.every(r => r.appliedPatch);
  if (stillBroken && !tier1Result.healed) {
    console.log("[HEAL] Some issues remain unresolved ~ recorded as needs-attention without failing the watchdog workflow.");
    console.log("AUTOHEAL_RESULT=needs-attention");
    return;
  }
  console.log("[HEAL] Done.");
}

// CLI-only guard: without this, merely `import`-ing this module (from a test,
// another script, or a syntax/load check) executes a real run with real side
// effects. See CLAUDE.md ~ every script with a top-level main() needs this.
const __voaIsCli = process.argv[1] && import.meta.url === __voaPathToFileURL(process.argv[1]).href;
if (__voaIsCli) {
  main().catch(e => {
    console.error(`[HEAL] Fatal: ${e.message}`);
    process.exit(1);
  });
}
