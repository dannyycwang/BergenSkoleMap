#!/usr/bin/env python3
"""Geocode Bergen schools from cleaned dataset using Nominatim.

Usage:
  python scripts/geocode_schools.py
  python scripts/geocode_schools.py --limit 10
"""

from __future__ import annotations

import argparse
import csv
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT_JSON = ROOT / "data" / "bergen_primary_schools.json"
OUT_JSON = ROOT / "data" / "bergen_primary_schools_geocoded.json"
OUT_GEOJSON = ROOT / "data" / "bergen_primary_schools_geocoded.geojson"
OUT_CSV = ROOT / "data" / "bergen_primary_schools_geocoded.csv"
CACHE_PATH = ROOT / "data" / "geocode_cache.json"


def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict):
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def query_nominatim(q: str):
    params = urllib.parse.urlencode(
        {
            "q": q,
            "format": "jsonv2",
            "limit": 1,
            "addressdetails": 1,
            "countrycodes": "no",
        }
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "BergenSkoleMap/1.0 (school mapping project)"},
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        if resp.status != 200:
            return None
        rows = json.loads(resp.read().decode("utf-8"))
    if not rows:
        return None
    top = rows[0]
    return {
        "lat": float(top["lat"]),
        "lon": float(top["lon"]),
        "display_name": top.get("display_name"),
    }


def geocode_school(name: str, cache: dict):
    if name in cache:
        return cache[name]

    base = name.replace(" avd skole", "").replace(" - skole", "").replace("(Nedlagt)", "").strip()
    queries = [
        f"{name}, Bergen, Norway",
        f"{base}, Bergen, Norway",
        f"{base} skole, Bergen, Norway",
        f"{base} skule, Bergen, Norway",
    ]

    for q in queries:
        try:
            hit = query_nominatim(q)
            if hit:
                cache[name] = {
                    "latitude": hit["lat"],
                    "longitude": hit["lon"],
                    "geocoded_address": hit["display_name"],
                    "geocoding_status": "matched_nominatim",
                    "geocoding_query": q,
                }
                return cache[name]
        except Exception:
            continue

    cache[name] = {
        "latitude": None,
        "longitude": None,
        "geocoded_address": None,
        "geocoding_status": "not_found",
        "geocoding_query": None,
    }
    return cache[name]


def to_geojson(rows: list[dict]):
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["longitude"], r["latitude"]]},
                "properties": {k: v for k, v in r.items() if k not in {"longitude", "latitude"}},
            }
            for r in rows
            if r.get("latitude") is not None and r.get("longitude") is not None
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Only geocode first N schools")
    parser.add_argument("--delay", type=float, default=1.1, help="Delay between API calls in seconds")
    args = parser.parse_args()

    schools = json.loads(INPUT_JSON.read_text(encoding="utf-8"))
    if args.limit > 0:
        schools = schools[: args.limit]

    cache = load_cache()

    out = []
    for i, s in enumerate(schools, start=1):
        geo = geocode_school(s["school_name"], cache)
        merged = {**s, **geo}
        if merged.get('latitude') is None or merged.get('longitude') is None:
            merged['latitude'] = s.get('latitude')
            merged['longitude'] = s.get('longitude')
            if merged.get('geocoding_status') == 'not_found':
                merged['geocoding_status'] = 'fallback_approximate_from_prepare_data'
        out.append(merged)
        save_cache(cache)
        print(f"[{i}/{len(schools)}] {s['school_name']}: {merged['geocoding_status']}")
        if args.delay > 0:
            time.sleep(args.delay)

    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_GEOJSON.write_text(json.dumps(to_geojson(out), ensure_ascii=False, indent=2), encoding="utf-8")
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)

    matched = sum(1 for r in out if r["geocoding_status"] == "matched_nominatim")
    print(f"Saved {len(out)} rows. matched_nominatim={matched}")


if __name__ == "__main__":
    main()
