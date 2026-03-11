#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

python scripts/prepare_data.py
python scripts/geocode_schools.py "$@"

echo "Done. Updated data/bergen_primary_schools_geocoded.geojson"
