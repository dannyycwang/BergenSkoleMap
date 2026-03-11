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


const HELP_CONTENT = {
  bullying: {
    title: '霸凌欄位說明',
    text: '這些比例代表「在學校最近幾個月，至少遭受每月 2–3 次以上霸凌」的學生比例。數值越高，代表該群體回報受霸凌的比例越高。',
    url: 'https://statistikkportalen.udir.no/api/rapportering/rest/v1/Tekst/visTekst/167573?dataChanged=2026-03-09_083320'
  },
  studentTrend: {
    title: '學生與支援趨勢說明',
    text: '此區塊呈現 2021-22 到 2025-26 的學生與支援人數趨勢，欄位採同指標跨年份由左至右比較。',
    url: 'https://statistikkportalen.udir.no/api/rapportering/rest/v1/Tekst/visTekst/152310?dataChanged=2026-03-09_083320'
  },
  staffTrend: {
    title: '教師與人力趨勢說明',
    text: '此區塊呈現 2021-22 到 2025-26 的教師、人力與一般教學師生密度趨勢，協助觀察資源配置變化。',
    url: 'https://statistikkportalen.udir.no/api/rapportering/rest/v1/Tekst/visTekst/152313?dataChanged=2026-03-09_083320'
  }
};

function ensureHelpModal() {
  let modal = document.getElementById('help-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.className = 'help-modal hidden';
  modal.innerHTML = `
    <div class="help-modal-backdrop" data-close-help="1"></div>
    <div class="help-modal-card" role="dialog" aria-modal="true" aria-label="欄位說明">
      <div class="help-modal-header">
        <h3 id="help-modal-title">欄位說明</h3>
        <button type="button" class="help-close" data-close-help="1">✕</button>
      </div>
      <p id="help-modal-text"></p>
      <a id="help-modal-link" href="#" target="_blank" rel="noopener noreferrer">查看原始說明來源</a>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target && e.target.dataset && e.target.dataset.closeHelp === '1') {
      modal.classList.add('hidden');
    }
  });
  return modal;
}

function typeText(el, text, speed = 18) {
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    i += 1;
    el.textContent = text.slice(0, i);
    if (i >= text.length) clearInterval(timer);
  }, speed);
}

function openHelp(topic) {
  const cfg = HELP_CONTENT[topic];
  if (!cfg) return;
  const modal = ensureHelpModal();
  const textEl = modal.querySelector('#help-modal-text');
  modal.querySelector('#help-modal-title').textContent = cfg.title;
  const linkEl = modal.querySelector('#help-modal-link');
  linkEl.href = cfg.url;
  modal.classList.remove('hidden');
  typeText(textEl, cfg.text, 16);
}

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

function shouldHideKey(key) {
  const lower = key.toLowerCase();
  if (lower === 'address' || lower === 'postal_code' || lower === 'postal_city') return true;
  if (lower === 'src__enhetnavn' || lower === 'src__enhetnavn3') return true;
  if (lower.startsWith('src__address') || lower.startsWith('src__adresse')) return true;
  if (lower.includes('postnummer') || lower.includes('poststed')) return true;
  return false;
}

function isNumericLike(value) {
  if (value === null || value === undefined) return false;
  const s = String(value).trim();
  if (!s || s === '—') return false;
  return /^-?(?:\d{1,3}(?:[\s\u00A0]\d{3})+|\d+)(?:[\.,]\d+)?$/.test(s);
}

function buildRows(keys, p) {
  const seen = new Set();
  const rows = [];
  for (const k of keys) {
    const label = k.startsWith('src__') ? translateSourceHeader(k.slice(5)) : (KEY_LABELS[k] || k);
    const value = format(p[k]);
    const dedupeKey = `${label}::${value}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const cls = isNumericLike(value) ? 'value-number' : '';
    rows.push(`<tr><td>${escapeHtml(label)}</td><td class="${cls}">${escapeHtml(value)}</td></tr>`);
  }
  return rows.join('');
}

function getBenchmarkValue(row, key) {
  if (!row) return '—';
  return format(row[key]);
}

function renderComparisonSection(p, benchmarks) {
  const vestland = benchmarks.vestland_all;
  const bergenAll = benchmarks.bergen_all;
  if (!vestland && !bergenAll) return '';

  const keys = [
    'src__Alle spørsmøl',
    'src__Er du blitt mobbet av andre elever? skolen de siste månedene?',
    'src__Er du blitt mobbet av voksne? skolen de siste?nedene?',
    'src__Er du blitt mobbet digitalt (mobil, iPad, PC) de siste m?nedene?'
  ];

  const rows = keys
    .filter((k) => p[k] !== undefined || (vestland && vestland[k] !== undefined) || (bergenAll && bergenAll[k] !== undefined))
    .map((k) => {
      const label = k.startsWith('src__') ? translateSourceHeader(k.slice(5)) : (KEY_LABELS[k] || k);
      const schoolV = format(p[k]);
      const bergenV = getBenchmarkValue(bergenAll, k);
      const vestlandV = getBenchmarkValue(vestland, k);
      const c1 = isNumericLike(schoolV) ? 'value-number' : '';
      const c2 = isNumericLike(bergenV) ? 'value-number' : '';
      const c3 = isNumericLike(vestlandV) ? 'value-number' : '';
      return `<tr><td>${escapeHtml(label)}</td><td class="${c1}">${escapeHtml(schoolV)}</td><td class="${c2}">${escapeHtml(bergenV)}</td><td class="${c3}">${escapeHtml(vestlandV)}</td></tr>`;
    })
    .join('');

  if (!rows) return '';
  return `
    <details class="detail-section" open>
      <summary>霸凌相關 <button type="button" class="help-icon" id="bully-help-btn" aria-label="查看說明">?</button></summary>
      <table class="compare-table">
        <thead><tr><th>欄位</th><th>本校</th><th>Bergen整體</th><th>Vestland整體</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>
  `;
}

function renderTrendSection(p) {
  const years = ['2021-22', '2022-23', '2023-24', '2024-25', '2025-26'];
  const metrics = [
    { suffix: 'Antall elever', label: '學生數' },
    { suffix: 'Antall elever med individuelt tilrettelagt opplæring/spesialundervisning', label: '特教/個別化學生數' },
    { suffix: 'Antall elever med forsterket opplæring i norsk', label: '加強挪威語學生數' },
    { suffix: 'Antall skoler', label: '學校數' },
  ];

  const rows = metrics.map((m) => {
    const vals = years.map((y) => {
      const key = `src__${y}.Alle trinn.Alle trinn.Alle kjønn.Alle eierformer.${m.suffix}`;
      const value = format(p[key]);
      const cls = isNumericLike(value) ? 'value-number' : '';
      return `<td class="${cls}">${escapeHtml(value)}</td>`;
    }).join('');
    return `<tr><td>${escapeHtml(m.label)}</td>${vals}</tr>`;
  }).join('');

  return `
    <details class="detail-section" open>
      <summary>學生與支援趨勢（2021-22 → 2025-26） <button type="button" class="help-icon" id="student-trend-help-btn" aria-label="查看說明">?</button></summary>
      <div class="trend-wrap">
        <table class="trend-table">
          <thead><tr><th>欄位</th>${years.map((y) => `<th>${y}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </details>
  `;
}

function renderStaffTrendSection(p) {
  const years = ['2021-22', '2022-23', '2023-24', '2024-25', '2025-26'];
  const metrics = [
    { pattern: 'Alle kjønn.Alle eierformer.Antall lærere', label: '教師數' },
    { pattern: 'Alle kjønn.Alle eierformer.Antall lærerårsverk', label: '教師全職當量' },
    { pattern: 'Alle kjønn.Alle eierformer.Antall lærerårsverk til undervisning', label: '教學教師全職當量' },
    { pattern: 'Alle kjønn.Alle eierformer.Antall assistentårsverk i undervisningen', label: '教學助理全職當量' },
    { pattern: 'Alle trinn.Alle eierformer.Lærertetthet i ordinær undervisning', label: '一般教學師生密度' },
  ];

  const rows = metrics.map((m) => {
    const vals = years.map((y) => {
      const key = `src__${y}.${m.pattern}`;
      const value = format(p[key]);
      const cls = isNumericLike(value) ? 'value-number' : '';
      return `<td class="${cls}">${escapeHtml(value)}</td>`;
    }).join('');
    return `<tr><td>${escapeHtml(m.label)}</td>${vals}</tr>`;
  }).join('');

  return `
    <details class="detail-section" open>
      <summary>教師與人力趨勢（2021-22 → 2025-26） <button type="button" class="help-icon" id="staff-trend-help-btn" aria-label="查看說明">?</button></summary>
      <div class="trend-wrap">
        <table class="trend-table">
          <thead><tr><th>欄位</th>${years.map((y) => `<th>${y}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </details>
  `;
}

function renderDetail(p, benchmarks) {
  const panel = document.getElementById('detail-panel');
  document.getElementById('detail-title').textContent = p.school_name || '學校資訊';

  const allKeys = Object.keys(p).filter((k) => !shouldHideKey(k));
  const basicKeys = [
    'school_name', 'organization_number', 'municipality', 'county',
    'students_2025_26', 'special_education_2025_26',
    'enhanced_norwegian_2025_26', 'teachers_2025_26',
    'teacher_density_2025_26', 'geocoding_status'
  ].filter((k) => allKeys.includes(k));

  const compareKeys = new Set([
    'src__Alle spørsmøl',
    'src__Er du blitt mobbet av andre elever? skolen de siste månedene?',
    'src__Er du blitt mobbet av voksne? skolen de siste?nedene?',
    'src__Er du blitt mobbet digitalt (mobil, iPad, PC) de siste m?nedene?'
  ]);

  const trendPrefixes = ['2021-22', '2022-23', '2023-24', '2024-25', '2025-26'];
  const isStudentTrendKey = (k) => trendPrefixes.some((y) => k.startsWith(`src__${y}.Alle trinn.Alle trinn.Alle kjønn.Alle eierformer.`));
  const isStaffTrendKey = (k) => trendPrefixes.some((y) => k.startsWith(`src__${y}.Alle kjønn.Alle eierformer.`) || k.startsWith(`src__${y}.Alle trinn.Alle eierformer.Lærertetthet i ordinær undervisning`));

  const basicSet = new Set(basicKeys);
  const remainingKeys = allKeys.filter((k) => !compareKeys.has(k) && !basicSet.has(k) && !isStudentTrendKey(k) && !isStaffTrendKey(k)).sort();

  const basicRows = buildRows(basicKeys, p);
  const remainingRows = buildRows(remainingKeys, p);

  const sections = [];
  const compareSection = renderComparisonSection(p, benchmarks);
  if (compareSection) sections.push(compareSection);
  sections.push(renderTrendSection(p));
  sections.push(renderStaffTrendSection(p));

  if (basicRows) {
    sections.push(`
      <details class="detail-section" open>
        <summary>學校基本資訊</summary>
        <table>${basicRows}</table>
      </details>
    `);
  }
  if (remainingRows) {
    sections.push(`
      <details class="detail-section">
        <summary>其他資料</summary>
        <table>${remainingRows}</table>
      </details>
    `);
  }

  document.getElementById('detail-content').innerHTML = sections.join('') || '<p>此學校目前沒有可顯示資料。</p>';
  const helpBtn = document.getElementById('bully-help-btn');
  if (helpBtn) {
    helpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openHelp('bullying');
    });
  }
  const studentTrendHelpBtn = document.getElementById('student-trend-help-btn');
  if (studentTrendHelpBtn) {
    studentTrendHelpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openHelp('studentTrend');
    });
  }
  const staffTrendHelpBtn = document.getElementById('staff-trend-help-btn');
  if (staffTrendHelpBtn) {
    staffTrendHelpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openHelp('staffTrend');
    });
  }
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

async function loadBenchmarks() {
  const candidates = [
    '../data/benchmarks.json',
    './data/benchmarks.json',
    '/data/benchmarks.json',
    'data/benchmarks.json'
  ];
  for (const path of candidates) {
    try {
      const r = await fetch(path);
      if (!r.ok) continue;
      return await r.json();
    } catch (_) {}
  }
  return {};
}

Promise.all([loadSchoolGeoJson(), loadSchoolRows(), loadBenchmarks()]).then(([fc, rows, benchmarks]) => {
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
        renderDetail(p, benchmarks || {});
      });
      markerEntries.push({ marker, feature: f });

      const li = document.createElement('li');
      li.textContent = `${p.school_name}（學生 ${format(p.students_2025_26)} / 點 ${baseRadius}）`;
      li.onclick = () => {
        map.flyTo([lat, lon], 14, { duration: 0.6 });
        renderDetail(p, benchmarks || {});
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
