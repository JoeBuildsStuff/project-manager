#!/usr/bin/env python3
"""
Trim repeated Apple Developer boilerplate from scraped markdown files.

Targets files under:
  docs/apple/documentation/security/**/index.md

Keeps the main content block starting at the first top-level heading "# "
and ends before the repeated footer (starting with "Current page is ").
"""

from __future__ import annotations

import argparse
from pathlib import Path


def clean_markdown(text: str) -> tuple[str, bool]:
    lines = text.splitlines()
    if not lines:
        return text, False

    start_idx = next((i for i, line in enumerate(lines) if line.startswith("# ")), None)
    if start_idx is None:
        return text, False

    end_markers = (
        "Current page is ",
        "[Apple]",
    )
    end_idx = next(
        (
            i
            for i, line in enumerate(lines[start_idx + 1 :], start_idx + 1)
            if any(line.startswith(marker) for marker in end_markers)
        ),
        None,
    )

    trimmed = lines[start_idx:end_idx] if end_idx is not None else lines[start_idx:]
    cleaned = "\n".join(trimmed).strip() + "\n"
    return cleaned, cleaned != text


def iter_target_files(root: Path) -> list[Path]:
    return sorted(root.glob("**/documentation/security/**/index.md"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean Apple scraped markdown boilerplate.")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Base docs/apple directory (default: this script's directory).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report files that would change without writing them.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = args.root.expanduser().resolve()
    files = iter_target_files(root)

    changed = 0
    unchanged = 0

    for path in files:
        original = path.read_text(encoding="utf-8")
        cleaned, did_change = clean_markdown(original)
        if did_change:
            changed += 1
            if not args.dry_run:
                path.write_text(cleaned, encoding="utf-8")
            print(f"changed: {path.relative_to(root)}")
        else:
            unchanged += 1

    mode = "dry-run" if args.dry_run else "write"
    print(f"\nDone ({mode}). Changed: {changed}, Unchanged: {unchanged}, Total: {len(files)}")


if __name__ == "__main__":
    main()
