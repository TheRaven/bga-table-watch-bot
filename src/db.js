import Database from 'better-sqlite3';

const db = new Database('bga_tables.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS watched_channels (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS tracked_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    bga_url TEXT NOT NULL,
    table_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_checked_at TEXT,
    fail_count INTEGER DEFAULT 0,
    reminder_count INTEGER DEFAULT 0,
    last_reminded_at TEXT,
    UNIQUE(message_id, bga_url)
  )
`);

export const setWatchedChannel = db.prepare(`
  INSERT INTO watched_channels (guild_id, channel_id) VALUES (?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
`);

export const getWatchedChannel = db.prepare(`
  SELECT channel_id FROM watched_channels WHERE guild_id = ?
`);

export const removeWatchedChannel = db.prepare(`
  DELETE FROM watched_channels WHERE guild_id = ?
`);

export const insertTable = db.prepare(`
  INSERT OR IGNORE INTO tracked_tables (message_id, channel_id, guild_id, bga_url, table_id)
  VALUES (?, ?, ?, ?, ?)
`);

export const getActiveTables = db.prepare(`
  SELECT * FROM tracked_tables
`);

export const deleteTable = db.prepare(`
  DELETE FROM tracked_tables WHERE id = ?
`);

export const incrementFailCount = db.prepare(`
  UPDATE tracked_tables SET fail_count = fail_count + 1 WHERE id = ?
`);

export const resetFailCount = db.prepare(`
  UPDATE tracked_tables SET fail_count = 0, last_checked_at = datetime('now') WHERE id = ?
`);

export const deleteByMessageId = db.prepare(`
  DELETE FROM tracked_tables WHERE message_id = ?
`);

export const getTablesByMessageId = db.prepare(`
  SELECT * FROM tracked_tables WHERE message_id = ?
`);

export const getFailCount = db.prepare(`
  SELECT fail_count FROM tracked_tables WHERE id = ?
`);

export const countByMessageId = db.prepare(`
  SELECT COUNT(*) as count FROM tracked_tables WHERE message_id = ?
`);

export const markReminded = db.prepare(`
  UPDATE tracked_tables SET reminder_count = reminder_count + 1, last_reminded_at = datetime('now') WHERE id = ?
`);
