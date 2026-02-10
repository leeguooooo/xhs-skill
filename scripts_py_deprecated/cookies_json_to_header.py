#!/usr/bin/env python3
import argparse
import json
import sys


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Convert JSON cookie list to Cookie header string")
    ap.add_argument("--in", dest="in_path", required=True, help="Input JSON file")
    args = ap.parse_args(argv)

    with open(args.in_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    cookies = data.get("cookies") if isinstance(data, dict) else None
    if not isinstance(cookies, list):
        print("Invalid format: expected {cookies: [...]}.", file=sys.stderr)
        return 2

    pairs = []
    for c in cookies:
        if not isinstance(c, dict):
            continue
        name = str(c.get("name", "")).strip()
        value = str(c.get("value", "")).strip()
        if not name:
            continue
        pairs.append(f"{name}={value}")

    if not pairs:
        print("No cookie pairs found.", file=sys.stderr)
        return 2

    print("Cookie: " + "; ".join(pairs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
