import { DatabaseSync } from 'node:sqlite';

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feature_flags (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      environments_json TEXT NOT NULL,
      evaluation_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evaluation_audits (
      id TEXT PRIMARY KEY,
      flag_key TEXT NOT NULL,
      environment TEXT NOT NULL,
      user_id TEXT NOT NULL,
      result INTEGER NOT NULL,
      reason TEXT NOT NULL,
      context_json TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(flag_key) REFERENCES feature_flags(key) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_flags_updated ON feature_flags(updated_at);
    CREATE INDEX IF NOT EXISTS idx_audits_flag_key ON evaluation_audits(flag_key);
    CREATE INDEX IF NOT EXISTS idx_audits_timestamp ON evaluation_audits(timestamp);
  `);
}
