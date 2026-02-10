#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime


def parse_cookie_string(s: str):
    # Accept both "a=b; c=d" and lines like "a=b\n c=d".
    parts = []
    for chunk in s.replace("\n", ";").split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "=" not in chunk:
            continue
        name, value = chunk.split("=", 1)
        name = name.strip()
        value = value.strip()
        if not name:
            continue
        parts.append({
            "name": name,
            "value": value,
            "domain": ".xiaohongshu.com",
            "path": "/",
            "httpOnly": False,
            "secure": True,
            "sameSite": "Lax",
        })
    return parts


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Convert cookie string to JSON cookie list")
    ap.add_argument("--in", dest="cookie_in", required=True, help="Cookie string like 'a=b; c=d'")
    ap.add_argument("--out", dest="out_path", required=True, help="Output JSON file")
    args = ap.parse_args(argv)

    cookies = parse_cookie_string(args.cookie_in)
    if not cookies:
        print("No cookies parsed. Input may be empty or malformed.", file=sys.stderr)
        return 2

    payload = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "format": "cookie_list",
        "cookies": cookies,
    }
    with open(args.out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote {len(cookies)} cookies to {args.out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
