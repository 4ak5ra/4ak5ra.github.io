#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Build data/posts.json from markdown files under ./posts/**.md

Output fields (minimal):
- id
- title
- slug
- date  (parsed from filename)
- category (first-level folder under posts/)
- tags (from frontmatter, default [])
- md_path (relative for pages/*.html: ../posts/<cat>/<file>.md)
- featuredImage (from frontmatter or default)

Rules:
- slug: filename stem (no .md)
- date: parsed from filename (YYYY-M-D / YYYY-MM-DD / YYYY_M_D / YYYY.M.D)
- mtime/size: used ONLY for cache invalidation
- title: frontmatter.title > first markdown H1 > filename stem
- draft: if true in frontmatter, skip writing to posts.json
- no author/excerpt/summary at all
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
  from zoneinfo import ZoneInfo  # py>=3.9
except Exception:
  ZoneInfo = None


# -------------------------
# paths
# -------------------------
ROOT = Path(__file__).resolve().parents[1]  # web/
POSTS_DIR = ROOT / "posts"
DATA_DIR = ROOT / "data"
OUT_JSON = DATA_DIR / "posts.json"
CACHE_JSON = DATA_DIR / "posts_cache.json"

TZ_NAME = "Europe/Berlin"

DEFAULT_TAGS: List[str] = []
DEFAULT_FEATURED_IMAGE = "/assets/images/btn/posts.jpg"


# -------------------------
# parsing helpers
# -------------------------
DATE_RE = re.compile(r"(?P<y>20\d{2})[-_. ](?P<m>\d{1,2})[-_. ](?P<d>\d{1,2})")
H1_RE = re.compile(r"^\s*#\s+(.+?)\s*$", re.M)
FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.S)


def ensure_dirs() -> None:
  DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_json(path: Path, default):
  if not path.exists():
    return default
  try:
    return json.loads(path.read_text(encoding="utf-8"))
  except Exception:
    return default


def save_json(path: Path, obj: Any) -> None:
  path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def norm_rel(path: Path) -> str:
  return str(path).replace(os.sep, "/")


def parse_date_from_filename(stem: str) -> Optional[datetime]:
  """
  Extract YYYY-M-D from filename stem and return timezone-aware datetime at 10:00.
  """
  m = DATE_RE.search(stem)
  if not m:
    return None

  y = int(m.group("y"))
  mo = int(m.group("m"))
  d = int(m.group("d"))

  dt = datetime(y, mo, d, 10, 0, 0)
  if ZoneInfo:
    try:
      return dt.replace(tzinfo=ZoneInfo(TZ_NAME))
    except Exception:
      return dt
  return dt


def extract_title_from_md(md: str) -> Optional[str]:
  m = H1_RE.search(md)
  if not m:
    return None
  title = m.group(1).strip()
  return title or None


def parse_simple_yaml(text: str) -> Dict[str, Any]:
  """
  Minimal YAML-like parser:
  - key: value
  - key: [a, b, c]
  - key: true/false
  - ignores empty lines and comments
  """
  out: Dict[str, Any] = {}
  for raw_line in text.splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#"):
      continue
    if ":" not in line:
      continue

    key, val = line.split(":", 1)
    key = key.strip()
    val = val.strip()

    # bool
    if val.lower() in ("true", "false"):
      out[key] = (val.lower() == "true")
      continue

    # list: [a, b, c]
    if val.startswith("[") and val.endswith("]"):
      inner = val[1:-1].strip()
      if not inner:
        out[key] = []
      else:
        items = [x.strip().strip('"').strip("'") for x in inner.split(",")]
        out[key] = [x for x in items if x]
      continue

    # string
    out[key] = val.strip('"').strip("'")
  return out


def split_frontmatter(md: str) -> Tuple[Dict[str, Any], str]:
  """
  Return (frontmatter_dict, body_md).
  If no frontmatter, return ({}, md).
  """
  m = FRONTMATTER_RE.match(md)
  if not m:
    return {}, md
  fm_text = m.group(1)
  body = md[m.end():]
  fm = parse_simple_yaml(fm_text)
  return fm, body


# -------------------------
# cache signature
# -------------------------
@dataclass
class FileSig:
  mtime_ns: int
  size: int


def get_sig(p: Path) -> FileSig:
  st = p.stat()
  return FileSig(
    mtime_ns=getattr(st, "st_mtime_ns", int(st.st_mtime * 1e9)),
    size=st.st_size,
  )


def build_one(md_file: Path, category: str, sig: FileSig) -> Dict[str, Any]:
  stem = md_file.stem
  slug = stem

  raw = md_file.read_text(encoding="utf-8", errors="ignore")
  fm, body_md = split_frontmatter(raw)

  # title: frontmatter.title > first H1 > filename
  title = str(fm.get("title", "") or "").strip()
  if not title:
    title = extract_title_from_md(body_md) or stem

  # date: from filename (your rule B)
  dt = parse_date_from_filename(stem)
  if not dt:
    # safety fallback only if filename has no date
    dt = datetime.fromtimestamp(md_file.stat().st_mtime)
    if ZoneInfo:
      try:
        dt = dt.replace(tzinfo=ZoneInfo(TZ_NAME))
      except Exception:
        pass
  date_iso = dt.isoformat()

  # tags: from frontmatter.tags
  tags = fm.get("tags", DEFAULT_TAGS)
  if not isinstance(tags, list):
    tags = DEFAULT_TAGS
  tags = [str(x).strip() for x in tags if str(x).strip()]

  # featured image: accept featured_image or featuredImage
  featured_image = fm.get("featured_image") or fm.get("featuredImage") or DEFAULT_FEATURED_IMAGE
  featured_image = str(featured_image).strip() if featured_image else DEFAULT_FEATURED_IMAGE

  if featured_image.startswith("../"):
    featured_image = "/" + featured_image[3:]
  elif not featured_image.startswith("/"):
    featured_image = "/" + featured_image.lstrip("./")

  # draft: skip output if true
  draft = bool(fm.get("draft", False))

  md_path = "/" + norm_rel(Path("posts") / category / md_file.name)

  return {
    "id": slug,
    "title": title,
    "slug": slug,
    "date": date_iso,
    "category": category,
    "tags": tags,
    "md_path": md_path,
    "featuredImage": featured_image,
    "draft": draft,  # internal control; removed before output
    "_sig": {"mtime_ns": sig.mtime_ns, "size": sig.size},  # internal cache; removed before output
  }


def scan_md_files() -> List[Tuple[Path, str]]:
  out: List[Tuple[Path, str]] = []
  if not POSTS_DIR.exists():
    return out

  for md in POSTS_DIR.rglob("*.md"):
    if not md.is_file():
      continue

    rel = md.relative_to(POSTS_DIR)
    parts = rel.parts
    category = parts[0] if len(parts) >= 2 else "uncategorized"
    out.append((md, category))
  return out


def main() -> None:
  ensure_dirs()

  cache = load_json(CACHE_JSON, default={})
  cache_files: Dict[str, Any] = cache.get("files", {})

  items: List[Dict[str, Any]] = []

  for md_file, category in scan_md_files():
    sig = get_sig(md_file)
    rel_key = norm_rel(md_file.relative_to(ROOT))  # e.g. posts/随笔/xxx.md

    cached = cache_files.get(rel_key)
    if cached and cached.get("mtime_ns") == sig.mtime_ns and cached.get("size") == sig.size:
      post = cached.get("post")
      if post:
        items.append(post)
        continue

    post = build_one(md_file, category, sig)
    items.append(post)

    cache_files[rel_key] = {
      "mtime_ns": sig.mtime_ns,
      "size": sig.size,
      "post": post,
    }

  # sort by date desc
  def sort_key(p: Dict[str, Any]) -> datetime:
    try:
      return datetime.fromisoformat(p.get("date", "1970-01-01T00:00:00"))
    except Exception:
      return datetime(1970, 1, 1)

  items.sort(key=sort_key, reverse=True)

  # write posts.json (skip draft; remove internals)
  out_items: List[Dict[str, Any]] = []
  for p in items:
    if p.get("draft") is True:
      continue
    p2 = dict(p)
    p2.pop("_sig", None)
    p2.pop("draft", None)
    out_items.append(p2)

  save_json(OUT_JSON, out_items)
  save_json(CACHE_JSON, {"version": 1, "files": cache_files})

  print(f"[ok] wrote {OUT_JSON} ({len(out_items)} posts)")
  print(f"[ok] wrote {CACHE_JSON} (cache entries: {len(cache_files)})")


if __name__ == "__main__":
  main()
