import { db } from './database.js';
import { logger } from '../utils/logger.js';

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      title      TEXT,
      is_active  INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user
      ON conversations(user_id, is_active);

    CREATE TABLE IF NOT EXISTS messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      role            TEXT    NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content         TEXT    NOT NULL,
      is_summarized   INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv
      ON messages(conversation_id, is_summarized, created_at);

    CREATE TABLE IF NOT EXISTS summaries (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id  INTEGER NOT NULL REFERENCES conversations(id),
      content          TEXT    NOT NULL,
      messages_covered INTEGER NOT NULL,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      content    TEXT    NOT NULL,
      importance INTEGER NOT NULL DEFAULT 5,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_memories_user
      ON memories(user_id, importance);
  `);

  logger.info('Database schema ready');
}
