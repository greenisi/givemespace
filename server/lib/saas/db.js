// SaaS-layer SQLite store: users, subscriptions, usage_events.
// Uses the experimental built-in `node:sqlite` (Node 22+) — no native deps,
// no install step. If we outgrow SQLite we swap this module's body, the
// rest of the codebase keeps using `getDb()`.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA_VERSION = 1;

let dbInstance = null;
let dbPath = null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  username                TEXT PRIMARY KEY,
  tier                    TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  openai_oauth_token_enc  TEXT,
  created_at              INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_events (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  username            TEXT NOT NULL,
  ts                  INTEGER NOT NULL,
  model               TEXT NOT NULL,
  input_tokens        INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens       INTEGER NOT NULL DEFAULT 0,
  cost_usd_micros     INTEGER NOT NULL DEFAULT 0,
  request_id          TEXT,
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_user_ts ON usage_events(username, ts);
CREATE INDEX IF NOT EXISTS idx_usage_ts      ON usage_events(ts);
`;

function resolveDbPath(projectRoot) {
  const root = String(projectRoot || process.cwd());
  // Outside the server/ watched dir on purpose: the dev_server file
  // watcher restarts on saas.db-shm/wal mutations, which used to cause
  // a restart loop on every llm_proxy write. Allow override via
  // SAAS_DB_PATH env var for prod / multi-instance deployments.
  const envOverride = String(process.env.SAAS_DB_PATH || "").trim();
  if (envOverride) return envOverride;
  return path.join(root, "data", "saas", "saas.db");
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function migrate(db) {
  db.exec(SCHEMA_SQL);
  const stmt = db.prepare(
    "INSERT INTO schema_meta (key, value) VALUES (?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  stmt.run("schema_version", String(SCHEMA_VERSION));
}

export function getDb({ projectRoot } = {}) {
  if (dbInstance) {
    return dbInstance;
  }
  dbPath = resolveDbPath(projectRoot);
  ensureDir(dbPath);
  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA foreign_keys = ON;");
  migrate(dbInstance);
  return dbInstance;
}

export function getDbPath() {
  return dbPath;
}

// Test/dev helper — wipes the file (NOT exposed to API).
export function _resetForTests() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  if (dbPath && fs.existsSync(dbPath)) {
    fs.rmSync(dbPath);
  }
  dbPath = null;
}

// Upserts a user row keyed on username, returning the row.
// `admin` (member of the `_admin` group) is auto-promoted to `tier='admin'`
// so the LLM router sends them to the OpenAI/ChatGPT path.
export function upsertUser(db, { username, isAdmin = false }) {
  const now = Date.now();
  const tier = isAdmin ? "admin" : "free";
  db.prepare(
    `INSERT INTO users (username, tier, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET
       tier       = CASE WHEN users.tier = 'admin' THEN users.tier ELSE excluded.tier END,
       updated_at = excluded.updated_at`
  ).run(username, tier, now, now);
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

export function getUser(db, username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) || null;
}

export function setTier(db, username, tier) {
  const now = Date.now();
  db.prepare("UPDATE users SET tier = ?, updated_at = ? WHERE username = ?").run(
    tier,
    now,
    username
  );
}

// Insert a usage event. Costs are stored as micros (1e-6 USD) for integer precision.
export function insertUsageEvent(
  db,
  { username, model, input_tokens, cached_input_tokens, output_tokens, cost_usd_micros, request_id }
) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO usage_events
       (username, ts, model, input_tokens, cached_input_tokens, output_tokens, cost_usd_micros, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    username,
    now,
    model,
    input_tokens || 0,
    cached_input_tokens || 0,
    output_tokens || 0,
    cost_usd_micros || 0,
    request_id || null
  );
}

// Sum of input+output tokens over the last `windowMs` ms for a user.
export function getTokensUsedInWindow(db, username, windowMs) {
  const since = Date.now() - windowMs;
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS used
       FROM usage_events
       WHERE username = ? AND ts >= ?`
    )
    .get(username, since);
  return Number(row?.used || 0);
}
