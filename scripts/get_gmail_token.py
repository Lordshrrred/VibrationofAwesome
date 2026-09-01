"""
get_gmail_token.py
Obtain a Gmail OAuth 2.0 refresh token (read + alert-send scopes).

Usage:
    python3 scripts/get_gmail_token.py

Expects in .env:
    GMAIL_CLIENT_ID
    GMAIL_CLIENT_SECRET

Writes to .env:
    GMAIL_REFRESH_TOKEN

Also sets GitHub secret GMAIL_REFRESH_TOKEN if gh CLI is available.
"""

import os, sys, json, webbrowser, urllib.parse, urllib.request
import http.server, threading, subprocess, re
from pathlib import Path

ROOT     = Path(__file__).parent.parent
ENV_FILE = ROOT / ".env"
PORT     = 8765
REDIRECT = f"http://localhost:{PORT}/callback"
SCOPES   = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send"

# ── Load .env ────────────────────────────────────────────────────────────────
def load_env():
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

def save_env_key(key, value):
    content = ENV_FILE.read_text() if ENV_FILE.exists() else ""
    pattern = rf"^{re.escape(key)}=.*$"
    new_line = f"{key}={value}"
    if re.search(pattern, content, re.MULTILINE):
        content = re.sub(pattern, new_line, content, flags=re.MULTILINE)
    else:
        content = content.rstrip("\n") + f"\n{new_line}\n"
    ENV_FILE.write_text(content)
    print(f"  Saved {key} to .env")

def sync_github_secret(key, value):
    try:
        result = subprocess.run(
            ["gh", "secret", "set", key, "--body", value],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            print(f"  GitHub secret {key} updated via gh CLI")
        else:
            print(f"  gh CLI failed: {result.stderr.strip()}")
    except Exception as e:
        print(f"  gh CLI unavailable: {e}")

# ── OAuth flow ────────────────────────────────────────────────────────────────
auth_code  = None
auth_error = None

class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code, auth_error
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        if "code" in params:
            auth_code = params["code"][0]
            body = b"<h2>Auth successful! Return to your terminal.</h2>"
        else:
            auth_error = params.get("error", ["unknown"])[0]
            body = f"<h2>Auth error: {auth_error}</h2>".encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *args): pass

def exchange_code(client_id, client_secret, code):
    data = urllib.parse.urlencode({
        "code":          code,
        "client_id":     client_id,
        "client_secret": client_secret,
        "redirect_uri":  REDIRECT,
        "grant_type":    "authorization_code",
    }).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def main():
    env = load_env()
    client_id     = env.get("GMAIL_CLIENT_ID", "").strip()
    client_secret = env.get("GMAIL_CLIENT_SECRET", "").strip()

    if not client_id or not client_secret:
        print("ERROR: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env")
        sys.exit(1)

    # Start local callback server
    server = http.server.HTTPServer(("localhost", PORT), CallbackHandler)
    thread = threading.Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()

    # Build auth URL
    params = urllib.parse.urlencode({
        "client_id":     client_id,
        "redirect_uri":  REDIRECT,
        "response_type": "code",
        "scope":         SCOPES,
        "access_type":   "offline",
        "prompt":        "consent",
    })
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{params}"

    print("\nOpening Safari for Gmail authorization...")
    print(f"URL: {auth_url}\n")
    try:
        subprocess.Popen(["open", "-a", "Safari", auth_url])
    except Exception:
        webbrowser.open(auth_url)
    print("Waiting for callback on http://localhost:8765/callback ...")

    # Wait for auth
    import time
    for _ in range(120):
        if auth_code or auth_error:
            break
        time.sleep(1)

    server.shutdown()

    if auth_error:
        print(f"\nERROR: Authorization failed: {auth_error}")
        sys.exit(1)
    if not auth_code:
        print("\nERROR: Timed out waiting for authorization.")
        sys.exit(1)

    print("  Got authorization code, exchanging for tokens...")
    tokens = exchange_code(client_id, client_secret, auth_code)

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        print(f"ERROR: No refresh_token in response: {tokens}")
        sys.exit(1)

    save_env_key("GMAIL_REFRESH_TOKEN", refresh_token)
    sync_github_secret("GMAIL_REFRESH_TOKEN", refresh_token)

    print("\n" + "=" * 60)
    print("  SUCCESS — Gmail refresh token saved.")
    print("  Run 'npm run push:vercel-env' to push to Vercel if needed.")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    main()
