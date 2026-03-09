const map = L.map('map').setView([60.39299, 5.32415], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const format = (v, unit = '') => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${v}${unit}`);

fetch('../data/bergen_primary_schools.geojson')
  .then(r => r.json())
  .then(fc => {
    const listEl = document.getElementById('school-list');
    const countEl = document.getElementById('count');
    const searchEl = document.getElementById('search');

    const markers = [];

    const draw = (query = '') => {
      markers.forEach(({ marker }) => marker.remove());
      listEl.innerHTML = '';
      const q = query.trim().toLowerCase();
      const filtered = fc.features.filter(f => f.properties.school_name.toLowerCase().includes(q));
      countEl.textContent = `顯示 ${filtered.length} / ${fc.features.length} 所學校`;

      filtered.forEach((f) => {
        const p = f.properties;
        const marker = L.marker([f.geometry.coordinates[1], f.geometry.coordinates[0]]).addTo(map);
        marker.bindPopup(`
          <div class="popup">
            <h3>${p.school_name}</h3>
            <table>
              <tr><td>組織編號</td><td>${format(p.organization_number)}</td></tr>
              <tr><td>學生數 (2025-26)</td><td>${format(p.students_2025_26)}</td></tr>
              <tr><td>教師數 (2025-26)</td><td>${format(p.teachers_2025_26)}</td></tr>
              <tr><td>師生密度 (2025-26)</td><td>${format(p.teacher_density_2025_26)}</td></tr>
              <tr><td>學生霸凌比例</td><td>${format(p.mobbing_by_students_pct, '%')}</td></tr>
              <tr><td>成人霸凌比例</td><td>${format(p.mobbing_by_adults_pct, '%')}</td></tr>
              <tr><td>數位霸凌比例</td><td>${format(p.mobbing_digital_pct, '%')}</td></tr>
              <tr><td>定位狀態</td><td>${p.geocoding_status}</td></tr>
            </table>
          </div>
        `);
        markers.push({ name: p.school_name, marker, feature: f });

        const li = document.createElement('li');
        li.textContent = p.school_name;
        li.onclick = () => {
          map.setView([f.geometry.coordinates[1], f.geometry.coordinates[0]], 13);
          marker.openPopup();
        };
        listEl.appendChild(li);
      });
    };

    draw();
    searchEl.addEventListener('input', (e) => draw(e.target.value));
  });
