(function reportModule() {
  const CATEGORY_LABELS = {
    'PANJANG JALAN': 'Panjang Jalan',
    'DRIVING LICENSE': 'Driving License',
    'RAWAN TINDAK PIDANA': 'Rawan Tindak Pidana',
    'RAWAN LANGGAR': 'Rawan Langgar',
    PENDUDUK: 'Penduduk',
    BLACKSPOT: 'Blackspot',
    TROUBLESPOT: 'Troublespot',
    'PEOPLE MOBILITY': 'People Mobility',
    'RAWAN MACET / PERLAMBATAN': 'Rawan Macet / Perlambatan',
    VEHICLE: 'Vehicle',
    TRAFFIC: 'Traffic',
    'RAWAN LAKA': 'Rawan Laka',
    ACCIDENT: 'Accident',
    'RAWAN BENCANA': 'Rawan Bencana',
    'OBJECT VITAL': 'Object Vital',
    'OPERATION CONTROL': 'Operation Control',
    'CONTIGENCY SERVICE': 'Contingency Service',
    'MEDIA ACTIVITY': 'Media Activity',
    VIOLATION: 'Violation',
  };

  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
  const numberFormat = new Intl.NumberFormat('id-ID');

  function fmt(value) {
    return numberFormat.format(value || 0);
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

  function percent(part, total, digits) {
    if (!total || !part) return digits ? `0,${'0'.repeat(digits)}%` : '0%';
    return `${new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format((part / total) * 100)}%`;
  }

  function titleCase(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/(^|[\s./-])([a-zà-ü])/g, (match, sep, ch) => sep + ch.toUpperCase())
      .replace(/\bDi\b/g, 'DI')
      .replace(/\bDki\b/g, 'DKI');
  }

  function poldaName(value) {
    const name = titleCase(String(value || '—').replace(/^POLDA(?:\s+DAERAH)?\s+/i, ''));
    return name
      .replace(/^Kepulauan Bangka Belitung$/i, 'Kep. Bangka Belitung')
      .replace(/^Daerah Istimewa Yogyakarta$/i, 'DI Yogyakarta')
      .replace(/^Di Yogyakarta$/i, 'DI Yogyakarta');
  }

  function categoryLabel(value) {
    const key = String(value || '').trim().toUpperCase();
    return CATEGORY_LABELS[key] || titleCase(key);
  }

  function joinList(items) {
    if (items.length <= 1) return items[0] || '';
    return `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`;
  }

  function strong(value) {
    return `<b>${esc(value)}</b>`;
  }

  function icon(name) {
    const paths = {
      stack: '<path d="M4 7l8-3 8 3-8 3-8-3z"/><path d="M4 12l8 3 8-3"/><path d="M4 17l8 3 8-3"/>',
      shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
      layers: '<path d="M12 4l8 4-8 4-8-4 8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/>',
      check: '<circle cx="12" cy="12" r="8"/><path d="M8.5 12.5l2.2 2.2 4.8-5"/>',
      chart: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 4-6"/>',
      note: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h5"/><path d="M9 12h6"/><path d="M9 16h6"/>',
      bars: '<path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-7"/>',
      grid: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
      table: '<path d="M4 5h16v14H4z"/><path d="M4 10h16"/><path d="M4 15h16"/><path d="M9 5v14"/>',
      rank: '<path d="M7 20V8"/><path d="M12 20V4"/><path d="M17 20v-6"/>',
      bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M8 14a4 4 0 116 0c-.7.7-1 1.4-1 2h-4c0-.6-.3-1.3-1-2z"/>',
    };
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
  }

  function buildModel(payload) {
    const rows = payload.rows || [];
    const tanggal = payload.filters?.tanggal || '';
    const poldaMap = new Map();
    const kategoriMap = new Map();

    Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
      kategoriMap.set(key, { key, label, input: 0, polda: new Set() });
    });

    rows.forEach((row) => {
      const poldaKey = String(row.polda || '—').trim() || '—';
      const kategoriKey = String(row.kategori || '—').trim().toUpperCase() || '—';
      const input = Number(row.total_rows) || 0;
      if (!poldaMap.has(poldaKey)) {
        poldaMap.set(poldaKey, {
          key: poldaKey,
          label: poldaName(poldaKey),
          input: 0,
          filled: new Set(),
        });
      }
      if (!kategoriMap.has(kategoriKey)) {
        kategoriMap.set(kategoriKey, {
          key: kategoriKey,
          label: categoryLabel(kategoriKey),
          input: 0,
          polda: new Set(),
        });
      }
      const polda = poldaMap.get(poldaKey);
      const kategori = kategoriMap.get(kategoriKey);
      polda.input += input;
      kategori.input += input;
      if (input > 0) {
        polda.filled.add(kategoriKey);
        kategori.polda.add(poldaKey);
      }
    });

    const categories = [...kategoriMap.values()]
      .sort((a, b) => a.label.localeCompare(b.label, 'id'));
    const poldas = [...poldaMap.values()]
      .sort((a, b) => b.input - a.input || a.label.localeCompare(b.label, 'id'));
    const poldaCount = poldas.length;
    const kategoriCount = categories.length;
    const totalInput = poldas.reduce((sum, item) => sum + item.input, 0);
    const filledCells = categories.reduce((sum, item) => sum + item.polda.size, 0);
    const cells = poldaCount * kategoriCount;
    const byFill = new Map();
    poldas.forEach((polda) => {
      const count = polda.filled.size;
      if (!byFill.has(count)) byFill.set(count, []);
      byFill.get(count).push(polda);
    });
    const lengkap = kategoriCount ? (byFill.get(kategoriCount) || []).length : 0;
    const positive = [...byFill.entries()]
      .filter(([count]) => count > 0)
      .sort((a, b) => b[0] - a[0]);
    const maxFill = positive.length ? positive[0][0] : 0;
    const minFill = positive.length ? positive[positive.length - 1][0] : 0;
    const zeroCount = (byFill.get(0) || []).length;

    const distribution = positive.map(([count, list]) => (
      `${strong(fmt(list.length))} Polda mengisi ${strong(fmt(count))} kategori`
    ));
    if (zeroCount) distribution.push(`${strong(fmt(zeroCount))} Polda belum mengisi satu pun kategori`);

    const lengkapText = lengkap
      ? `${strong(fmt(lengkap))} dari ${strong(fmt(poldaCount))} Polda mengisi seluruh kategori.`
      : 'Belum ada Polda yang mengisi seluruh kategori.';
    const summaryHtml = poldaCount
      ? `Dataset mencatat ${strong(fmt(totalInput))} input dari ${strong(fmt(poldaCount))} Polda pada ${strong(fmt(kategoriCount))} kategori. Dari ${strong(fmt(cells))} kombinasi Polda–kategori, ${strong(fmt(filledCells))} sel berisi input dan ${strong(fmt(cells - filledCells))} sel bernilai 0, sehingga keterisian sel mencapai ${strong(percent(filledCells, cells, 1))}. ${lengkapText}${distribution.length ? ` ${joinList(distribution)}.` : ''}`
      : 'Belum ada data Polda pada tanggal ini.';

    const top = poldas[0];
    const withInput = poldas.filter((item) => item.input > 0);
    const low = withInput[withInput.length - 1];
    const filledCategories = categories
      .filter((item) => item.input > 0)
      .sort((a, b) => b.input - a.input);
    const emptyCategories = categories.length - filledCategories.length;
    const categoryBits = filledCategories.slice(0, 3).map((item) => (
      `${item.label} (${fmt(item.polda.size)}/${fmt(poldaCount)} Polda, ${fmt(item.input)} input)`
    ));
    const categoryLine = filledCategories.length
      ? `Kategori terisi: ${joinList(categoryBits)}${filledCategories.length > 3 ? `, serta ${fmt(filledCategories.length - 3)} kategori terisi lainnya` : ''}${emptyCategories ? `; ${fmt(emptyCategories)} kategori lainnya 0 input.` : '.'}`
      : 'Belum ada kategori yang terisi.';

    const insights = [
      {
        label: 'INPUT TERTINGGI',
        text: top && top.input
          ? `POLDA ${top.label.toUpperCase()} — ${fmt(top.input)} input (${fmt(top.filled.size)}/${fmt(kategoriCount)} kategori).`
          : 'belum ada input pada tanggal ini.',
      },
      {
        label: 'KELENGKAPAN TERTINGGI',
        text: maxFill
          ? `${fmt(positive[0][1].length)} Polda mengisi ${fmt(maxFill)} dari ${fmt(kategoriCount)} kategori (${percent(maxFill, kategoriCount, 1)}).`
          : 'belum ada Polda yang mengisi kategori.',
      },
      {
        label: 'KELENGKAPAN TERENDAH',
        text: zeroCount
          ? `${fmt(zeroCount)} Polda belum mengisi satu pun kategori.`
          : `${fmt((byFill.get(minFill) || []).length)} Polda hanya mengisi ${fmt(minFill)} dari ${fmt(kategoriCount)} kategori (${percent(minFill, kategoriCount, 1)}).`,
      },
      {
        label: 'INPUT TERENDAH',
        text: low
          ? `Polda ${low.label} — ${fmt(low.input)} input nasional.`
          : 'belum ada input pada tanggal ini.',
      },
      { label: '', text: categoryLine },
    ];

    return {
      tanggal,
      year: tanggal.slice(0, 4) || String(new Date().getFullYear()),
      footerDate: footerDate(tanggal),
      poldaCount,
      kategoriCount,
      totalInput,
      filledCells,
      cells,
      lengkap,
      categories,
      poldas,
      summaryHtml,
      insights,
    };
  }

  function footerDate(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!match) return '';
    return `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
  }

  function fileName(model) {
    const stamp = model.footerDate.replace(/\s+/g, '_') || 'tanggal';
    return `Laporan_ARSY_${stamp}.png`;
  }

  function bar(ratio) {
    const width = Math.max(0, Math.min(100, ratio * 100));
    return `<span class="track"><i style="width:${width}%"></i></span>`;
  }

  function coverageClass(ratio) {
    if (ratio >= 1) return 'coverage-full';
    if (ratio > 0) return 'coverage-some';
    return 'coverage-zero';
  }

  function render(model) {
    const rows = Math.max(1, Math.ceil(model.poldas.length / 2));
    const alpha = model.poldas.slice().sort((a, b) => a.label.localeCompare(b.label, 'id'));
    const mid = Math.ceil(model.poldas.length / 2);
    const ranks = [model.poldas.slice(0, mid), model.poldas.slice(mid)];

    const categoryBars = model.categories.map((item) => {
      const ratio = model.poldaCount ? item.polda.size / model.poldaCount : 0;
      return `<div class="cat-row"><span title="${esc(item.label)}">${esc(item.label)}</span>${bar(ratio)}<b>${fmt(item.polda.size)}/${fmt(model.poldaCount)}</b></div>`;
    }).join('');

    const poldaBars = alpha.map((item) => {
      const ratio = model.kategoriCount ? item.filled.size / model.kategoriCount : 0;
      return `<div class="polda-row"><span title="${esc(item.label)}">${esc(item.label)}</span><b>${fmt(item.filled.size)}/${fmt(model.kategoriCount)}</b>${bar(ratio)}</div>`;
    }).join('');

    const tableRows = model.categories.map((item, index) => {
      const ratio = model.poldaCount ? item.polda.size / model.poldaCount : 0;
      const alt = index % 2 === 1 ? ' alt' : '';
      return `<div class="ac${alt}">${esc(item.label)}</div><div class="ac n${alt}">${fmt(item.input)}</div><div class="ac n${alt}">${fmt(item.polda.size)}/${fmt(model.poldaCount)}</div><div class="ac n ${coverageClass(ratio)}${alt}">${percent(item.polda.size, model.poldaCount, 1)}</div>`;
    }).join('');

    const rankTables = ranks.map((list, side) => {
      const body = list.map((item, index) => {
        const rank = side === 0 ? index + 1 : mid + index + 1;
        return `<tr><td>${rank}</td><td title="${esc(item.label)}">${esc(item.label)}</td><td>${fmt(item.input)}</td><td>${fmt(item.filled.size)}/${fmt(model.kategoriCount)}</td><td>${percent(item.input, model.totalInput, item.input && model.totalInput && (item.input / model.totalInput) < 0.1 ? 1 : 0)}</td></tr>`;
      }).join('');
      return `<table class="rank-table"><thead><tr><th>#</th><th>Polda</th><th>Input</th><th>Kat.</th><th>%</th></tr></thead><tbody>${body}</tbody></table>`;
    }).join('');

    const insightRows = model.insights.map((item) => (
      `<p><i></i><span>${item.label ? `<b>${esc(item.label)}:</b> ` : ''}${esc(item.text)}</span></p>`
    )).join('');

    return `<article class="sheet">
      <header class="banner">
        <div class="brand-row">
          ${crest()}
          <div class="org"><strong>KORLANTAS POLRI</strong><span>Korps Lalu Lintas</span></div>
          <span class="vbar"></span>
          <div class="arsy-word">ARSY</div>
        </div>
        <h1>LAPORAN HARIAN</h1>
        <div class="ribbon">ALGORITMA ROAD SAFETY • ${esc(model.year)}</div>
        <p class="banner-sub">${fmt(model.poldaCount)} Polda | Kesiapan Input &amp; Kelengkapan Kategori</p>
      </header>
      <div class="body">
        <section class="kpis">
          <article class="kpi"><i>${icon('stack')}</i><div><b>${fmt(model.totalInput)}</b><span>Total input nasional</span></div></article>
          <article class="kpi"><i>${icon('shield')}</i><div><b>${fmt(model.poldaCount)}</b><span>Polda dianalisis</span></div></article>
          <article class="kpi"><i>${icon('layers')}</i><div><b>${fmt(model.kategoriCount)}</b><span>Kategori pada file</span></div></article>
          <article class="kpi"><i>${icon('check')}</i><div><b>${percent(model.filledCells, model.cells, 1)}</b><span>Keterisian sel data</span></div></article>
          <article class="kpi"><i>${icon('chart')}</i><div><b>${fmt(model.lengkap)}/${fmt(model.poldaCount)}</b><span>Polda mengisi<br>seluruh kategori</span></div></article>
        </section>
        <section class="summary">
          <div class="band">${icon('note')} RINGKASAN EKSEKUTIF</div>
          <p>${model.summaryHtml}</p>
        </section>
        <section class="cols">
          <article class="card">
            <div class="band">${icon('bars')} KETERSEDIAAN INPUT PER KATEGORI</div>
            <div class="card-body">
              <p class="note">Jumlah Polda dengan input tercatat (maksimum ${fmt(model.poldaCount)})</p>
              ${categoryBars}
            </div>
          </article>
          <article class="card">
            <div class="band">${icon('grid')} KELENGKAPAN KATEGORI PER POLDA</div>
            <div class="card-body">
              <p class="note">Setiap segmen = 1 kategori dari total ${fmt(model.kategoriCount)} kategori</p>
              <div class="polda-grid" style="grid-template-rows:repeat(${rows}, auto)">${poldaBars}</div>
            </div>
          </article>
        </section>
        <section class="bottom">
          <article class="card">
            <div class="band">${icon('table')} TABEL KETERSEDIAAN KATEGORI</div>
            <div class="card-body">
              <div class="avail-grid">
                <div class="ah">Kategori</div>
                <div class="ah n">Input</div>
                <div class="ah n">Polda</div>
                <div class="ah n">Coverage</div>
                ${tableRows}
              </div>
            </div>
          </article>
          <article class="card">
            <div class="band">${icon('rank')} RANKING INPUT PER POLDA</div>
            <div class="card-body"><div class="rank-split">${rankTables}</div></div>
          </article>
        </section>
        <section class="insight">
          <div class="band">${icon('bulb')} INSIGHT</div>
          <div class="insight-list">${insightRows}</div>
        </section>
      </div>
      <footer class="footer"><span>ALGORITMA ROAD SAFETY • ${esc(model.year)}</span><span>${esc(model.footerDate)}</span></footer>
    </article>`;
  }

  function crest() {
    return `<svg class="crest" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="34" fill="#f4e2a8"/>
      <circle cx="36" cy="36" r="30" fill="#0b3f86"/>
      <path d="M36 12l16 6v14c0 10-7 17-16 20-9-3-16-10-16-20V18l16-6z" fill="#f7f1df"/>
      <path d="M24 40h24M28 34h16M30 28h12" stroke="#0b3f86" stroke-width="2" fill="none"/>
      <circle cx="36" cy="24" r="3" fill="#c8962e"/>
    </svg>`;
  }

  function mark() {
    return `<svg class="arsy-mark" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="34" fill="#f4e2a8"/>
      <circle cx="36" cy="36" r="30" fill="#123f86"/>
      <text x="36" y="42" text-anchor="middle" font-size="16" font-family="Segoe UI, sans-serif" font-weight="800" fill="#fff">ARSY</text>
    </svg>`;
  }

  function fitTables(sheet) {
    const split = sheet.querySelector('.rank-split');
    if (!split) return;
    const column = `${Math.floor((split.clientWidth - 8) / 2)}px`;
    split.querySelectorAll('.rank-table').forEach((table) => {
      table.style.width = column;
      table.style.maxWidth = column;
      table.style.minWidth = '0';
    });
  }

  function mount(payload) {
    const model = buildModel(payload);
    const stage = document.getElementById('report-stage');
    stage.innerHTML = render(model);
    const sheet = stage.querySelector('.sheet');
    fitTables(sheet);
    return sheet;
  }

  async function save(payload) {
    if (typeof window.html2canvas !== 'function') {
      throw new Error('Pustaka pembuat gambar laporan belum termuat.');
    }
    const model = buildModel(payload);
    const sheet = mount(payload);
    try {
      const canvas = await window.html2canvas(sheet, {
        scale: 2,
        backgroundColor: '#e7f0fa',
        logging: false,
        width: 1040,
        windowWidth: 1040,
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Gambar laporan gagal dibuat.');
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = fileName(model);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      stageClear();
    }
  }

  function stageClear() {
    const stage = document.getElementById('report-stage');
    if (stage) stage.innerHTML = '';
  }

  window.KompulirReport = { save, buildModel, mount };
}());
