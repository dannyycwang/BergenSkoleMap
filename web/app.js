const map = L.map('map', { zoomControl: false }).setView([60.39299, 5.32415], 11);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const format = (v, unit = '') => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${v}${unit}`);
const studentColor = (n) => (n >= 500 ? '#d62828' : n >= 350 ? '#f77f00' : n >= 200 ? '#fcbf49' : '#2a9d8f');

function renderDetail(p) {
  const panel = document.getElementById('detail-panel');
  document.getElementById('detail-title').textContent = p.school_name;
  document.getElementById('detail-content').innerHTML = `
    <table>
      <tr><td>組織編號</td><td>${format(p.organization_number)}</td></tr>
      <tr><td>地址</td><td>${format(p.address)} ${format(p.postal_code)} ${format(p.postal_city)}</td></tr>
      <tr><td>城市 / 郡</td><td>${format(p.municipality)} / ${format(p.county)}</td></tr>
      <tr><td>學生數 (2025-26)</td><td>${format(p.students_2025_26)}</td></tr>
      <tr><td>特教學生數 (2025-26)</td><td>${format(p.special_education_2025_26)}</td></tr>
      <tr><td>加強挪威語學生數 (2025-26)</td><td>${format(p.enhanced_norwegian_2025_26)}</td></tr>
      <tr><td>教師數 (2025-26)</td><td>${format(p.teachers_2025_26)}</td></tr>
      <tr><td>師生密度 (2025-26)</td><td>${format(p.teacher_density_2025_26)}</td></tr>
      <tr><td>地理定位狀態</td><td>${format(p.geocoding_status)}</td></tr>
      <tr><td>定位地址</td><td>${format(p.geocoded_address)}</td></tr>
    </table>
  `;
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

  let markerEntries = [];

  const currentFiltered = () => {
    const q = searchEl.value.trim().toLowerCase();
    const minStudents = Number(rangeEl.value || 0);
    const geoStatus = geoFilterEl.value;
    return fc.features.filter((f) => {
      const p = f.properties;
      const nameOk = p.school_name.toLowerCase().includes(q);
      const studentsOk = (p.students_2025_26 || 0) >= minStudents;
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
      const marker = L.circleMarker([lat, lon], {
        radius: 7,
        weight: 1,
        color: '#0f172a',
        fillColor: studentColor(p.students_2025_26 || 0),
        fillOpacity: 0.85,
      }).addTo(map);

      marker.bindTooltip(`${p.school_name}<br/>學生: ${format(p.students_2025_26)}`, {
        direction: 'top',
        offset: [0, -8],
        className: 'school-tip'
      });

      marker.on('mouseover', () => marker.setRadius(10));
      marker.on('mouseout', () => marker.setRadius(7));
      marker.on('click', () => {
        map.flyTo([lat, lon], Math.max(map.getZoom(), 13), { duration: 0.6 });
        renderDetail(p);
      });
      markerEntries.push({ marker, feature: f });

      const li = document.createElement('li');
      li.textContent = `${p.school_name}（${format(p.students_2025_26)}）`;
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
