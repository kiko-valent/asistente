import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

function openDatabase(): DatabaseSync {
  // Ensure the directory exists (important for Docker volume mounts)
  const dbPath = config.databaseUrl;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // Performance and safety pragmas
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA synchronous = NORMAL');

  logger.info(`Database opened at ${dbPath}`);
  return db;
}

export const db = openDatabase();
export type { DatabaseSync };
