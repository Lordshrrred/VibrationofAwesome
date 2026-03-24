"""
get_blogger_token.py
Obtain a Google OAuth 2.0 refresh token for the Blogger API.

Usage:
    python scripts/get_blogger_token.py

Requirements:
    pip install google-auth-oauthlib

Expects in .env (or as environment variables):
    BLOGGER_CLIENT_ID
    BLOGGER_CLIENT_SECRET

Writes to .env (appends/updates):
    BLOGGER_REFRESH_TOKEN
"""

import os
import sys
import json
import urllib.parse
import urllib.request

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
CLIENT_ID     = os.environ.get('BLOGGER_CLIENT_ID', '')
CLIENT_SECRET = os.environ.get('BLOGGER_CLIENT_SECRET', '')
REDIRECT_URI  = 'urn:ietf:wg:oauth:2.0:oob'   # manual copy/paste flow
SCOPE         = 'https://www.googleapis.com/auth/blogger'
AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

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

def main():
    if not CLIENT_ID or not CLIENT_SECRET:
        print('ERROR: BLOGGER_CLIENT_ID and BLOGGER_CLIENT_SECRET must be set in .env')
        sys.exit(1)

    auth_url = build_auth_url()

    print()
    print('=' * 70)
    print('  BLOGGER OAUTH — manual authorization')
    print('=' * 70)
    print()
    print('Open this URL in Microsoft Edge:')
    print()
    print(f'  {auth_url}')
    print()
    print('Sign in with the Google account that owns the Blogger blog.')
    print('After approving, Google will show you an authorization code.')
    print()

    auth_code = input('Paste the authorization code here and press Enter: ').strip()

    if not auth_code:
        print('ERROR: No code entered.')
        sys.exit(1)

    print()
    print('Exchanging code for tokens...')

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

    save_token_to_env(refresh_token)

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
