#!/usr/bin/env python3
"""웹과 Persona가 게시한 scores.json 버전을 함께 읽었는지 확인한다."""

from __future__ import annotations

import argparse
import json
import sys
import time
from urllib.error import URLError
from urllib.parse import quote, urljoin
from urllib.request import urlopen


def metadata(url: str) -> dict:
    with urlopen(url, timeout=3) as response:
        payload = json.load(response)
    value = payload.get("generatedAt")
    if not isinstance(value, str) or not value:
        raise ValueError(f"generatedAt이 없는 응답입니다: {url}")
    return payload


def smoke(url: str) -> None:
    with urlopen(url, timeout=10) as response:
        if not 200 <= response.status < 300:
            raise ValueError(f"HTTP {response.status}: {url}")
        if not response.read():
            raise ValueError(f"빈 응답입니다: {url}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expected", required=True)
    parser.add_argument("--web-url", required=True)
    parser.add_argument("--persona-url", required=True)
    parser.add_argument("--expected-source", default="sec-toss")
    parser.add_argument("--expected-companies", type=int, required=True)
    parser.add_argument("--timeout", type=float, default=20)
    args = parser.parse_args()

    deadline = time.monotonic() + args.timeout
    last = ""
    while time.monotonic() < deadline:
        try:
            web = metadata(args.web_url)
            persona = metadata(args.persona_url)
            versions_match = web["generatedAt"] == persona["generatedAt"] == args.expected
            metadata_match = (
                web.get("dataSource") == persona.get("dataSource") == args.expected_source and
                web.get("companies") == persona.get("companies") == args.expected_companies
            )
            ticker = web.get("sampleTicker")
            if versions_match and metadata_match and isinstance(ticker, str) and ticker:
                base = urljoin(args.web_url, "/")
                smoke(base)
                smoke(urljoin(base, "screener/buffett"))
                smoke(urljoin(base, f"stocks/{quote(ticker, safe='')}"))
                print(args.expected)
                return
            last = (
                f"web={web.get('generatedAt')}/{web.get('dataSource')}/{web.get('companies')}, "
                f"persona={persona.get('generatedAt')}/{persona.get('dataSource')}/"
                f"{persona.get('companies')}, expected={args.expected}/"
                f"{args.expected_source}/{args.expected_companies}"
            )
        except (OSError, URLError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
            last = str(exc)
        time.sleep(0.5)

    print(f"런타임 데이터 버전을 확인하지 못했습니다: {last}", file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    main()
