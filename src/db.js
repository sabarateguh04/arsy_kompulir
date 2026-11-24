const { Pool } = require('pg');

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function requiredConfig() {
  return ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter(
    (key) => !process.env[key]
  );
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 4,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  application_name: 'arsy-kompulir-dashboard',
  options: '-c statement_timeout=120000',
});

pool.on('error', (err) => {
  console.error('[db] koneksi idle terputus:', err.message);
});

let infoCache = null;

function assertIdent(name) {
  if (!IDENT.test(name)) {
    const err = new Error('Nama schema tidak valid');
    err.code = 'INVALID_SCHEMA';
    throw err;
  }
}

async function ensureInfo() {
  if (infoCache) return infoCache;

  const missing = requiredConfig();
  if (missing.length) {
    const err = new Error(`Variabel environment belum diisi: ${missing.join(', ')}`);
    err.code = 'MISSING_CONFIG';
    throw err;
  }

  const requested = process.env.DB_SCHEMA || 'public';
  assertIdent(requested);

  const client = await pool.connect();
  try {
    const found = await client.query(
      `SELECT n.nspname
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'get_daily_kompulir'
          AND pg_get_function_identity_arguments(p.oid) = $1
        ORDER BY n.nspname`,
      ['p_tgl date, p_kategori text, p_level text']
    );

    const schemas = found.rows.map((row) => row.nspname);
    let schemaActive = null;
    let note = null;

    if (schemas.includes(requested)) {
      schemaActive = requested;
    } else if (schemas.includes('public')) {
      schemaActive = 'public';
      if (requested !== 'public') {
        note =
          `Schema "${requested}" tidak memuat get_daily_kompulir. ` +
          `search_path memakai "public" pada database ${process.env.DB_NAME}.`;
      }
    } else if (schemas[0]) {
      assertIdent(schemas[0]);
      schemaActive = schemas[0];
      note = `Function ditemukan di schema "${schemaActive}".`;
    } else {
      const err = new Error(
        'Function get_daily_kompulir(p_tgl date, p_kategori text, p_level text) tidak ditemukan'
      );
      err.code = '42883';
      throw err;
    }

    const today = await client.query(
      `SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today`
    );

    infoCache = {
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      schemaRequested: requested,
      schemaActive,
      note,
      today: today.rows[0].today,
      functionName: `${schemaActive}.get_daily_kompulir(date, text, text)`,
    };

    console.log(
      `[db] terhubung ke ${infoCache.database} @ ${infoCache.host}:${infoCache.port} ` +
        `search_path=${schemaActive}${note ? ` — ${note}` : ''}`
    );

    return infoCache;
  } catch (err) {
    infoCache = null;
    throw err;
  } finally {
    client.release();
  }
}

async function query(text, params) {
  const info = await ensureInfo();
  const client = await pool.connect();
  try {
    const searchPath =
      info.schemaActive === 'public'
        ? 'SET search_path TO public'
        : `SET search_path TO "${info.schemaActive}", public`;
    await client.query(searchPath);
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

function mapDbError(err) {
  const code = err.code || '';

  if (code === 'MISSING_CONFIG' || code === 'INVALID_SCHEMA') {
    return { status: 500, body: { error: 'Konfigurasi database tidak lengkap', detail: err.message } };
  }

  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'EHOSTUNREACH') {
    return {
      status: 503,
      body: {
        error: 'Tidak dapat terhubung ke PostgreSQL',
        detail: `Koneksi ke ${process.env.DB_HOST}:${process.env.DB_PORT} gagal (${code}). Periksa host, port, dan jaringan.`,
      },
    };
  }

  if (code === '28P01') {
    return {
      status: 503,
      body: { error: 'Autentikasi database ditolak', detail: 'User atau password tidak valid.' },
    };
  }

  if (code === '3D000') {
    return {
      status: 503,
      body: { error: 'Database tidak ditemukan', detail: err.message },
    };
  }

  if (code === '3F000' || code === '42P01') {
    return {
      status: 500,
      body: {
        error: 'Schema atau objek database tidak ditemukan',
        detail: err.message,
      },
    };
  }

  if (code === '42883') {
    return {
      status: 500,
      body: {
        error: 'Function get_daily_kompulir tidak ditemukan',
        detail: err.message,
      },
    };
  }

  if (code === '57014') {
    return {
      status: 504,
      body: {
        error: 'Query melebihi batas waktu',
        detail: 'get_daily_kompulir berjalan lebih dari 120 detik. Coba satu kategori, lalu ulangi.',
      },
    };
  }

  return {
    status: 500,
    body: { error: 'Gagal mengambil data kompulir', detail: err.message },
  };
}

module.exports = { pool, query, ensureInfo, mapDbError };
