const { query } = require('./db');

const textFilter = `is_deleted = '0' AND is_valid = 0 AND tanggal = $1::date`;

function column(key, label, sql, numeric = false) {
  return { key, label, sql, numeric };
}

function dateColumn(key, label) {
  return column(key, label, `to_char(${key}, 'YYYY-MM-DD') AS ${key}`);
}

const SOURCES = [
  {
    key: 'DRIVING LICENSE',
    label: 'Driving License',
    table: 'tbl_import_driving_license',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres', 'jenis_sim'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jenis_sim', 'Jenis SIM', 'jenis_sim'),
      column('jumlah_data', 'Jumlah', 'sum(jumlah)::float8 AS jumlah_data', true),
    ],
  },
  {
    key: 'RAWAN TINDAK PIDANA',
    label: 'Rawan Tindak Pidana',
    table: 'tbl_import_rawan_tindak_pidana',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'RAWAN LANGGAR',
    label: 'Rawan Langgar',
    table: 'tbl_import_rawan_langgar',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'PENDUDUK',
    label: 'Penduduk',
    table: 'tbl_import_penduduk',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jumlah_data', 'Jumlah', 'sum(jumlah_penduduk)::float8 AS jumlah_data', true),
    ],
  },
  {
    key: 'PANJANG JALAN',
    label: 'Panjang Jalan',
    table: 'tbl_import_data_jalan',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'BLACKSPOT',
    label: 'Blackspot',
    table: 'tbl_import_blackspot',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres', 'status_blackspot'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('status_blackspot', 'Status blackspot', 'status_blackspot'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'TROUBLESPOT',
    label: 'Troublespot',
    table: 'tbl_import_troublespot',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres', 'status_troublespot'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('status_troublespot', 'Status troublespot', 'status_troublespot'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'PEOPLE MOBILITY',
    label: 'People Mobility',
    table: 'tbl_import_people_mobility',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jumlah_data_in', 'Jumlah masuk', 'sum(pengunjung_lk_datang + pengunjung_pr_datang)::float8 AS jumlah_data_in', true),
      column('jumlah_out', 'Jumlah keluar', 'sum(pengunjung_lk_berangkat + pengunjung_pr_berangkat)::float8 AS jumlah_out', true),
    ],
  },
  {
    key: 'RAWAN MACET / PERLAMBATAN',
    label: 'Rawan Macet / Perlambatan',
    table: 'tbl_import_rawan_macet',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'VEHICLE',
    label: 'Vehicle',
    table: 'tbl_import_ranmor_eri',
    where: 'is_deleted = 0 AND tanggal = $1::date',
    group: ['tanggal', 'polda', 'polres', 'jenis_kendaraan'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jenis_kendaraan', 'Jenis kendaraan', 'jenis_kendaraan'),
      column('jumlah_data', 'Jumlah', 'sum(jumlah)::float8 AS jumlah_data', true),
    ],
  },
  {
    key: 'TRAFFIC',
    label: 'Traffic',
    table: 'tbl_import_traffic_data',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('bus', 'Bus', 'sum(bus)::float8 AS bus', true),
      column('minibus', 'Minibus', 'sum(minibus)::float8 AS minibus', true),
      column('truck', 'Truck', 'sum(truck)::float8 AS truck', true),
      column('motor', 'Motor', 'sum(motor)::float8 AS motor', true),
      column('ransus', 'Ransus', 'sum(ransus)::float8 AS ransus', true),
      column('jumlah_data', 'Jumlah', 'sum(jumlah)::float8 AS jumlah_data', true),
    ],
  },
  {
    key: 'RAWAN LAKA',
    label: 'Rawan Laka',
    table: 'tbl_import_rawan_laka',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'ACCIDENT',
    label: 'Accident',
    table: 'tbl_import_data_kecelakaan_irsms',
    where: `is_delete::text = '0' AND is_valid = 1 AND tanggal_kejadian = $1::date`,
    group: ['tanggal_kejadian', 'polda', 'polres', 'tingkat_kecelakaan'],
    columns: [
      dateColumn('tanggal_kejadian', 'Tanggal kejadian'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('tingkat_kecelakaan', 'Tingkat kecelakaan', 'tingkat_kecelakaan'),
      column('jumlah_laka', 'Jumlah laka', 'count(*)::int AS jumlah_laka', true),
      column('meninggal', 'Meninggal', 'sum(jumlah_md)::float8 AS meninggal', true),
      column('luka_berat', 'Luka berat', 'sum(jumlah_lb)::float8 AS luka_berat', true),
      column('luka_ringan', 'Luka ringan', 'sum(jumlah_lr)::float8 AS luka_ringan', true),
    ],
  },
  {
    key: 'RAWAN BENCANA',
    label: 'Rawan Bencana',
    table: 'tbl_import_rawan_bencana',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'OBJECT VITAL',
    label: 'Object Vital',
    table: 'tbl_import_object_vital',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres', 'jenis_fasilitas'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jenis_fasilitas', 'Jenis fasilitas', 'jenis_fasilitas'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'OPERATION CONTROL',
    label: 'Operation Control',
    table: 'tbl_import_operation_control',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres', 'jenis_giat'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jenis_giat', 'Jenis giat', 'jenis_giat'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'CONTIGENCY SERVICE',
    label: 'Contingency Service',
    table: 'tbl_import_contigency_service',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres', 'jenis_contigency'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('jenis_contigency', 'Jenis contigency', 'jenis_contigency'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'MEDIA ACTIVITY',
    label: 'Media Activity',
    table: 'tbl_import_media_activity',
    where: textFilter,
    group: ['tanggal', 'polda', 'polres', 'media_sosial'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('media_sosial', 'Media sosial', 'media_sosial'),
      column('jumlah_data', 'Jumlah', 'count(*)::int AS jumlah_data', true),
    ],
  },
  {
    key: 'VIOLATION',
    label: 'Violation',
    table: 'tbl_summary_dakgar_polres',
    where: 'tanggal = $1::date',
    group: ['tanggal', 'polda', 'polres', 'kategori', 'sub_kategori'],
    columns: [
      dateColumn('tanggal', 'Tanggal'),
      column('polda', 'Polda', 'polda'),
      column('polres', 'Polres', 'polres'),
      column('kategori', 'Kategori', 'kategori'),
      column('sub_kategori', 'Sub kategori', 'sub_kategori'),
      column('jumlah_data', 'Jumlah', 'sum(jumlah)::float8 AS jumlah_data', true),
    ],
  },
];

function measureExpr(column) {
  return column.sql.replace(/\s*::\w+\s+AS\s+\w+\s*$/i, '');
}

function totalExpr(source) {
  const jumlah = source.columns.find((item) => item.key === 'jumlah_data' || item.key === 'jumlah_laka');
  if (jumlah) return measureExpr(jumlah);
  return source.columns.filter((item) => item.numeric).map(measureExpr).join(' + ');
}

function summarySql() {
  return SOURCES.map((source) => `SELECT '${source.key}'::text AS kategori,
            coalesce(nullif(btrim(polda::text), ''), '—') AS polda,
            coalesce(${totalExpr(source)}, 0)::float8 AS jumlah
       FROM ${source.table}
      WHERE ${source.where}
      GROUP BY 2`).join('\nUNION ALL\n');
}

function shapeSource(source, level) {
  if (level !== 'polda') return source;
  return {
    ...source,
    columns: source.columns.filter((item) => item.key !== 'polres'),
    group: source.group.filter((item) => item !== 'polres'),
  };
}

function sourceSql(source) {
  const selectList = source.columns.map((item) => item.sql).join(', ');
  const groupList = source.group.join(', ');
  return `SELECT ${selectList}
            FROM ${source.table}
           WHERE ${source.where}
           GROUP BY ${groupList}
           ORDER BY ${groupList}`;
}

function normalize(value, numeric) {
  if (value == null || value === '') return null;
  if (!numeric) return String(value);
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function present(source, rows) {
  return {
    key: source.key,
    label: source.label,
    columns: source.columns.map(({ key, label, numeric }) => ({ key, label, numeric })),
    rows: rows.map((row) => {
      const record = {};
      source.columns.forEach((item) => {
        record[item.key] = normalize(row[item.key], item.numeric);
      });
      return record;
    }),
  };
}

async function loadSourceSummary(tanggal) {
  const result = await query(summarySql(), [tanggal]);
  const byKey = new Map(SOURCES.map((source) => [source.key, {
    key: source.key,
    label: source.label,
    jumlah: 0,
    polda: [],
  }]));
  result.rows.forEach((row) => {
    const item = byKey.get(row.kategori);
    if (!item) return;
    const jumlah = Number(row.jumlah);
    const value = Number.isFinite(jumlah) ? jumlah : 0;
    item.jumlah += value;
    if (value) item.polda.push({ polda: row.polda || '—', jumlah: value });
  });
  return [...byKey.values()];
}

async function loadSourceDetail(tanggal, level, key) {
  const source = SOURCES.find((item) => item.key === key);
  if (!source) return null;
  const shaped = shapeSource(source, level === 'polda' ? 'polda' : 'polres');
  const result = await query(sourceSql(shaped), [tanggal]);
  return present(shaped, result.rows);
}

module.exports = { loadSourceSummary, loadSourceDetail, SOURCES };
