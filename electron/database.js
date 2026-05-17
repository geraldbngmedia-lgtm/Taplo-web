/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const Database = require("better-sqlite3");

let db = null;

function getDatabase(app) {
  if (db) return db;

  const dbPath = path.join(app.getPath("userData"), "taplo.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      resume_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_descriptions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      parsed_requirements_json TEXT NOT NULL DEFAULT '[]',
      raw_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      calendar_event_id TEXT,
      candidate_id TEXT,
      jd_id TEXT,
      scheduled_start TEXT,
      recording_path TEXT,
      transcript TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'upcoming',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE SET NULL,
      FOREIGN KEY(jd_id) REFERENCES job_descriptions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      timestamp INTEGER,
      type TEXT NOT NULL CHECK(type IN ('coverage', 'gap', 'followup')),
      text TEXT NOT NULL,
      jd_requirement_ref TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      coverage_score REAL,
      strengths_json TEXT NOT NULL DEFAULT '[]',
      gaps_json TEXT NOT NULL DEFAULT '[]',
      recommendation TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );
  `);
}

function loadWorkspaceData(app) {
  const database = getDatabase(app);
  const row = database
    .prepare("SELECT value FROM app_state WHERE key = ?")
    .get("workspace");
  return row ? JSON.parse(row.value) : null;
}

function saveWorkspaceData(app, data) {
  const database = getDatabase(app);
  const payload = JSON.stringify(data);
  database
    .prepare(
      `INSERT INTO app_state (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run("workspace", payload);
  return { ok: true };
}

function closeDatabase() {
  if (!db) return;
  db.close();
  db = null;
}

module.exports = {
  closeDatabase,
  getDatabase,
  loadWorkspaceData,
  saveWorkspaceData,
};
