const express = require('express');
const { query, ensureInfo, mapDbError } = require('../db');
const { CATEGORIES, LEVELS } = require('../categories');
const { loadSourceSummary, loadSourceDetail, SOURCES } = require('../sources');

const router = express.Router();

const cache = new Map();
const inflight = new Map();
const CACHE_MS = 20000;

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function summarize(rows, level) {
  let totalRows = 0;
  let sudah = 0;
  let belum = 0;
  const wilayah = new Set();
  const byKategori = new Map();
  const byWilayah = new Map();

  for (const row of rows) {
    const count = Number.isFinite(row.total_rows) ? row.total_rows : 0;
    totalRows += count;

    const status = String(row.status_kompulir || '').toLowerCase();
    if (status === 'sudah') sudah += 1;
    else if (status === 'belum') belum += 1;

    const wilayahKey = level === 'polda'
      ? (row.polda || '—')
      : `${row.polda || '—'}||${row.polres || '—'}`;
    const namaWilayah = level === 'polda'
      ? (row.polda || '—')
      : (row.polres ? `${row.polres} · ${row.polda}` : (row.polda || '—'));
    wilayah.add(wilayahKey);

    const kategori = row.kategori || '—';
    const kat = byKategori.get(kategori) || {
      kategori,
      total_rows: 0,
      sudah: 0,
      belum: 0,
    };
    kat.total_rows += count;
    if (status === 'sudah') kat.sudah += 1;
    else if (status === 'belum') kat.belum += 1;
    byKategori.set(kategori, kat);

    const wilayahRow = byWilayah.get(wilayahKey) || {
      nama: namaWilayah,
      total_rows: 0,
      sudah: 0,
      belum: 0,
    };
    wilayahRow.total_rows += count;
    if (status === 'sudah') wilayahRow.sudah += 1;
    else if (status === 'belum') wilayahRow.belum += 1;
    byWilayah.set(wilayahKey, wilayahRow);
  }

  const byKategoriList = [...byKategori.values()].sort((a, b) => b.total_rows - a.total_rows || a.kategori.localeCompare(b.kategori, 'id'));
  const byWilayahList = [...byWilayah.values()].sort((a, b) => b.total_rows - a.total_rows || a.nama.localeCompare(b.nama, 'id'));

  return {
    summary: {
      total_rows: totalRows,
      sudah,
      belum,
      entitas: rows.length,
      wilayah: wilayah.size,
    },
    by_kategori: byKategoriList,
    by_wilayah: byWilayahList,
    chart_mode: byKategoriList.length > 1 ? 'kategori' : 'wilayah',
  };
}

async function loadKompulir(tanggal, kategori, level, force = false) {
  const key = `${tanggal}|${kategori ?? ''}|${level}`;
  if (force) cache.delete(key);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (inflight.has(key)) return inflight.get(key);

  const pending = (async () => {
    const started = Date.now();
    const result = await query(
      `SELECT year_month,
              to_char(tanggal, 'YYYY-MM-DD') AS tanggal,
              polda,
              polres,
              tabel_name,
              kategori,
              total_rows,
              status_kompulir
         FROM get_daily_kompulir($1::date, $2::text, $3::text)`,
      [tanggal, kategori, level]
    );

    const rows = result.rows.map((row) => {
      const total = Number(row.total_rows);
      return {
        year_month: row.year_month,
        tanggal: row.tanggal,
        polda: row.polda,
        polres: row.polres,
        tabel_name: row.tabel_name,
        kategori: row.kategori,
        total_rows: Number.isFinite(total) ? total : 0,
        status_kompulir: row.status_kompulir,
      };
    });

    const info = await ensureInfo();
    const aggregated = summarize(rows, level);
    const value = {
      filters: {
        tanggal,
        kategori: kategori ?? 'ALL',
        level,
      },
      source: {
        database: info.database,
        schema_requested: info.schemaRequested,
        schema_active: info.schemaActive,
        function: info.functionName,
        note: info.note,
      },
      ...aggregated,
      rows,
      elapsed_ms: Date.now() - started,
      generated_at: new Date().toISOString(),
    };

    cache.set(key, { expires: Date.now() + CACHE_MS, value });
    console.log(
      `[kompulir] ${tanggal} kategori=${kategori ?? 'ALL'} level=${level} ` +
        `rows=${rows.length} ${value.elapsed_ms}ms`
    );
    return value;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, pending);
  return pending;
}

router.get('/health', asyncRoute(async (req, res) => {
  const info = await ensureInfo();
  await query('SELECT 1 AS ok');
  res.json({
    ok: true,
    database: info.database,
    schema_requested: info.schemaRequested,
    schema_active: info.schemaActive,
    function: info.functionName,
    note: info.note,
    today: info.today,
  });
}));

router.get('/meta', asyncRoute(async (req, res) => {
  const info = await ensureInfo();
  res.json({
    today: info.today,
    categories: CATEGORIES,
    levels: LEVELS,
    database: info.database,
    schema_requested: info.schemaRequested,
    schema_active: info.schemaActive,
    function: info.functionName,
    note: info.note,
  });
}));

function sourceLevel(value) {
  const level = String(value || 'polres').trim().toLowerCase();
  return LEVELS.includes(level) ? level : null;
}

async function cachedSource(key, loader) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (inflight.has(key)) return inflight.get(key);
  const job = Promise.resolve()
    .then(loader)
    .then((value) => {
      cache.set(key, { value, expires: Date.now() + CACHE_MS });
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, job);
  return job;
}

router.get('/kompulir/sumber/detail', asyncRoute(async (req, res) => {
  const info = await ensureInfo();
  const tanggal = String(req.query.tanggal || info.today).trim();
  const level = sourceLevel(req.query.level);
  const key = String(req.query.kategori || '').trim().toUpperCase();
  if (!isValidDate(tanggal)) {
    return res.status(400).json({
      error: 'Parameter tanggal tidak valid',
      detail: 'Gunakan format YYYY-MM-DD, contoh 2026-11-25.',
    });
  }
  if (!level) {
    return res.status(400).json({
      error: 'Parameter level tidak valid',
      detail: 'Gunakan polres atau polda.',
    });
  }
  if (!SOURCES.some((item) => item.key === key)) {
    return res.status(400).json({
      error: 'Parameter kategori tidak dikenal',
      detail: 'Pilih salah satu kategori sumber.',
    });
  }
  const category = await cachedSource(`sumber-detail|${tanggal}|${level}|${key}`, () => loadSourceDetail(tanggal, level, key));
  res.json({ tanggal, level, category });
}));

router.get('/kompulir/sumber', asyncRoute(async (req, res) => {
  const info = await ensureInfo();
  const tanggal = String(req.query.tanggal || info.today).trim();
  if (!isValidDate(tanggal)) {
    return res.status(400).json({
      error: 'Parameter tanggal tidak valid',
      detail: 'Gunakan format YYYY-MM-DD, contoh 2026-11-25.',
    });
  }

  const categories = await cachedSource(`sumber|${tanggal}`, () => loadSourceSummary(tanggal));
  res.json({ tanggal, categories });
}));

router.get('/kompulir', asyncRoute(async (req, res) => {
  const info = await ensureInfo();
  const tanggal = String(req.query.tanggal || info.today).trim();

  if (!isValidDate(tanggal)) {
    return res.status(400).json({
      error: 'Parameter tanggal tidak valid',
      detail: 'Gunakan format YYYY-MM-DD, contoh 2026-11-25.',
    });
  }

  const rawLevel = String(req.query.level || 'polres').trim().toLowerCase();
  if (!LEVELS.includes(rawLevel)) {
    return res.status(400).json({
      error: 'Parameter level tidak valid',
      detail: 'Gunakan polres atau polda.',
    });
  }

  const rawKategori = String(req.query.kategori || '').trim();
  let kategori = null;
  if (rawKategori && !['ALL', 'SEMUA', 'SEMUA KATEGORI'].includes(rawKategori.toUpperCase())) {
    const match = CATEGORIES.find((item) => item.toUpperCase() === rawKategori.toUpperCase());
    if (!match) {
      return res.status(400).json({
        error: 'Parameter kategori tidak dikenal',
        detail: 'Pilih ALL atau salah satu dari 19 kategori yang tersedia.',
      });
    }
    kategori = match;
  }

  const payload = await loadKompulir(tanggal, kategori, rawLevel, req.query.refresh === '1');
  res.json(payload);
}));

router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('[api]', err.message);
  const mapped = mapDbError(err);
  res.status(mapped.status).json(mapped.body);
});

module.exports = router;
