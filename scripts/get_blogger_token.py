"""
get_blogger_token.py
Obtain a Google OAuth 2.0 refresh token for the Blogger API.

Usage:
    python scripts/get_blogger_token.py

Requirements:
    No third-party packages ~ stdlib only.

Expects in .env (or as environment variables):
    BLOGGER_CLIENT_ID
    BLOGGER_CLIENT_SECRET

Writes to .env (appends/updates):
    BLOGGER_REFRESH_TOKEN

If the GitHub CLI is authenticated for this repo, also updates:
    GitHub Secret BLOGGER_REFRESH_TOKEN
"""

import os
import sys
import json
import webbrowser
import urllib.parse
import urllib.request
import http.server
import threading
import subprocess

# ── Load .env manually (no dotenv dependency required) ──────────────────
def load_dotenv(path='.env'):
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, val = line.partition('=')
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

load_dotenv()

# ── Config ───────────────────────────────────────────────────────────────
CLIENT_ID      = os.environ.get('BLOGGER_CLIENT_ID', '')
CLIENT_SECRET  = os.environ.get('BLOGGER_CLIENT_SECRET', '')
REDIRECT_URI   = 'http://localhost:8080/'
SCOPE          = 'https://www.googleapis.com/auth/blogger'
AUTH_ENDPOINT  = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
BLOGGER_API    = 'https://www.googleapis.com/blogger/v3'

# ── Localhost callback server ─────────────────────────────────────────────

_captured_code  = None
_captured_error = None

class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global _captured_code, _captured_error
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if 'code' in params:
            _captured_code = params['code'][0]
            body = b'<h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p>'
            self.send_response(200)
        elif 'error' in params:
            _captured_error = params.get('error', ['unknown'])[0]
            msg = f'Authorization failed: {_captured_error}'.encode()
            body = b'<h1>' + msg + b'</h1><p>You can close this tab.</p>'
            self.send_response(400)
        else:
            # Ignore favicon / other noise
            self.send_response(204)
            self.end_headers()
            return

        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # suppress server output

def _wait_for_callback():
    """Block until the browser hits localhost:8080 with a code or error."""
    server = http.server.HTTPServer(('localhost', 8080), _CallbackHandler)
    # Keep handling requests until we get the code (ignores favicon etc.)
    while _captured_code is None and _captured_error is None:
        server.handle_request()
    server.server_close()

# ── OAuth helpers ─────────────────────────────────────────────────────────

def build_auth_url():
    params = {
        'client_id':     CLIENT_ID,
        'redirect_uri':  REDIRECT_URI,
        'response_type': 'code',
        'scope':         SCOPE,
        'access_type':   'offline',
        'prompt':        'consent',   # force refresh_token on every auth
    }
    return AUTH_ENDPOINT + '?' + urllib.parse.urlencode(params)

def exchange_code(auth_code):
    data = urllib.parse.urlencode({
        'code':          auth_code.strip(),
        'client_id':     CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'redirect_uri':  REDIRECT_URI,
        'grant_type':    'authorization_code',
    }).encode()
    req = urllib.request.Request(TOKEN_ENDPOINT, data=data,
                                 headers={'Content-Type': 'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def refresh_access_token(refresh_token):
    data = urllib.parse.urlencode({
        'client_id':     CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'refresh_token': refresh_token.strip(),
        'grant_type':    'refresh_token',
    }).encode()
    req = urllib.request.Request(TOKEN_ENDPOINT, data=data,
                                 headers={'Content-Type': 'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def validate_refresh_token(refresh_token):
    token_data = refresh_access_token(refresh_token)
    access_token = token_data.get('access_token')
    if not access_token:
        raise RuntimeError('No access_token returned during validation.')

    blog_id = os.environ.get('BLOGGER_BLOG_ID', '').strip()
    if blog_id:
        req = urllib.request.Request(
            f'{BLOGGER_API}/blogs/{urllib.parse.quote(blog_id)}',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        with urllib.request.urlopen(req) as resp:
            json.loads(resp.read())

    return access_token

def save_token_to_env(refresh_token, env_path='.env'):
    """Append or replace BLOGGER_REFRESH_TOKEN in .env."""
    lines = []
    replaced = False
    if os.path.exists(env_path):
        with open(env_path) as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if line.strip().startswith('BLOGGER_REFRESH_TOKEN='):
                lines[i] = f'BLOGGER_REFRESH_TOKEN={refresh_token}\n'
                replaced = True
    if not replaced:
        lines.append(f'BLOGGER_REFRESH_TOKEN={refresh_token}\n')
    with open(env_path, 'w') as f:
        f.writelines(lines)

def sync_github_secret(refresh_token):
    """Set BLOGGER_REFRESH_TOKEN in GitHub Actions secrets when gh is available."""
    try:
        status = subprocess.run(
            ['gh', 'auth', 'status'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if status.returncode != 0:
            print('GitHub Secret not updated ~ gh is not authenticated.')
            return False

        update = subprocess.run(
            ['gh', 'secret', 'set', 'BLOGGER_REFRESH_TOKEN', '--body', refresh_token],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        if update.returncode != 0:
            print('GitHub Secret not updated ~ gh secret set failed:')
            print(update.stderr.strip() or update.stdout.strip())
            return False

        print('GitHub Secret BLOGGER_REFRESH_TOKEN updated.')
        return True
    except FileNotFoundError:
        print('GitHub Secret not updated ~ gh CLI not installed.')
        return False

# ── Main ──────────────────────────────────────────────────────────────────

def main():
    if not CLIENT_ID or not CLIENT_SECRET:
        print('ERROR: BLOGGER_CLIENT_ID and BLOGGER_CLIENT_SECRET must be set in .env')
        sys.exit(1)

    auth_url = build_auth_url()

    print()
    print('=' * 70)
    print('  BLOGGER OAUTH ~ localhost redirect flow')
    print('=' * 70)
    print()
    print('Opening authorization URL in your browser...')
    print('If it does not open automatically, paste this URL into Edge:')
    print()
    print(f'  {auth_url}')
    print()
    print('Waiting for callback on http://localhost:8080 ...')

    # Try to open the browser; don't fail if it can't
    try:
        webbrowser.open(auth_url)
    except Exception:
        pass

    _wait_for_callback()

    if _captured_error:
        print(f'\nERROR: Authorization denied ~ {_captured_error}')
        sys.exit(1)

    auth_code = _captured_code
    print('Authorization code received. Exchanging for tokens...')

    try:
        token_data = exchange_code(auth_code)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'ERROR: Token exchange failed ({e.code}): {body}')
        sys.exit(1)

    refresh_token = token_data.get('refresh_token')
    access_token  = token_data.get('access_token')

    if not refresh_token:
        print('ERROR: No refresh_token in response. Make sure prompt=consent is set.')
        print('Response:', json.dumps(token_data, indent=2))
        sys.exit(1)

    print('Validating refresh token...')
    try:
        validate_refresh_token(refresh_token)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'ERROR: Refresh token validation failed ({e.code}): {body}')
        sys.exit(1)

    save_token_to_env(refresh_token)
    sync_github_secret(refresh_token)

    print()
    print('=' * 70)
    print('  SUCCESS')
    print('=' * 70)
    print(f'  access_token  : {access_token[:40]}...')
    print(f'  refresh_token : {refresh_token[:40]}...')
    print()
    print('BLOGGER_REFRESH_TOKEN saved to .env')
    print()

if __name__ == '__main__':
    main()
