const fs = require("fs");
const Database = require("better-sqlite3");
const { DATA_DIR, DB_PATH } = require("../config");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

// Wrap better-sqlite3 (sync) in Promises so all existing async/await code works unchanged
function run(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(params);
    return Promise.resolve({ lastID: result.lastInsertRowid, changes: result.changes });
  } catch (err) {
    return Promise.reject(err);
  }
}

function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return Promise.resolve(stmt.all(params));
  } catch (err) {
    return Promise.reject(err);
  }
}

function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return Promise.resolve(stmt.get(params));
  } catch (err) {
    return Promise.reject(err);
  }
}

function close() {
  try {
    db.close();
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
}

module.exports = { db, run, all, get, close };
