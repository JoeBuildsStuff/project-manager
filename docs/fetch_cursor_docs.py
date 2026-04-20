#!/usr/bin/env python3
"""
Fetch web pages with Firecrawl and write markdown under a base directory,
mirroring each URL’s path (e.g. https://example.com/docs/cli/foo ->
<output-dir>/docs/cli/foo/index.md).

Examples:
  python fetch_cursor_docs.py https://example.com/page
  python fetch_cursor_docs.py -o ./out https://a.com/x https://b.com/y

Default output base is this script’s directory (the repo docs/ folder).
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def load_dotenv_if_available() -> None:
    """Try python-dotenv first; otherwise parse a local .env file."""
    script_dir = Path(__file__).resolve().parent
    candidate_env_files = [
        script_dir / ".env",
        script_dir.parent / ".env",
    ]

    try:
        from dotenv import load_dotenv  # type: ignore

        for env_path in candidate_env_files:
            if env_path.exists():
                load_dotenv(env_path)
        return
    except Exception:
        pass

    for env_path in candidate_env_files:
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def path_for_url(base_dir: Path, url: str) -> Path:
    parsed = urlparse(url)
    path = (parsed.path or "").strip("/")
    if not path:
        return base_dir / "index.md"
    return base_dir / path / "index.md"


def extract_markdown(data: Any) -> str:
    markdown_attr = getattr(data, "markdown", None)
    if isinstance(markdown_attr, str) and markdown_attr.strip():
        return markdown_attr

    if hasattr(data, "model_dump"):
        dumped = data.model_dump()
        markdown = dumped.get("markdown")
        if isinstance(markdown, str) and markdown.strip():
            return markdown

    if isinstance(data, dict):
        markdown = data.get("markdown")
        if isinstance(markdown, str) and markdown.strip():
            return markdown

        payload = data.get("data")
        if isinstance(payload, dict):
            markdown = payload.get("markdown")
            if isinstance(markdown, str) and markdown.strip():
                return markdown

    if isinstance(data, str) and data.strip():
        return data

    raise ValueError("No markdown content found in Firecrawl response.")


def parse_args() -> argparse.Namespace:
    script_dir = Path(__file__).resolve().parent

    parser = argparse.ArgumentParser(
        description="Scrape URLs with Firecrawl and save markdown mirroring each URL path.",
    )
    parser.add_argument(
        "urls",
        nargs="+",
        metavar="URL",
        help="One or more page URLs.",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=script_dir,
        help=f"Base directory for output (default: {script_dir}, i.e. repo docs/)",
    )
    return parser.parse_args()


def main() -> None:
    load_dotenv_if_available()
    args = parse_args()

    urls = list(args.urls)
    output_base = args.output_dir.expanduser().resolve()
    output_base.mkdir(parents=True, exist_ok=True)

    api_key = os.getenv("FIRECRAWL_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Missing FIRECRAWL_API_KEY. Add it to docs/.env or your environment.")

    try:
        from firecrawl import Firecrawl  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "Could not import Firecrawl. Install with: pip install firecrawl-py"
        ) from exc

    app = Firecrawl(api_key=api_key)

    script_dir = Path(__file__).resolve().parent
    successes = 0
    failures = 0

    for url in urls:
        out_file = path_for_url(output_base, url)
        out_file.parent.mkdir(parents=True, exist_ok=True)

        print(f"Scraping: {url}")
        try:
            data = app.scrape(
                url,
                only_main_content=False,
                max_age=172800000,
                formats=["markdown"],
            )
            markdown = extract_markdown(data)
            out_file.write_text(markdown, encoding="utf-8")
            try:
                rel = out_file.relative_to(script_dir)
            except ValueError:
                rel = out_file
            print(f"  Saved: {rel}")
            successes += 1
        except Exception as exc:
            print(f"  Failed: {url} -> {exc}")
            failures += 1

    print(f"\nDone. Success: {successes}, Failed: {failures}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
