#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
AUTH_BASE = "https://public-api.wordpress.com/oauth2"
ME_URL = "https://public-api.wordpress.com/rest/v1.1/me"
DEFAULT_SCOPE = "posts media"


def load_env() -> None:
    env_file = ROOT / ".env"
    if env_file.exists():
        load_dotenv(env_file, override=False)


def env_clean(key: str, default: str = "") -> str:
    val = os.getenv(key, default)
    if not isinstance(val, str):
        return default
    val = val.strip()
    if len(val) >= 2 and (
        (val[0] == '"' and val[-1] == '"') or
        (val[0] == "'" and val[-1] == "'")
    ):
        val = val[1:-1].strip()
    return val


def update_env_var(key: str, value: str) -> None:
    env_file = ROOT / ".env"
    existing = env_file.read_text(encoding="utf-8") if env_file.exists() else ""
    lines = existing.splitlines()
    updated = False
    for idx, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[idx] = f"{key}={value}"
            updated = True
            break
    if not updated:
        lines.append(f"{key}={value}")
    env_file.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"Saved {key} to {env_file}")


def extract_code(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    if raw.startswith("http://") or raw.startswith("https://"):
        parsed = urlparse(raw)
        return parse_qs(parsed.query).get("code", [""])[0]
    return raw


def require_creds(client_id: str, client_secret: str) -> list[str]:
    missing = []
    if not client_id:
        missing.append("WORDPRESS_CLIENT_ID")
    if not client_secret:
        missing.append("WORDPRESS_CLIENT_SECRET")
    return missing


def main() -> int:
    load_env()

    parser = argparse.ArgumentParser(
        description="Get or verify a WordPress.com OAuth2 token for direct REST API publishing."
    )
    parser.add_argument(
        "--flow",
        choices=["password", "auth-url", "exchange", "verify"],
        default="password",
        help="OAuth helper flow. Default: password",
    )
    parser.add_argument("--write-env", action="store_true", help="Write WORDPRESS_OAUTH2_TOKEN to repo .env")
    parser.add_argument("--code", default="", help="Authorization code or full callback URL for exchange flow")
    parser.add_argument("--scope", default=env_clean("WORDPRESS_SCOPE", DEFAULT_SCOPE), help="OAuth scope")
    parser.add_argument(
        "--redirect-uri",
        default=env_clean("WORDPRESS_REDIRECT_URI", "http://localhost:9878/callback"),
        help="Must exactly match your WordPress.com application redirect URI",
    )
    parser.add_argument(
        "--blog",
        default=env_clean("WORDPRESS_BLOG", env_clean("WORDPRESS_SITE_URL")),
        help="WordPress.com site URL or blog id",
    )
    args = parser.parse_args()

    client_id = env_clean("WORDPRESS_CLIENT_ID")
    client_secret = env_clean("WORDPRESS_CLIENT_SECRET")
    username = env_clean("WORDPRESS_USERNAME")
    app_password = env_clean("WORDPRESS_APPLICATION_PASSWORD")
    access_token = env_clean("WORDPRESS_OAUTH2_TOKEN")

    if args.flow == "auth-url":
        missing = require_creds(client_id, client_secret)
        if missing:
            print("Missing env vars:", ", ".join(missing))
            return 1
        query = {
            "client_id": client_id,
            "redirect_uri": args.redirect_uri,
            "response_type": "code",
            "scope": args.scope,
            "state": "voa-wordpress-api",
        }
        if args.blog:
            query["blog"] = args.blog
        print(f"{AUTH_BASE}/authorize?{urlencode(query)}")
        return 0

    if args.flow == "exchange":
        missing = require_creds(client_id, client_secret)
        if missing:
            print("Missing env vars:", ", ".join(missing))
            return 1
        code = extract_code(args.code)
        if not code:
            print("Missing --code. Paste either the raw code or the full callback URL.")
            return 1
        resp = requests.post(
            f"{AUTH_BASE}/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": args.redirect_uri,
            },
            timeout=30,
        )
        data = resp.json()
        if not resp.ok:
            print(json.dumps(data, indent=2))
            return 1
        access_token = data.get("access_token", "")
        print("WORDPRESS_OAUTH2_TOKEN=" + access_token)
        print("BLOG_ID=" + str(data.get("blog_id", "")))
        print("BLOG_URL=" + str(data.get("blog_url", "")))
        if args.write_env and access_token:
            update_env_var("WORDPRESS_OAUTH2_TOKEN", access_token)
        return 0

    if args.flow == "verify":
        if not access_token:
            print("Missing WORDPRESS_OAUTH2_TOKEN")
            return 1
        resp = requests.get(
            ME_URL,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            timeout=30,
        )
        data = resp.json()
        print(json.dumps(data, indent=2))
        return 0 if resp.ok else 1

    missing = [
        name
        for name, value in [
            ("WORDPRESS_CLIENT_ID", client_id),
            ("WORDPRESS_CLIENT_SECRET", client_secret),
            ("WORDPRESS_USERNAME", username),
            ("WORDPRESS_APPLICATION_PASSWORD", app_password),
        ]
        if not value
    ]
    if missing:
        print("Missing env vars:", ", ".join(missing))
        return 1

    resp = requests.post(
        f"{AUTH_BASE}/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "password",
            "username": username,
            "password": app_password,
        },
        timeout=30,
    )
    data = resp.json()
    if not resp.ok:
        print(json.dumps(data, indent=2))
        return 1

    access_token = data.get("access_token", "")
    print("WORDPRESS_OAUTH2_TOKEN=" + access_token)
    print("BLOG_ID=" + str(data.get("blog_id", "")))
    print("BLOG_URL=" + str(data.get("blog_url", "")))
    if args.write_env and access_token:
        update_env_var("WORDPRESS_OAUTH2_TOKEN", access_token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
