#!/usr/bin/env python3
import csv, json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT_XLSX_CANDIDATES = [
    ROOT / 'educationBergen_with_address.xlsx',
    ROOT / 'educationBergen.xlsx',
]
OUTPUT_JSON = ROOT / 'data' / 'bergen_primary_schools.json'
OUTPUT_GEOJSON = ROOT / 'data' / 'bergen_primary_schools.geojson'
OUTPUT_CSV = ROOT / 'data' / 'bergen_primary_schools_cleaned.csv'
OUTPUT_BENCHMARKS = ROOT / 'data' / 'benchmarks.json'
NS = {
    'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}


def pick_input_file() -> Path:
    for p in INPUT_XLSX_CANDIDATES:
        if p.exists():
            return p
    raise FileNotFoundError('No input xlsx found. Expected educationBergen_with_address.xlsx or educationBergen.xlsx')


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

        workbook = ET.fromstring(zf.read('xl/workbook.xml'))
        rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
        rid_to_target = {r.attrib['Id']: r.attrib['Target'] for r in rels}

        # Prefer sheet named 'main' (user-provided address table), else sheet1
        target = 'worksheets/sheet1.xml'
        for sh in workbook.findall('.//a:sheets/a:sheet', NS):
            name = (sh.attrib.get('name') or '').strip().lower()
            rid = sh.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            if name == 'main' and rid in rid_to_target:
                target = rid_to_target[rid]
                break

        sheet = ET.fromstring(zf.read(f'xl/{target}'))
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
    return out, target


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


def find_cols_by_any_keywords(headers, keywords):
    lowered = [(h, h.lower()) for h in headers]
    out = []
    for h, low in lowered:
        if any(k in low for k in keywords):
            out.append(h)
    return out


def first_non_empty(row: dict, columns: list[str]):
    for col in columns:
        v = (row.get(col) or '').strip()
        if v:
            return v
    return None



def build_source_row(r: dict):
    return {f'src__{k}': ((v or '').strip() or None) for k, v in r.items()}


def build_benchmark_row(r: dict):
    row = {
        'school_name': (r.get('EnhetNavn3') or r.get('EnhetNavn') or '').strip() or 'Alle skoler',
        'municipality': (r.get('Kommune') or '').strip() or None,
        'county': (r.get('Fylke') or '').strip() or None,
        'mobbing_by_students_pct': nfloat(r.get('Er du blitt mobbet av andre elever? skolen de siste månedene?')),
        'mobbing_by_adults_pct': nfloat(r.get('Er du blitt mobbet av voksne? skolen de siste?nedene?')),
        'mobbing_digital_pct': nfloat(r.get('Er du blitt mobbet digitalt (mobil, iPad, PC) de siste m?nedene?')),
        'students_2025_26': nint(r.get(find_col(list(r.keys()), 'Antall elever', '2025-26'))),
        'teachers_2025_26': nint(r.get(find_col(list(r.keys()), 'Antall lærere', '2025-26'))),
        'geocoding_status': 'benchmark_reference',
    }
    row.update(build_source_row(r))
    return row

def main():
    input_file = pick_input_file()
    records, source_sheet = parse_xlsx(input_file)
    headers = list(records[0].keys())

    col_students = find_col(headers, 'Antall elever', '2025-26')
    col_special = find_col(headers, 'spesialundervisning', '2025-26')
    col_nor = find_col(headers, 'forsterket opplæring i norsk', '2025-26')
    col_teachers = find_col(headers, 'Antall lærere', '2025-26')
    col_density = find_col(headers, 'Lærertetthet i ordinær undervisning', '2025-26')

    col_school_name = 'EnhetNavn3' if 'EnhetNavn3' in headers else 'EnhetNavn'
    address_candidates = [h for h in headers if h.lower() == 'address']
    address_candidates += [h for h in find_cols_by_any_keywords(headers, ['adresse', 'address', '地址']) if h not in address_candidates]
    postal_code_candidates = find_cols_by_any_keywords(headers, ['postnummer', 'postnr', 'postal code', '郵遞區號'])
    city_candidates = find_cols_by_any_keywords(headers, ['poststed', 'postal city', 'city', '城市'])

    benchmarks = {}
    for r in records:
        kommune = (r.get('Kommune') or '').strip()
        fylke = (r.get('Fylke') or '').strip()
        enhet3 = (r.get('EnhetNavn3') or '').strip()
        enhet = (r.get('EnhetNavn') or '').strip()
        if fylke == 'Vestland' and kommune == 'Alle kommuner' and enhet3 == 'Alle skoler' and enhet == 'Alle skoler':
            benchmarks['vestland_all'] = build_benchmark_row(r)
        if fylke == 'Vestland' and kommune == 'Bergen' and enhet3 == 'Alle skoler' and enhet == 'Alle skoler':
            benchmarks['bergen_all'] = build_benchmark_row(r)

    cleaned = []
    for r in records:
        if r.get('Kommune') != 'Bergen':
            continue
        school = (r.get(col_school_name) or '').strip()
        if not school or school.lower() == 'alle skoler':
            continue

        address = first_non_empty(r, address_candidates)
        postal_code = first_non_empty(r, postal_code_candidates)
        postal_city = first_non_empty(r, city_candidates)

        source_cols = build_source_row(r)
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
            'latitude': None,
            'longitude': None,
            'geocoded_address': None,
            'geocoding_status': 'pending_geocode',
            **source_cols,
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

    OUTPUT_BENCHMARKS.write_text(json.dumps(benchmarks, ensure_ascii=False, indent=2), encoding='utf-8')

    with OUTPUT_CSV.open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(cleaned[0].keys()))
        w.writeheader()
        w.writerows(cleaned)

    print(
        f'Saved {len(cleaned)} schools. '
        f'input={input_file.name} sheet={source_sheet} '
        f'school_col={col_school_name} '
        f'address_cols={address_candidates} postal_cols={postal_code_candidates} city_cols={city_candidates}'
    )


if __name__ == '__main__':
    main()
