const state = {
  payload: null,
  level: 'polres',
  query: '',
  status: 'all',
  sortKey: 'polda',
  sortDir: 'asc',
  page: 1,
  pageSize: 25,
  charts: { bar: null, status: null },
};

const numberFormat = new Intl.NumberFormat('id-ID');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const els = {
  form: document.getElementById('filters'),
  tanggal: document.getElementById('tanggal'),
  kategori: document.getElementById('kategori'),
  submit: document.getElementById('submit-btn'),
  loadbar: document.getElementById('loadbar'),
  alert: document.getElementById('alert'),
  result: document.getElementById('result-line'),
  mastDate: document.getElementById('mast-date'),
  kpiTotal: document.getElementById('kpi-total'),
  kpiSudah: document.getElementById('kpi-sudah'),
  kpiBelum: document.getElementById('kpi-belum'),
  kpiTotalNote: document.getElementById('kpi-total-note'),
  kpiSudahNote: document.getElementById('kpi-sudah-note'),
  kpiBelumNote: document.getElementById('kpi-belum-note'),
  chartTitle: document.getElementById('chart-title'),
  chartSub: document.getElementById('chart-sub'),
  barBox: document.getElementById('bar-box'),
  chartEmpty: document.getElementById('chart-empty'),
  donutLayout: document.getElementById('donut-layout'),
  statusRate: document.getElementById('status-rate'),
  legendSudah: document.getElementById('legend-sudah'),
  legendBelum: document.getElementById('legend-belum'),
  statusEmpty: document.getElementById('status-empty'),
  search: document.getElementById('search'),
  exportBtn: document.getElementById('export-btn'),
  reportBtn: document.getElementById('report-btn'),
  pageSize: document.getElementById('page-size'),
  tbody: document.getElementById('tbody'),
  pager: document.getElementById('pager'),
  range: document.getElementById('range-label'),
  countAll: document.getElementById('count-all'),
  countSudah: document.getElementById('count-sudah'),
  countBelum: document.getElementById('count-belum'),
};

if (window.Chart) {
  Chart.defaults.font.family = '"Segoe UI", sans-serif';
  Chart.defaults.color = '#64748b';
  Chart.defaults.animation = reduceMotion ? false : { duration: 400 };
}

function fmt(value) {
  return numberFormat.format(value || 0);
}

function formatDate(iso, month = 'short') {
  if (!iso) return '—';
  const [year, mon, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month,
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, mon - 1, day)));
}

function formatPercent(part, total) {
  if (!total || !part) return '0%';
  const value = (part / total) * 100;
  if (value > 0 && value < 0.1) return '< 0,1%';
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value)}%`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function showError(message) {
  els.alert.hidden = false;
  els.alert.textContent = message;
}

function clearError() {
  els.alert.hidden = true;
  els.alert.textContent = '';
}

function setLoading(on) {
  els.loadbar.hidden = !on;
  els.submit.disabled = on;
  if (els.reportBtn) els.reportBtn.disabled = on;
  document.body.classList.toggle('is-loading', on);
}

function currentLevel() {
  return state.level === 'polda' ? 'polda' : 'polres';
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = [data.error, data.detail].filter(Boolean).join('. ');
    throw new Error(message || `Permintaan gagal (${response.status}).`);
  }
  return data;
}

async function boot() {
  try {
    const meta = await readJson(await fetch('/api/meta'));
    for (const category of meta.categories || []) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      els.kategori.append(option);
    }
    els.tanggal.value = meta.today;
    els.mastDate.textContent = formatDate(meta.today, 'long');
    await load({ refresh: false });
  } catch (err) {
    els.mastDate.textContent = 'Database belum terjangkau';
    showError(err.message || 'Gagal memuat metadata dashboard.');
  }
}

async function load({ refresh }) {
  clearError();
  setLoading(true);
  const params = new URLSearchParams({
    tanggal: els.tanggal.value,
    level: currentLevel(),
  });
  if (els.kategori.value) params.set('kategori', els.kategori.value);
  if (refresh) params.set('refresh', '1');

  try {
    const payload = await readJson(await fetch(`/api/kompulir?${params.toString()}`));
    state.page = 1;
    state.payload = payload;
    els.mastDate.textContent = formatDate(payload.filters.tanggal, 'long');
    renderSummary(payload);
    renderCharts(payload);
    renderTable();
  } catch (err) {
    showError(err.message || 'Gagal mengambil data kompulir.');
  } finally {
    setLoading(false);
  }
}

function renderSummary(payload) {
  const { summary, filters } = payload;
  const entitas = summary.entitas || 0;

  els.kpiTotal.textContent = fmt(summary.total_rows);
  els.kpiSudah.textContent = fmt(summary.sudah);
  els.kpiBelum.textContent = fmt(summary.belum);
  els.kpiTotalNote.textContent = `SUM(total_rows) · ${fmt(summary.wilayah)} ${filters.level}`;
  els.kpiSudahNote.textContent = `${formatPercent(summary.sudah, entitas)} dari ${fmt(entitas)} entitas`;
  els.kpiBelumNote.textContent = `${formatPercent(summary.belum, entitas)} dari ${fmt(entitas)} entitas`;
  setMeter('meter-sudah', summary.sudah, entitas);
  setMeter('meter-belum', summary.belum, entitas);

  const kategoriLabel = filters.kategori === 'ALL' ? 'semua kategori' : filters.kategori;
  els.result.textContent = `${formatDate(filters.tanggal, 'long')} · ${kategoriLabel} · level ${filters.level} · ${fmt(summary.wilayah)} wilayah · ${fmt(entitas)} entitas`;
}

function setMeter(id, part, total) {
  const bar = document.getElementById(id);
  if (!bar) return;
  const pct = total ? (part / total) * 100 : 0;
  bar.style.width = part > 0 ? `${Math.max(pct, 2.5)}%` : '0%';
}

function barSeries(payload) {
  if (payload.chart_mode === 'kategori') {
    return payload.by_kategori.map((item) => ({
      label: item.kategori,
      total_rows: item.total_rows,
      action: 'kategori',
      value: item.kategori,
    }));
  }

  const items = payload.by_wilayah.map((item) => ({
    label: item.nama,
    total_rows: item.total_rows,
    action: 'wilayah',
    value: item.nama.includes(' · ') ? item.nama.split(' · ')[0] : item.nama,
  }));
  if (items.length <= 12) return items;
  const rest = items.slice(12).reduce((sum, item) => sum + item.total_rows, 0);
  return [...items.slice(0, 12), { label: 'Lainnya', total_rows: rest, action: null, value: null }];
}

function barColor(item) {
  if (!item?.action) return '#cbd5e1';
  const selected = item.action === 'wilayah'
    && state.query.trim().toLowerCase() === String(item.value).toLowerCase();
  return selected ? '#115e59' : '#0f766e';
}

function renderCharts(payload) {
  const hasRows = payload.rows.length > 0;
  const series = barSeries(payload);
  state.barSeries = series;
  const useKategori = payload.chart_mode === 'kategori';

  els.chartTitle.textContent = useKategori
    ? 'Total baris per kategori'
    : `Total baris per ${payload.filters.level === 'polda' ? 'Polda' : 'Polres'}`;
  els.chartSub.textContent = useKategori
    ? 'Klik batang untuk menyaring kategori'
    : series.some((item) => !item.action)
      ? `Klik batang untuk menyaring tabel. 12 ${payload.filters.level} teratas, sisanya digabung`
      : `Klik batang untuk menyaring tabel per ${payload.filters.level}`;

  els.barBox.hidden = !hasRows;
  els.chartEmpty.hidden = hasRows;
  if (hasRows) {
    els.barBox.style.height = `${Math.max(320, series.length * 28 + 36)}px`;
    drawBar(series);
  } else if (state.charts.bar) {
    releaseChart('bar');
  }

  const sudah = payload.summary.sudah;
  const belum = payload.summary.belum;
  const total = sudah + belum;
  els.donutLayout.hidden = total === 0;
  els.statusEmpty.hidden = total !== 0;
  els.legendSudah.textContent = fmt(sudah);
  els.legendBelum.textContent = fmt(belum);
  els.statusRate.textContent = total ? formatPercent(sudah, total) : '—';

  if (total > 0) drawStatus(sudah, belum);
  else if (state.charts.status) {
    releaseChart('status');
  }
}

async function onBarClick(item) {
  if (!item?.action) return;
  if (item.action === 'kategori') {
    els.kategori.value = els.kategori.value === item.value ? '' : item.value;
    state.query = '';
    els.search.value = '';
    await load({ refresh: false });
  } else {
    const same = state.query.trim().toLowerCase() === String(item.value).toLowerCase();
    state.query = same ? '' : item.value;
    els.search.value = state.query;
    state.page = 1;
    renderTable();
    paintBarActive();
  }
}

function paintBarActive() {
  const chart = state.charts.bar;
  if (!chart || !state.barSeries) return;
  chart.data.datasets[0].backgroundColor = state.barSeries.map(barColor);
  chart.update('none');
}

function paintStatusChart() {
  const chart = state.charts.status;
  if (!chart) return;
  chart.update('none');
}

function releaseChart(key) {
  const chart = state.charts[key];
  state.charts[key] = null;
  if (!chart) return;
  try { chart.stop(); } catch (err) { /* animasi yang sedang jalan diabaikan */ }
  try { chart.destroy(); } catch (err) { /* canvas tetap dipakai untuk grafik baru */ }
}

function drawBar(series) {
  if (!window.Chart) return;
  releaseChart('bar');
  state.charts.bar = new Chart(document.getElementById('chart-bar'), {
    type: 'bar',
    data: {
      labels: series.map((item) => item.label),
      datasets: [{
        label: 'Total baris',
        data: series.map((item) => item.total_rows),
        backgroundColor: series.map(barColor),
        borderRadius: 6,
        maxBarThickness: 18,
      }],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', axis: 'y', intersect: false },
      onHover(event, elements) {
        const item = elements.length ? series[elements[0].index] : null;
        event.native.target.style.cursor = item?.action ? 'pointer' : 'default';
      },
      onClick(event, _elements, chart) {
        const hits = chart.getElementsAtEventForMode(
          event,
          'nearest',
          { intersect: false, axis: 'y' },
          false
        );
        if (hits.length) setTimeout(() => onBarClick(series[hits[0].index]), 0);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${fmt(ctx.parsed.x)} baris`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#eef2f6' },
          border: { display: false },
          ticks: { callback: (value) => fmt(value) },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            autoSkip: false,
            callback(value) {
              const label = this.getLabelForValue(value);
              return label.length > 34 ? `${label.slice(0, 32)}…` : label;
            },
          },
        },
      },
    },
  });
}

function drawStatus(sudah, belum) {
  if (!window.Chart) return;
  releaseChart('status');
  state.charts.status = new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: {
      labels: ['Sudah', 'Belum'],
      datasets: [{
        data: [sudah, belum],
        backgroundColor: ['#0f766e', '#f59e0b'],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      cutout: '72%',
      maintainAspectRatio: false,
      animation: false,
      onHover(event, elements) {
        event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      onClick(_event, elements) {
        if (!elements.length) return;
        const label = String(state.charts.status.data.labels[elements[0].index] || '').toLowerCase();
        setTimeout(() => {
          state.status = state.status === label ? 'all' : label;
          state.page = 1;
          renderTable();
        }, 0);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${fmt(ctx.parsed)} entitas`,
          },
        },
      },
    },
  });
}

function matchedRows() {
  const rows = state.payload?.rows || [];
  const query = state.query.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) => [row.tanggal, row.polda, row.polres, row.kategori, row.status_kompulir]
    .some((value) => String(value ?? '').toLowerCase().includes(query)));
}

function visibleRows() {
  const matched = matchedRows();
  const filtered = state.status === 'all'
    ? matched
    : matched.filter((row) => row.status_kompulir === state.status);
  return sortedRows(filtered);
}

const EXPORT_COLUMNS = [
  ['tanggal', 'Tanggal'],
  ['polda', 'Polda'],
  ['polres', 'Polres'],
  ['kategori', 'Kategori'],
  ['total_rows', 'Total baris'],
  ['status_kompulir', 'Status'],
];

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[;"\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportCsv() {
  const rows = visibleRows();
  if (!rows.length) return;

  const header = EXPORT_COLUMNS.map(([, label]) => csvCell(label)).join(';');
  const body = rows.map((row) => EXPORT_COLUMNS.map(([key]) => csvCell(row[key] ?? '')).join(';')).join('\r\n');
  const blob = new Blob([`\uFEFF${header}\r\n${body}`], { type: 'text/csv;charset=utf-8' });
  const filters = state.payload?.filters || {};
  const kategori = String(filters.kategori || 'ALL')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `kompulir-${filters.tanggal || 'tanggal'}-${filters.level || state.level}-${kategori}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function sortedRows(rows) {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  const key = state.sortKey;
  return rows.slice().sort((a, b) => {
    if (key === 'total_rows') return (a.total_rows - b.total_rows) * dir;
    return String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'id', {
      numeric: true,
      sensitivity: 'base',
    }) * dir;
  });
}

function renderTable() {
  const matched = matchedRows();
  const sudah = matched.filter((row) => row.status_kompulir === 'sudah').length;
  const belum = matched.filter((row) => row.status_kompulir === 'belum').length;
  els.countAll.textContent = fmt(matched.length);
  els.countSudah.textContent = fmt(sudah);
  els.countBelum.textContent = fmt(belum);

  document.querySelectorAll('[data-status]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.status === state.status));
  });

  const visible = visibleRows();
  const pages = Math.max(1, Math.ceil(visible.length / state.pageSize));
  if (state.page > pages) state.page = pages;
  const start = (state.page - 1) * state.pageSize;
  const slice = visible.slice(start, start + state.pageSize);

  if (!state.payload) {
    els.range.textContent = 'Menunggu data.';
  } else if (!visible.length) {
    els.range.textContent = 'Tidak ada baris pada saringan ini.';
  } else {
    els.range.textContent = `Menampilkan ${fmt(start + 1)}–${fmt(start + slice.length)} dari ${fmt(visible.length)}`;
  }

  els.tbody.innerHTML = slice.length
    ? slice.map((row) => {
      const status = String(row.status_kompulir || '').toLowerCase();
      const badgeClass = status === 'sudah' || status === 'belum' ? `badge badge-${status}` : 'badge';
      return `<tr>
        <td>${esc(formatDate(row.tanggal))}</td>
        <td class="clip" title="${esc(row.polda)}">${esc(row.polda || '—')}</td>
        <td class="clip" title="${esc(row.polres)}">${esc(row.polres || '—')}</td>
        <td class="clip" title="${esc(row.kategori)}">${esc(row.kategori)}</td>
        <td class="num">${fmt(row.total_rows)}</td>
        <td><span class="${badgeClass}">${esc(status || '—')}</span></td>
      </tr>`;
    }).join('')
    : '<tr><td class="empty-row" colspan="6">Tidak ada baris yang cocok dengan pencarian atau filter status.</td></tr>';

  els.exportBtn.disabled = !visible.length;

  renderSortIndicators();
  renderPager(pages);
  paintBarActive();
  paintStatusChart();
}

function renderSortIndicators() {
  document.querySelectorAll('[data-sort]').forEach((button) => {
    const active = button.dataset.sort === state.sortKey;
    const th = button.closest('th');
    th.setAttribute('aria-sort', active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    button.querySelector('.arrow').textContent = active ? (state.sortDir === 'asc' ? '↑' : '↓') : '';
  });
}

function renderPager(pages) {
  if (!state.payload || pages <= 1) {
    els.pager.innerHTML = '';
    return;
  }

  const buttons = [`<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>Sebelumnya</button>`];
  const width = 5;
  let from = Math.max(1, state.page - 2);
  let to = Math.min(pages, from + width - 1);
  from = Math.max(1, to - width + 1);
  for (let page = from; page <= to; page += 1) {
    buttons.push(`<button type="button" data-page="${page}" ${page === state.page ? 'aria-current="page"' : ''}>${page}</button>`);
  }
  buttons.push(`<button type="button" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''}>Berikutnya</button>`);
  els.pager.innerHTML = buttons.join('');
}

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  load({ refresh: true });
});

els.tanggal.addEventListener('change', () => load({ refresh: false }));
els.kategori.addEventListener('change', () => load({ refresh: false }));

document.querySelectorAll('[data-level]').forEach((button) => {
  button.addEventListener('click', () => {
    state.level = button.dataset.level;
    document.querySelectorAll('[data-level]').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    load({ refresh: false });
  });
});

let searchTimer = 0;
els.search.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.query = els.search.value;
    state.page = 1;
    renderTable();
  }, 120);
});

document.querySelectorAll('[data-status]').forEach((button) => {
  button.addEventListener('click', () => {
    state.status = button.dataset.status;
    state.page = 1;
    renderTable();
    paintStatusChart();
  });
});

document.querySelector('thead').addEventListener('click', (event) => {
  const button = event.target.closest('[data-sort]');
  if (!button) return;
  const key = button.dataset.sort;
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortKey = key;
    state.sortDir = key === 'total_rows' ? 'desc' : 'asc';
  }
  state.page = 1;
  renderTable();
});

els.exportBtn.addEventListener('click', exportCsv);

els.reportBtn.addEventListener('click', async () => {
  if (!els.tanggal.value || !window.KompulirReport) return;
  clearError();
  setLoading(true);
  const label = els.reportBtn.textContent;
  els.reportBtn.textContent = 'Menyusun…';
  try {
    const tanggal = els.tanggal.value;
    const current = state.payload;
    const reusable = current
      && current.filters.tanggal === tanggal
      && current.filters.level === 'polda'
      && current.filters.kategori === 'ALL';
    const payload = reusable
      ? current
      : await readJson(await fetch(`/api/kompulir?${new URLSearchParams({ tanggal, level: 'polda' })}`));
    await window.KompulirReport.save(payload);
  } catch (err) {
    showError(err.message || 'Gagal membuat laporan.');
  } finally {
    els.reportBtn.textContent = label;
    setLoading(false);
  }
});

els.pageSize.addEventListener('change', () => {
  state.pageSize = Number(els.pageSize.value) || 25;
  state.page = 1;
  renderTable();
});

els.pager.addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (!button || button.disabled) return;
  state.page = Number(button.dataset.page);
  renderTable();
  document.querySelector('.table-wrap')?.scrollTo({ top: 0 });
});

boot();
