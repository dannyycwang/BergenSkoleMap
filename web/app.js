const map = L.map('map', { zoomControl: false }).setView([60.39299, 5.32415], 11);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const format = (v, unit = '') => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${v}${unit}`);
const markerColor = '#2563eb';
const escapeHtml = (v) => String(v)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const KEY_LABELS = {
  school_name: '學校名稱',
  organization_number: '組織編號',
  municipality: '城市',
  county: '郡',
  address: '地址',
  postal_code: '郵遞區號',
  postal_city: '郵遞城市',
  mobbing_by_students_pct: '被學生霸凌比例(%)',
  mobbing_by_adults_pct: '被成人霸凌比例(%)',
  mobbing_digital_pct: '數位霸凌比例(%)',
  students_2025_26: '學生數 (2025-26)',
  special_education_2025_26: '特教學生數 (2025-26)',
  enhanced_norwegian_2025_26: '加強挪威語學生數 (2025-26)',
  teachers_2025_26: '教師數 (2025-26)',
  teacher_density_2025_26: '師生密度 (2025-26)',
  geocoded_address: '定位地址',
  geocoding_status: '地理定位狀態',
  geocoding_query: '定位查詢字串'
};



function translateSourceHeader(header) {
  let out = String(header || '');
  const rules = [
    ['Alle spørsmøl', '全部問題'],
    ['Er du blitt mobbet av andre elever? skolen de siste månedene?', '你最近幾個月在學校有被其他學生霸凌嗎？'],
    ['Er du blitt mobbet av voksne? skolen de siste?nedene?', '你最近幾個月在學校有被成人霸凌嗎？'],
    ['Er du blitt mobbet digitalt (mobil, iPad, PC) de siste m?nedene?', '你最近幾個月有被數位霸凌嗎（手機/iPad/電腦）？'],
    ['Alle trinn', '所有年級'],
    ['Alle kjønn', '所有性別'],
    ['Alle eierformer', '所有辦學型態'],
    ['Antall elever med individuelt tilrettelagt opplæring/spesialundervisning', '個別調整/特殊教育學生數'],
    ['Antall elever med forsterket opplæring i norsk', '加強挪威語教學學生數'],
    ['Antall elever deltatt', '參與學生數'],
    ['Antall elever', '學生數'],
    ['Antall skoler', '學校數'],
    ['Antall lærere', '教師數'],
    ['Antall lærerårsverk til undervisning', '教學教師全職當量'],
    ['Antall lærerårsverk', '教師全職當量'],
    ['Antall assistentårsverk i undervisningen', '教學助理全職當量'],
    ['Lærertetthet i ordinær undervisning', '一般教學師生比'],
    ['Vurderingsfagkode', '評量科目代碼'],
    ['Vurderingsfagnavn', '評量科目名稱'],
    ['Standpunkt', '學期成績'],
    ['Snittkarakter', '平均成績'],
    ['Grunnskolepoeng', '基礎學校積分'],
    ['Engelsk', '英語'],
    ['Lesing', '閱讀'],
    ['Regning', '計算'],
    ['Skalapoeng', '量尺分數'],
    ['Usikkerhet', '不確定性'],
    ['Median dager', '中位天數'],
    ['Median timer', '中位時數'],
    ['5. årstrinn', '5 年級'],
    ['8. årstrinn', '8 年級'],
  ];
  for (const [from, to] of rules) out = out.replaceAll(from, to);
  out = out.replaceAll('Alle kj?nn', '所有性別').replaceAll('m?nedene', '月');
  return out;
}
function radiusFromStudents(n, minStudents, maxStudents) {
  const minR = 8;
  const maxR = 22;
  const value = Number(n || 0);
  if (maxStudents <= minStudents) return 12;
  const ratio = (value - minStudents) / (maxStudents - minStudents);
  return Math.round((minR + Math.max(0, Math.min(1, ratio)) * (maxR - minR)) * 10) / 10;
}

function renderDetail(p) {
  const panel = document.getElementById('detail-panel');
  document.getElementById('detail-title').textContent = p.school_name || '學校資訊';

  const bullyingKeys = [
    'src__Alle spørsmøl',
    'src__Er du blitt mobbet av andre elever? skolen de siste månedene?',
    'src__Er du blitt mobbet av voksne? skolen de siste?nedene?',
    'src__Er du blitt mobbet digitalt (mobil, iPad, PC) de siste m?nedene?'
  ];

  const hiddenKeys = new Set([
    'address', 'postal_code', 'postal_city', 'src__Address',
    'src__EnhetNavn', 'src__EnhetNavn3',
  ]);

  const allKeys = Object.keys(p).filter((k) => !hiddenKeys.has(k));
  const basicKeys = [
    'school_name', 'organization_number', 'municipality', 'county',
    'students_2025_26', 'special_education_2025_26',
    'enhanced_norwegian_2025_26', 'teachers_2025_26',
    'teacher_density_2025_26', 'geocoding_status', 'geocoded_address', 'geocoding_query'
  ].filter((k) => allKeys.includes(k));

  const bullyingSet = new Set(bullyingKeys);
  const basicSet = new Set(basicKeys);
  const remainingKeys = allKeys.filter((k) => !bullyingSet.has(k) && !basicSet.has(k)).sort();

  const toRows = (keys) => keys.map((k) => {
    const label = k.startsWith('src__') ? translateSourceHeader(k.slice(5)) : (KEY_LABELS[k] || k);
    const value = p[k];
    return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(format(value))}</td></tr>`;
  }).join('');

  const bullyingRows = toRows(bullyingKeys.filter((k) => allKeys.includes(k)));
  const basicRows = toRows(basicKeys);
  const remainingRows = toRows(remainingKeys);

  const sections = [];
  if (bullyingRows) {
    sections.push(`
      <section class="detail-section">
        <h3>霸凌相關</h3>
        <table>${bullyingRows}</table>
      </section>
    `);
  }
  if (basicRows) {
    sections.push(`
      <section class="detail-section">
        <h3>學校基本資訊</h3>
        <table>${basicRows}</table>
      </section>
    `);
  }
  if (remainingRows) {
    sections.push(`
      <section class="detail-section">
        <h3>其他資料</h3>
        <table>${remainingRows}</table>
      </section>
    `);
  }

  document.getElementById('detail-content').innerHTML = sections.join('');
  panel.classList.remove('hidden');
}

document.getElementById('close-detail').addEventListener('click', () => {
  document.getElementById('detail-panel').classList.add('hidden');
});

async function loadSchoolGeoJson() {
  const candidates = [
    '../data/bergen_primary_schools_geocoded.geojson',
    './data/bergen_primary_schools_geocoded.geojson',
    '/data/bergen_primary_schools_geocoded.geojson',
    'data/bergen_primary_schools_geocoded.geojson',
    '../data/bergen_primary_schools.geojson',
    './data/bergen_primary_schools.geojson',
    '/data/bergen_primary_schools.geojson',
    'data/bergen_primary_schools.geojson'
  ];

  for (const path of candidates) {
    try {
      const r = await fetch(path);
      if (!r.ok) continue;
      return await r.json();
    } catch (_) {}
  }
  throw new Error('資料檔載入失敗');
}


async function loadSchoolRows() {
  const candidates = [
    '../data/bergen_primary_schools.json',
    './data/bergen_primary_schools.json',
    '/data/bergen_primary_schools.json',
    'data/bergen_primary_schools.json'
  ];

  for (const path of candidates) {
    try {
      const r = await fetch(path);
      if (!r.ok) continue;
      return await r.json();
    } catch (_) {}
  }
  return [];
}

Promise.all([loadSchoolGeoJson(), loadSchoolRows()]).then(([fc, rows]) => {

  const rowByName = new Map(rows.map((r) => [r.school_name, r]));
  fc.features.forEach((f) => {
    const extra = rowByName.get(f.properties.school_name);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (f.properties[k] === undefined) f.properties[k] = v;
      }
    }
  });

  const listEl = document.getElementById('school-list');
  const countEl = document.getElementById('count');
  const searchEl = document.getElementById('search');
  const rangeEl = document.getElementById('students-range');
  const rangeValEl = document.getElementById('students-value');
  const geoFilterEl = document.getElementById('geo-filter');
  const fitBtn = document.getElementById('fit-btn');
  const statsEl = document.getElementById('stats');

  const allStudents = fc.features.map((f) => Number(f.properties.students_2025_26 || 0));
  const minStudents = Math.min(...allStudents);
  const maxStudents = Math.max(...allStudents);
  rangeEl.max = String(maxStudents || 800);

  let markerEntries = [];

  const currentFiltered = () => {
    const q = searchEl.value.trim().toLowerCase();
    const minStudentsFilter = Number(rangeEl.value || 0);
    const geoStatus = geoFilterEl.value;
    return fc.features.filter((f) => {
      const p = f.properties;
      const nameOk = p.school_name.toLowerCase().includes(q);
      const studentsOk = (p.students_2025_26 || 0) >= minStudentsFilter;
      const geoOk = geoStatus === 'all' ? true : p.geocoding_status === geoStatus;
      return nameOk && studentsOk && geoOk;
    });
  };

  const redraw = () => {
    const filtered = currentFiltered();
    markerEntries.forEach(({ marker }) => marker.remove());
    markerEntries = [];
    listEl.innerHTML = '';

    countEl.textContent = `顯示 ${filtered.length} / ${fc.features.length} 所學校`;
    const totalStudents = filtered.reduce((sum, f) => sum + (f.properties.students_2025_26 || 0), 0);
    const avgStudents = filtered.length ? Math.round(totalStudents / filtered.length) : 0;
    statsEl.textContent = `目前篩選：總學生 ${totalStudents}，平均每校 ${avgStudents}`;

    filtered.forEach((f) => {
      const p = f.properties;
      const lat = f.geometry.coordinates[1];
      const lon = f.geometry.coordinates[0];
      const baseRadius = radiusFromStudents(p.students_2025_26, minStudents, maxStudents);
      const marker = L.circleMarker([lat, lon], {
        radius: baseRadius,
        weight: 1,
        color: '#0f172a',
        fillColor: markerColor,
        fillOpacity: 0.85,
      }).addTo(map);

      marker.bindTooltip(`${p.school_name}<br/>學生: ${format(p.students_2025_26)}<br/>半徑: ${baseRadius}`, {
        direction: 'top',
        offset: [0, -8],
        className: 'school-tip'
      });

      marker.on('mouseover', () => marker.setRadius(baseRadius + 2));
      marker.on('mouseout', () => marker.setRadius(baseRadius));
      marker.on('click', () => {
        map.flyTo([lat, lon], Math.max(map.getZoom(), 13), { duration: 0.6 });
        renderDetail(p);
      });
      markerEntries.push({ marker, feature: f });

      const li = document.createElement('li');
      li.textContent = `${p.school_name}（學生 ${format(p.students_2025_26)} / 點 ${baseRadius}）`;
      li.onclick = () => {
        map.flyTo([lat, lon], 14, { duration: 0.6 });
        renderDetail(p);
      };
      listEl.appendChild(li);
    });
  };

  const fitToFiltered = () => {
    const filtered = currentFiltered();
    if (!filtered.length) return;
    const bounds = L.latLngBounds(filtered.map((f) => [f.geometry.coordinates[1], f.geometry.coordinates[0]]));
    map.fitBounds(bounds.pad(0.2), { animate: true });
  };

  rangeEl.addEventListener('input', () => {
    rangeValEl.textContent = rangeEl.value;
    redraw();
  });
  searchEl.addEventListener('input', redraw);
  geoFilterEl.addEventListener('change', redraw);
  fitBtn.addEventListener('click', fitToFiltered);

  redraw();
  fitToFiltered();
}).catch((err) => {
  document.getElementById('count').textContent = '資料載入失敗';
  document.getElementById('school-list').innerHTML = `<li>${err.message}</li>`;
});
