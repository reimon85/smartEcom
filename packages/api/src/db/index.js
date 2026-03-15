const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', '..', '..', '..', 'smartecom.db');
const sqliteDb = new Database(DB_PATH);

sqliteDb.pragma('journal_mode = WAL');
sqliteDb.pragma('foreign_keys = ON');

/** Convert PostgreSQL syntax to SQLite */
function pgToSqlite(sql) {
  return sql
    .replace(/\$(\d+)/g, '?')
    .replace(/SERIAL\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/\bJSONB\b/gi, 'TEXT')
    .replace(/\bTIMESTAMPTZ\b/gi, 'TEXT')
    .replace(/\bTEXT\[\]/gi, 'TEXT')
    .replace(/\bBOOLEAN\b/gi, 'INTEGER')
    .replace(/\bDECIMAL\(\d+,\d+\)/gi, 'REAL')
    .replace(/DEFAULT\s+NOW\(\)/gi, "DEFAULT (datetime('now'))")
    .replace(/DEFAULT\s+CURRENT_DATE\b/gi, "DEFAULT (date('now'))")
    .replace(/\bNOW\(\)/gi, "datetime('now')")
    .replace(/\bCURRENT_DATE\b/gi, "date('now')");
}

/**
 * Execute a query. Returns { rows, rowCount } to match pg Pool interface.
 */
async function query(text, params = []) {
  const sql = pgToSqlite(text).trim();

  // Multi-statement DDL (migrations) → exec
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.length > 1) {
    sqliteDb.exec(sql);
    return { rows: [], rowCount: 0 };
  }

  // Single DDL without params → exec
  const firstWord = sql.split(/\s+/)[0].toUpperCase();
  if (!params.length && ['CREATE', 'DROP', 'ALTER'].includes(firstWord)) {
    sqliteDb.exec(sql);
    return { rows: [], rowCount: 0 };
  }

  // RETURNING clause → run + fetch by lastInsertRowid
  if (/\bRETURNING\b/i.test(sql)) {
    const sqlWithout = sql.replace(/\s+RETURNING\s+.+$/is, '');
    const info = sqliteDb.prepare(sqlWithout).run(...params);
    return { rows: [{ id: info.lastInsertRowid }], rowCount: info.changes };
  }

  // SELECT / WITH
  if (['SELECT', 'WITH'].includes(firstWord)) {
    const rows = sqliteDb.prepare(sql).all(...params);
    return { rows, rowCount: rows.length };
  }

  // INSERT / UPDATE / DELETE
  const info = sqliteDb.prepare(sql).run(...params);
  return { rows: [], rowCount: info.changes };
}

function getClient() {
  // SQLite doesn't need connection pooling; return a fake client
  return Promise.resolve({
    query,
    release: () => {},
  });
}

async function withTransaction(fn) {
  const txQuery = async (text, params) => query(text, params);
  sqliteDb.prepare('BEGIN').run();
  try {
    const result = await fn({ query: txQuery, release: () => {} });
    sqliteDb.prepare('COMMIT').run();
    return result;
  } catch (err) {
    sqliteDb.prepare('ROLLBACK').run();
    throw err;
  }
}

module.exports = { query, getClient, withTransaction };
