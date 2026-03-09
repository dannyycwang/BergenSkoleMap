const map = L.map('map').setView([60.39299, 5.32415], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const format = (v, unit = '') => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${v}${unit}`);
const geocodeCacheKey = 'bergenSchoolGeocodeCacheV1';
const geocodeCache = JSON.parse(localStorage.getItem(geocodeCacheKey) || '{}');

function renderDetail(p) {
  const panel = document.getElementById('detail-panel');
  document.getElementById('detail-title').textContent = p.school_name;
  document.getElementById('detail-content').innerHTML = `
    <table>
      <tr><td>組織編號</td><td>${format(p.organization_number)}</td></tr>
      <tr><td>城市 / 郡</td><td>${format(p.municipality)} / ${format(p.county)}</td></tr>
      <tr><td>學生數 (2025-26)</td><td>${format(p.students_2025_26)}</td></tr>
      <tr><td>特教學生數 (2025-26)</td><td>${format(p.special_education_2025_26)}</td></tr>
      <tr><td>加強挪威語學生數 (2025-26)</td><td>${format(p.enhanced_norwegian_2025_26)}</td></tr>
      <tr><td>教師數 (2025-26)</td><td>${format(p.teachers_2025_26)}</td></tr>
      <tr><td>師生密度 (2025-26)</td><td>${format(p.teacher_density_2025_26)}</td></tr>
      <tr><td>學生霸凌比例</td><td>${format(p.mobbing_by_students_pct, '%')}</td></tr>
      <tr><td>成人霸凌比例</td><td>${format(p.mobbing_by_adults_pct, '%')}</td></tr>
      <tr><td>數位霸凌比例</td><td>${format(p.mobbing_digital_pct, '%')}</td></tr>
      <tr><td>地理定位狀態</td><td>${format(p.geocoding_status)}</td></tr>
      <tr><td>地址 (若有)</td><td>${format(p.geocoded_address)}</td></tr>
    </table>
  `;
  panel.classList.remove('hidden');
}

document.getElementById('close-detail').addEventListener('click', () => {
  document.getElementById('detail-panel').classList.add('hidden');
});

async function geocodeSchool(schoolName) {
  const variants = [
    `${schoolName}, Bergen, Norway`,
    `${schoolName.replace(' avd skole', '').replace(' - skole', '').replace('(Nedlagt)', '').trim()}, Bergen, Norway`,
    `${schoolName} skole, Bergen, Norway`,
    `${schoolName} skule, Bergen, Norway`
  ];

  for (const q of variants) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) continue;
      const arr = await r.json();
      if (arr.length) {
        return {
          lat: Number(arr[0].lat),
          lon: Number(arr[0].lon),
          geocoded_address: arr[0].display_name,
          geocoding_status: 'matched_nominatim'
        };
      }
    } catch (_) {}
  }
  return null;
}

fetch('../data/bergen_primary_schools.geojson')
  .then(r => r.json())
  .then(fc => {
    const listEl = document.getElementById('school-list');
    const countEl = document.getElementById('count');
    const searchEl = document.getElementById('search');
    let markerEntries = [];

    const addMarker = (feature) => {
      const p = feature.properties;
      const marker = L.marker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]]).addTo(map);
      marker.on('click', () => renderDetail(p));
      return { marker, feature };
    };

    const redraw = (query = '') => {
      markerEntries.forEach(({ marker }) => marker.remove());
      markerEntries = [];
      listEl.innerHTML = '';

      const q = query.trim().toLowerCase();
      const filtered = fc.features.filter(f => f.properties.school_name.toLowerCase().includes(q));
      countEl.textContent = `顯示 ${filtered.length} / ${fc.features.length} 所學校`;

      filtered.forEach((f) => {
        const entry = addMarker(f);
        markerEntries.push(entry);

        const li = document.createElement('li');
        li.textContent = f.properties.school_name;
        li.onclick = () => {
          map.setView([f.geometry.coordinates[1], f.geometry.coordinates[0]], 14);
          renderDetail(f.properties);
        };
        listEl.appendChild(li);
      });
    };

    redraw();
    searchEl.addEventListener('input', (e) => redraw(e.target.value));

    // Background: improve coordinates with real geocoding + cache.
    (async () => {
      for (const feature of fc.features) {
        const name = feature.properties.school_name;
        if (geocodeCache[name]) {
          const c = geocodeCache[name];
          feature.geometry.coordinates = [c.lon, c.lat];
          feature.properties.geocoded_address = c.geocoded_address;
          feature.properties.geocoding_status = c.geocoding_status;
          continue;
        }

        const found = await geocodeSchool(name);
        if (found) {
          feature.geometry.coordinates = [found.lon, found.lat];
          feature.properties.geocoded_address = found.geocoded_address;
          feature.properties.geocoding_status = found.geocoding_status;
          geocodeCache[name] = found;
          localStorage.setItem(geocodeCacheKey, JSON.stringify(geocodeCache));
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
      redraw(searchEl.value);
    })();
  });
