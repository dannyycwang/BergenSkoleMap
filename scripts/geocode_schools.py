#!/usr/bin/env python3
"""Geocode Bergen schools using address from source data first.

If address is present, we only use address-based queries by default.
Use --allow-name-fallback to also try school name queries when address lookup fails.
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
INPUT_JSON = ROOT / 'data' / 'bergen_primary_schools.json'
OUT_JSON = ROOT / 'data' / 'bergen_primary_schools_geocoded.json'
OUT_GEOJSON = ROOT / 'data' / 'bergen_primary_schools_geocoded.geojson'
OUT_CSV = ROOT / 'data' / 'bergen_primary_schools_geocoded.csv'
CACHE_PATH = ROOT / 'data' / 'geocode_cache.json'


def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding='utf-8'))
    return {}


def save_cache(cache: dict):
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding='utf-8')


def query_nominatim(q: str):
    params = urllib.parse.urlencode({
        'q': q,
        'format': 'jsonv2',
        'limit': 1,
        'addressdetails': 1,
        'countrycodes': 'no',
    })
    req = urllib.request.Request(
        f'https://nominatim.openstreetmap.org/search?{params}',
        headers={'User-Agent': 'BergenSkoleMap/1.0 (school mapping project)'},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        if resp.status != 200:
            return None
        rows = json.loads(resp.read().decode('utf-8'))
    if not rows:
        return None
    top = rows[0]
    return {
        'lat': float(top['lat']),
        'lon': float(top['lon']),
        'display_name': top.get('display_name'),
    }


def build_queries(row: dict, allow_name_fallback: bool):
    name = row['school_name']
    base = name.replace(' avd skole', '').replace(' - skole', '').replace('(Nedlagt)', '').strip()
    addr = (row.get('address') or '').strip()
    postal_code = (row.get('postal_code') or '').strip()
    postal_city = (row.get('postal_city') or '').strip()

    queries = []
    if addr:
        q = f'{addr}, {postal_code} {postal_city}'.strip(', ').strip()
        queries.append(f'{q}, Bergen, Norway')
        queries.append(f'{addr}, Bergen, Norway')

    if allow_name_fallback:
        queries.extend([
            f'{name}, Bergen, Norway',
            f'{base}, Bergen, Norway',
            f'{base} skole, Bergen, Norway',
            f'{base} skule, Bergen, Norway',
        ])

    return queries


def geocode_school(row: dict, cache: dict, allow_name_fallback: bool):
    name = row['school_name']
    if name in cache:
        return cache[name]

    queries = build_queries(row, allow_name_fallback)
    if not queries:
        cache[name] = {
            'latitude': None,
            'longitude': None,
            'geocoded_address': None,
            'geocoding_status': 'no_address_in_source',
            'geocoding_query': None,
        }
        return cache[name]

    for q in queries:
        try:
            hit = query_nominatim(q)
            if hit:
                cache[name] = {
                    'latitude': hit['lat'],
                    'longitude': hit['lon'],
                    'geocoded_address': hit['display_name'],
                    'geocoding_status': 'matched_nominatim',
                    'geocoding_query': q,
                }
                return cache[name]
        except Exception:
            continue

    cache[name] = {
        'latitude': None,
        'longitude': None,
        'geocoded_address': None,
        'geocoding_status': 'not_found',
        'geocoding_query': None,
    }
    return cache[name]


def to_geojson(rows: list[dict]):
    return {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [r['longitude'], r['latitude']]},
                'properties': {k: v for k, v in r.items() if k not in {'longitude', 'latitude'}},
            }
            for r in rows if r.get('latitude') is not None and r.get('longitude') is not None
        ],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--delay', type=float, default=1.1)
    ap.add_argument('--allow-name-fallback', action='store_true')
    ap.add_argument('--dry-run', action='store_true', help='Do not write output files')
    args = ap.parse_args()

    rows = json.loads(INPUT_JSON.read_text(encoding='utf-8'))
    if args.limit > 0:
        rows = rows[:args.limit]

    cache = load_cache()
    out = []
    for i, row in enumerate(rows, 1):
        geo = geocode_school(row, cache, allow_name_fallback=args.allow_name_fallback)
        merged = {**row, **geo}
        if merged.get('latitude') is None or merged.get('longitude') is None:
            merged['latitude'] = row.get('latitude')
            merged['longitude'] = row.get('longitude')
            if merged.get('geocoding_status') in {'not_found', 'no_address_in_source'}:
                merged['geocoding_status'] = 'fallback_approximate_from_prepare_data'
        out.append(merged)
        print(f"[{i}/{len(rows)}] {row['school_name']}: {merged['geocoding_status']}")
        if not args.dry_run:
            save_cache(cache)
        if args.delay > 0:
            time.sleep(args.delay)

    if not args.dry_run:
        OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
        OUT_GEOJSON.write_text(json.dumps(to_geojson(out), ensure_ascii=False, indent=2), encoding='utf-8')
        with OUT_CSV.open('w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
            w.writeheader()
            w.writerows(out)

    matched = sum(1 for r in out if r['geocoding_status'] == 'matched_nominatim')
    print(f'Schools={len(out)} matched_nominatim={matched} dry_run={args.dry_run}')


if __name__ == '__main__':
    main()
