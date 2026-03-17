import { db } from '../database.js';

export interface Memory {
  id: number;
  user_id: number;
  content: string;
  importance: number;
  created_at: string;
}

export function insertMemory(
  userId: number,
  content: string,
  importance = 5
): void {
  db.prepare(
    'INSERT INTO memories (user_id, content, importance) VALUES (?, ?, ?)'
  ).run(userId, content, importance);
}

export function getTopMemories(userId: number, limit = 10): Memory[] {
  return db
    .prepare(
      'SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?'
    )
    .all(userId, limit) as unknown as Memory[];
}

export function listMemories(userId: number): Memory[] {
  return db
    .prepare(
      'SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC'
    )
    .all(userId) as unknown as Memory[];
}

export function deleteMemory(id: number, userId: number): boolean {
  const result = db
    .prepare('DELETE FROM memories WHERE id = ? AND user_id = ?')
    .run(id, userId);
  return result.changes > 0;
}
