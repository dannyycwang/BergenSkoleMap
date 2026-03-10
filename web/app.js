const map = L.map('map', { zoomControl: false }).setView([60.39299, 5.32415], 11);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const format = (v, unit = '') => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${v}${unit}`);
const studentColor = (n) => (n >= 500 ? '#d62828' : n >= 350 ? '#f77f00' : n >= 200 ? '#fcbf49' : '#2a9d8f');
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

  const preferredOrder = [
    'school_name', 'organization_number', 'address', 'postal_code', 'postal_city',
    'municipality', 'county', 'students_2025_26', 'special_education_2025_26',
    'enhanced_norwegian_2025_26', 'teachers_2025_26', 'teacher_density_2025_26',
    'mobbing_by_students_pct', 'mobbing_by_adults_pct', 'mobbing_digital_pct',
    'geocoding_status', 'geocoded_address', 'geocoding_query'
  ];

  const allKeys = Object.keys(p);
  const orderedKeys = [
    ...preferredOrder.filter((k) => allKeys.includes(k)),
    ...allKeys.filter((k) => !preferredOrder.includes(k)).sort()
  ];

  const rows = orderedKeys.map((k) => {
    const label = KEY_LABELS[k] || k;
    const value = p[k];
    return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(format(value))}</td></tr>`;
  }).join('');

  document.getElementById('detail-content').innerHTML = `<table>${rows}</table>`;
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

loadSchoolGeoJson().then((fc) => {
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
        fillColor: studentColor(p.students_2025_26 || 0),
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
