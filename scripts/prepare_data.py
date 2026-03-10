#!/usr/bin/env python3
import csv, hashlib, json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT_XLSX = ROOT / 'educationBergen.xlsx'
OUTPUT_JSON = ROOT / 'data' / 'bergen_primary_schools.json'
OUTPUT_GEOJSON = ROOT / 'data' / 'bergen_primary_schools.geojson'
OUTPUT_CSV = ROOT / 'data' / 'bergen_primary_schools_cleaned.csv'
NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def excel_col_to_index(cell_ref: str) -> int:
    letters = ''.join(ch for ch in cell_ref if ch.isalpha())
    col = 0
    for c in letters:
        col = col * 26 + (ord(c.upper()) - ord('A') + 1)
    return col - 1


def parse_xlsx(path: Path):
    with zipfile.ZipFile(path) as zf:
        shared = []
        root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
        for si in root.findall('a:si', NS):
            shared.append(''.join(t.text or '' for t in si.findall('.//a:t', NS)))

        sheet = ET.fromstring(zf.read('xl/worksheets/sheet1.xml'))
        rows = []
        for row in sheet.findall('.//a:sheetData/a:row', NS):
            cells, max_idx = {}, 0
            for c in row.findall('a:c', NS):
                idx = excel_col_to_index(c.attrib.get('r', 'A1'))
                max_idx = max(max_idx, idx)
                v = c.find('a:v', NS)
                if v is None:
                    value = ''
                elif c.attrib.get('t') == 's':
                    value = shared[int(v.text)]
                else:
                    value = v.text or ''
                cells[idx] = value
            rows.append([cells.get(i, '') for i in range(max_idx + 1)])

    header = rows[0]
    out = []
    for raw in rows[1:]:
        raw += [''] * (len(header) - len(raw))
        out.append({header[i]: raw[i] for i in range(len(header))})
    return out


def nfloat(v):
    s = str(v or '').strip().replace(' ', '').replace(',', '.')
    if s in {'', '*', ':'}:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def nint(v):
    f = nfloat(v)
    return None if f is None else int(round(f))


def find_col(headers, include, year=None):
    for h in headers:
        if include in h and (year is None or h.startswith(year)):
            return h


def find_col_by_any_keywords(headers, keywords):
    lowered = [(h, h.lower()) for h in headers]
    for h, low in lowered:
        if any(k in low for k in keywords):
            return h
    return None


def approximate_bergen_coordinate(name: str):
    center_lat, center_lon = 60.39299, 5.32415
    digest = hashlib.sha1(name.encode('utf-8')).hexdigest()
    a = int(digest[:8], 16)
    b = int(digest[8:16], 16)
    radius = 0.03 + (a % 1000) / 1000 * 0.09
    angle = (b % 36000) / 100.0
    import math
    dlat = radius * math.sin(math.radians(angle))
    dlon = radius * math.cos(math.radians(angle)) / math.cos(math.radians(center_lat))
    return center_lat + dlat, center_lon + dlon


def main():
    records = parse_xlsx(INPUT_XLSX)
    headers = list(records[0].keys())

    col_students = find_col(headers, 'Antall elever', '2025-26')
    col_special = find_col(headers, 'spesialundervisning', '2025-26')
    col_nor = find_col(headers, 'forsterket opplæring i norsk', '2025-26')
    col_teachers = find_col(headers, 'Antall lærere', '2025-26')
    col_density = find_col(headers, 'Lærertetthet i ordinær undervisning', '2025-26')

    # Address column detection for different languages/exports.
    col_address = find_col_by_any_keywords(headers, ['adresse', 'address', '地址'])
    col_postal_code = find_col_by_any_keywords(headers, ['postnummer', 'postnr', 'postal code', '郵遞區號'])
    col_city = find_col_by_any_keywords(headers, ['poststed', 'postal city', 'city', '城市'])

    cleaned = []
    for r in records:
        if r.get('Kommune') != 'Bergen':
            continue
        school = (r.get('EnhetNavn') or '').strip()
        if not school or school.lower() == 'alle skoler':
            continue

        lat, lon = approximate_bergen_coordinate(school)
        address = (r.get(col_address, '') if col_address else '').strip() or None
        postal_code = (r.get(col_postal_code, '') if col_postal_code else '').strip() or None
        postal_city = (r.get(col_city, '') if col_city else '').strip() or None

        cleaned.append({
            'school_name': school,
            'organization_number': (r.get('Organisasjonsnummer') or '').strip() or None,
            'municipality': r.get('Kommune'),
            'county': r.get('Fylke'),
            'address': address,
            'postal_code': postal_code,
            'postal_city': postal_city,
            'mobbing_by_students_pct': nfloat(r.get('Er du blitt mobbet av andre elever? skolen de siste månedene?')),
            'mobbing_by_adults_pct': nfloat(r.get('Er du blitt mobbet av voksne? skolen de siste?nedene?')),
            'mobbing_digital_pct': nfloat(r.get('Er du blitt mobbet digitalt (mobil, iPad, PC) de siste m?nedene?')),
            'students_2025_26': nint(r.get(col_students)),
            'special_education_2025_26': nint(r.get(col_special)),
            'enhanced_norwegian_2025_26': nint(r.get(col_nor)),
            'teachers_2025_26': nint(r.get(col_teachers)),
            'teacher_density_2025_26': nfloat(r.get(col_density)),
            'latitude': lat,
            'longitude': lon,
            'geocoded_address': None,
            'geocoding_status': 'approximate_from_name_hash'
        })

    unique = {r['school_name']: r for r in cleaned}
    cleaned = sorted(unique.values(), key=lambda x: x['school_name'].lower())

    OUTPUT_JSON.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2), encoding='utf-8')
    geojson = {
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [r['longitude'], r['latitude']]},
                'properties': {k: v for k, v in r.items() if k not in {'longitude', 'latitude'}}
            }
            for r in cleaned
        ]
    }
    OUTPUT_GEOJSON.write_text(json.dumps(geojson, ensure_ascii=False, indent=2), encoding='utf-8')

    with OUTPUT_CSV.open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(cleaned[0].keys()))
        w.writeheader()
        w.writerows(cleaned)

    print(f'Saved {len(cleaned)} schools. address_col={col_address}')


if __name__ == '__main__':
    main()
